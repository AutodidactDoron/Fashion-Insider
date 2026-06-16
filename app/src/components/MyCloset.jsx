import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import AddAssetModal from './AddAssetModal';

export default function MyCloset() {
  const [activeInventory, setActiveInventory] = useState([]);
  const [pendingInventory, setPendingInventory] = useState([]);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);

  useEffect(() => {
    fetchInventory();

    console.log("[CLOSET RADAR] 📡 Initiating Realtime connection...");
    
    const closetSubscription = supabase
      .channel('closet-engine')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_closet_items' },
        (payload) => {
          console.log('[CLOSET RADAR] 🔥 RAW REALTIME HIT:', payload);
          // ⚡ הטריגר חי: שואבים את הנתונים המעודכנים מחדש
          fetchInventory();
        }
      )
      .subscribe((status, err) => {
        console.log("[CLOSET RADAR] 🔌 Connection Status:", status);
        if (err) console.error("[CLOSET RADAR] ⚠️ Connection Error:", err);
      });

    const handleLiveUpdate = () => fetchInventory();
    window.addEventListener('refresh_closet', handleLiveUpdate);

    return () => {
      supabase.removeChannel(closetSubscription);
      window.removeEventListener('refresh_closet', handleLiveUpdate);
    };
  }, []);

  const fetchInventory = async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      setLoading(false);
      return;
    }

    // ⚡ IDENTITY RESOLUTION: חילוץ השם האמיתי מהפרופיל
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_name')
      .eq('id', user.id)
      .single();

    const actualName = profile?.user_name;
    
    if (!actualName) {
      console.error("Identity resolution failed");
      setLoading(false);
      return;
    }

    // ⚡ שאיבת נתוני הארון לפי השם הטקסטואלי נטול ה-UUID
    // הוספנו כאן את size ו- condition_status כדי שהדפדפן ימשוך אותם
    const { data, error } = await supabase
      .from('user_closet_items')
      .select(`id, is_verified, is_locked, locked_in_room_id, added_at, proof_image_url, size, condition_status, catalog_items (name, brand, stock_image_url, market_value)`)
      .ilike('user_name', actualName) 
      .order('added_at', { ascending: false });

    if (error) {
      console.error("Closet Fetch Error:", error);
      setLoading(false);
      return;
    }

    if (data) {
      let calculatedWorth = 0;
      const verifiedItems = [];
      const unverifiedItems = [];

      data.forEach(item => {
        const masterData = item.catalog_items;
        
        const mappedItem = {
          id: item.id,
          name: masterData?.name || 'Asset Under Review',
          brand: masterData?.brand || 'AUTHENTICATION',
          img: masterData?.stock_image_url || item.proof_image_url || 'https://placehold.co/400x300/111113/333?text=Reviewing',
          currentMarketValue: masterData?.market_value || 0,
          isVerified: item.is_verified, 
          isLocked: item.is_locked || false,
          roomId: item.locked_in_room_id,
          // ⚡ THE EXPOSED DATA
          size: item.size || 'N/A',
          condition: item.condition_status
        };

        if (item.is_verified) {
          if (!item.is_locked && masterData && masterData.market_value) {
            calculatedWorth += masterData.market_value;
          }
          verifiedItems.push(mappedItem);
        } else {
          unverifiedItems.push(mappedItem);
        }
      });

      setActiveInventory(verifiedItems);
      setPendingInventory(unverifiedItems);
      setTotalNetWorth(calculatedWorth);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">My Closet</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your verified assets and track your net worth.</p>
          <button onClick={() => setIsAddAssetOpen(true)} className="mt-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center gap-2">
            Add Asset
          </button>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Liquid Closet Value</p>
          <p className="text-3xl font-black text-fi-accent drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]">
            {totalNetWorth.toLocaleString()} CR
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin w-8 h-8 border-2 border-fi-accent border-t-transparent rounded-full"></div></div>
      ) : (
        <div className="space-y-12">
          
          {/* ========================================= */}
          {/* 🟢 ACTIVE INVENTORY (VERIFIED ASSETS) */}
          {/* ========================================= */}
          <section>
            {activeInventory.length === 0 ? (
              <div className="bg-[#111113] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
                <h3 className="text-2xl font-black text-white mb-2 relative z-10 uppercase tracking-wide">Your Vault is Empty</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">You have no verified assets available for trading. Add items to increase your net worth.</p>
                <button onClick={() => setIsAddAssetOpen(true)} className="px-8 py-3.5 rounded-xl bg-white !text-black !font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-105">
                  START GRINDING
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {activeInventory.map(item => (
                  <div key={item.id} className={`bg-[#111113] border border-white/5 hover:border-fi-accent/30 ${item.isLocked ? 'opacity-70 grayscale-[30%]' : ''} rounded-xl p-4 transition-all group shadow-lg flex flex-col relative overflow-hidden`}>
                    
                    {/* 🔒 Escrow Lock Overlay */}
                    {item.isLocked && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-3 text-center border-2 border-red-500/30 transition-all">
                        <div className="bg-red-500/10 border border-red-500/40 text-red-400 font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded mb-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                          Locked in Escrow
                        </div>
                        <p className="text-gray-400 text-[9px] uppercase font-bold tracking-widest mb-1">Trade Protocol Active</p>
                        <p className="text-white text-xs font-black font-mono tracking-wider bg-white/5 px-2 py-1 rounded w-full truncate">
                          Room: {item.roomId ? item.roomId.split('-')[0].toUpperCase() : 'N/A'}
                        </p>
                      </div>
                    )}

                    <div className="aspect-square bg-white rounded-lg mb-4 p-4 flex items-center justify-center relative overflow-hidden">
                      <img src={item.img} alt={item.name} className={`absolute inset-0 w-full h-full object-contain p-2 transition-transform duration-300 ${!item.isLocked ? 'group-hover:scale-105' : 'grayscale contrast-125'}`} />
                      
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                        <div className="bg-black/90 backdrop-blur-md px-2 py-1 rounded flex items-center gap-1 border border-fi-accent/20">
                          <svg className="w-3 h-3 text-fi-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                          <span className="text-[9px] font-black text-fi-accent uppercase">VERIFIED</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between relative z-10">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{item.brand}</p>
                        <h3 className="text-white font-bold text-sm truncate mt-1" title={item.name}>{item.name}</h3>
                        
                        {/* ⚡ DATA BADGES */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="bg-white/5 border border-white/10 text-gray-300 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest">
                            {item.size}
                          </span>
                          {item.condition && (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${item.condition === 'DS' ? 'bg-fi-accent/10 text-fi-accent border-fi-accent/20' : item.condition === 'VNDS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                              {item.condition}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-end">
                        <div>
                          <span className="block text-[9px] text-gray-500 uppercase tracking-widest font-bold">Est. Value</span>
                          <span className="font-bold text-sm text-white">
                            {item.currentMarketValue.toLocaleString()} CR
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ========================================= */}
          {/* 🟠 PENDING AUTHENTICATION (UNVERIFIED) */}
          {/* ========================================= */}
          {pendingInventory.length > 0 && (
            <section className="pt-8 border-t border-white/5">
              <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Authentication Queue <span className="text-xs bg-white/10 px-2 py-1 rounded-md ml-2">{pendingInventory.length}</span>
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 opacity-70">
                {pendingInventory.map(item => (
                  <div key={item.id} className="bg-black border border-dashed border-yellow-500/30 rounded-xl p-4 flex flex-col relative overflow-hidden">
                    <div className="aspect-square bg-gray-900 rounded-lg mb-4 p-4 flex items-center justify-center relative overflow-hidden">
                      <img src={item.img} alt={item.name} className="absolute inset-0 w-full h-full object-contain p-2 grayscale opacity-50" />
                      
                      <div className="absolute top-2 right-2 z-10">
                        <div className="bg-yellow-500/20 backdrop-blur-md px-2 py-1 rounded flex items-center gap-1 border border-yellow-500/50 animate-pulse">
                          <svg className="w-3 h-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">CHECK CHECK</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500/80">{item.brand}</p>
                        <h3 className="text-gray-400 font-bold text-sm truncate mt-1" title={item.name}>{item.name}</h3>
                        
                        {/* ⚡ PENDING DATA BADGES */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest">
                            {item.size}
                          </span>
                          {item.condition && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border bg-gray-900 text-gray-500 border-gray-700">
                              {item.condition}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-end">
                        <div>
                          <span className="block text-[9px] text-gray-500 uppercase tracking-widest font-bold">Status</span>
                          <span className="font-bold text-xs text-yellow-500/80 uppercase tracking-wider">
                            Awaiting Auth
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
      <AddAssetModal isOpen={isAddAssetOpen} onClose={() => setIsAddAssetOpen(false)} />
    </div>
  );
}