import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const generateHardwareFingerprint = () => {
  let hwId = localStorage.getItem('fi_hw_lock');
  if (!hwId) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = "top";
      ctx.font = "16px 'Arial'";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("FashionInsiderProtocol", 2, 15);
      
      const dataURL = canvas.toDataURL();
      let hash = 0;
      for (let i = 0; i < dataURL.length; i++) {
        hash = ((hash << 5) - hash) + dataURL.charCodeAt(i);
        hash |= 0; 
      }
      
      const navInfo = navigator.userAgent + (navigator.hardwareConcurrency || '') + window.screen.width;
      let navHash = 0;
      for (let i = 0; i < navInfo.length; i++) {
        navHash = ((navHash << 5) - navHash) + navInfo.charCodeAt(i);
        navHash |= 0;
      }

      hwId = `FI-HW-${Math.abs(hash)}-${Math.abs(navHash)}`;
      localStorage.setItem('fi_hw_lock', hwId);
    } catch (e) {
      hwId = `FI-HW-FALLBACK-${Date.now()}`;
      localStorage.setItem('fi_hw_lock', hwId);
    }
  }
  return hwId;
};

export default function ProtectedRoute({ children }) {
  const [sessionData, setSessionData] = useState({ state: 'loading', user: null, banData: null });
  const [isHardwareBanned, setIsHardwareBanned] = useState(false);
  const [liquidationStatus, setLiquidationStatus] = useState('idle'); 

  useEffect(() => {
    let isMounted = true;

    const checkSecurityProtocols = async () => {
      const currentHwId = generateHardwareFingerprint();
      const { count } = await supabase
        .from('banned_devices')
        .select('*', { count: 'exact', head: true })
        .eq('device_hash', currentHwId);

      const isHwBanned = count > 0;
      if (isMounted) setIsHardwareBanned(isHwBanned);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        if (isMounted) setSessionData({ state: 'unauthenticated', user: null, banData: null });
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('banned_until, credits')
        .eq('id', session.user.id)
        .single();

      if (isMounted) {
        setSessionData({ 
          state: 'authenticated', 
          user: session.user, 
          banData: profile || null 
        });

        if (profile && profile.banned_until) {
          const banDate = new Date(profile.banned_until);
          const isPermaBan = (banDate.getFullYear() - new Date().getFullYear()) > 50;
          if (isPermaBan && !isHwBanned) {
            await supabase.from('banned_devices').upsert([{ device_hash: currentHwId }]);
          }
        }
      }
    };

    checkSecurityProtocols();

    return () => { isMounted = false; };
  }, []);

  const handleLiquidation = async () => {
    if (liquidationStatus !== 'idle') return;
    setLiquidationStatus('loading');
    
    try {
      const { data, error } = await supabase.rpc('liquidate_user_funds', { p_user_id: sessionData.user.id });
      if (error || data === false) throw new Error("Liquidation Failed");
      
      setSessionData(prev => ({
        ...prev,
        banData: { ...prev.banData, credits: 0 }
      }));
      setLiquidationStatus('success');
    } catch (err) {
      console.error(err);
      alert("System Error: Could not process liquidation. Contact Support.");
      setLiquidationStatus('idle');
    }
  };

  if (sessionData.state === 'loading') {
    return <div className="min-h-screen bg-black flex items-center justify-center text-fi-accent font-black tracking-widest uppercase">Securing Connection...</div>;
  }

  // ⚡ LLOGIC OVERRIDE: Priority Routing
  const isPermaBan = sessionData.banData?.banned_until && (new Date(sessionData.banData.banned_until).getFullYear() - new Date().getFullYear() > 50);
  const hasCredits = sessionData.banData?.credits > 0;

  // 1. קודם כל: אם הוא קיבל עונש מוות ויש לו כסף, כפה עליו את מסך החיסול (גם אם החומרה שרופה)
  if (isPermaBan && (hasCredits || liquidationStatus === 'success')) {
    return (
      <div className="flex-1 p-8 h-full flex items-center justify-center min-h-screen bg-black">
        <div className="bg-red-950/20 border border-red-500 rounded-2xl p-12 text-center max-w-lg shadow-[0_0_50px_rgba(239,68,68,0.2)]">
          <h2 className="text-3xl font-black text-red-500 uppercase tracking-tighter mb-4">Account Terminated</h2>
          <p className="text-gray-300 text-sm mb-6">
            Your access to Fashion Insider has been permanently revoked due to severe violations of our trading protocols.
          </p>
          
          <div className="bg-black/50 border border-red-500/30 p-4 rounded-lg mb-8 transition-all">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Available Liquidity</p>
            <p className={`font-mono font-black text-xl ${liquidationStatus === 'success' ? 'text-gray-600 line-through' : 'text-white'}`}>
              {sessionData.banData.credits} CR
            </p>
          </div>

          {liquidationStatus === 'success' ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg py-4 px-6">
              <p className="text-green-500 font-black uppercase tracking-widest text-xs mb-1">✓ Request Submitted</p>
              <p className="text-green-400/80 text-[10px]">Funds will be wired to your original payment method within 5-7 business days.</p>
            </div>
          ) : (
            <button 
              onClick={handleLiquidation}
              disabled={liquidationStatus === 'loading'}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-black uppercase tracking-widest rounded-lg transition-colors flex justify-center items-center gap-2"
            >
              {liquidationStatus === 'loading' ? 'Processing...' : 'Liquidate Funds'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. אם החומרה שרופה (ואין לו כסף למשוך) -> מסך שחור סופי.
  if (isHardwareBanned) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
         <div className="bg-red-950/10 border border-red-900/50 rounded-xl p-8 max-w-md text-center">
            <h1 className="text-red-500 font-black tracking-widest uppercase mb-2">ACCESS DENIED</h1>
            <p className="text-gray-500 text-xs font-mono mb-4">ERR_HW_SEC_LOCK // DEVICE BLACKLISTED</p>
            <p className="text-gray-400 text-sm">This device has been permanently restricted from accessing the Fashion Insider network due to severe violations.</p>
         </div>
      </div>
    );
  }

  if (sessionData.state === 'unauthenticated') return <Navigate to="/login" replace />;

  // 3. השעיה זמנית (Time Ban)
  if (sessionData.banData && sessionData.banData.banned_until) {
    const banDate = new Date(sessionData.banData.banned_until);
    const now = new Date();

    if (banDate > now) {
      const hoursLeft = Math.ceil((banDate - now) / (1000 * 60 * 60));
      return (
        <div className="flex-1 p-8 h-full flex items-center justify-center min-h-screen bg-black">
          <div className="bg-[#111113] border border-orange-500/30 rounded-2xl p-12 text-center max-w-lg shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-orange-500 animate-pulse" />
            <div className="mx-auto w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Account Suspended</h2>
            <p className="text-orange-400 font-bold text-sm mb-6">Market access restricted.</p>
            <div className="bg-black border border-white/5 rounded-lg p-6 mb-6">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Time until lock release</p>
              <p className="text-3xl font-mono font-black text-white">{hoursLeft} HOURS</p>
            </div>
            <p className="text-gray-500 text-xs">
              You can still browse the public market, but your wallet, closet, and trading capabilities are frozen.
            </p>
          </div>
        </div>
      );
    }
  }

  return children;
}