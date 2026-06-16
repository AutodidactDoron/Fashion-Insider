import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'JUST NOW';
  if (diffMins < 60) return `${diffMins}M AGO`;
  
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}H AGO`;
  
  return `${Math.floor(diffHrs / 24)}D AGO`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUsername, setCurrentUsername] = useState(null); 

  useEffect(() => {
    const initBell = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_name')
          .eq('id', user.id)
          .single();

        if (profile && profile.user_name) {
          const actualName = profile.user_name;
          setCurrentUsername(actualName);
          fetchNotifications(actualName);
        }
      }
    };
    initBell();
  }, []);

  // ⚡ THE LIVE WIRE: WebSocket Engine with Telemetry
  useEffect(() => {
    if (!currentUsername) return;
    
    console.log(`[BELL ENGINE] 📡 Initiating Realtime connection for: ${currentUsername}`);

    const channel = supabase
      .channel('system-radar')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log("[BELL ENGINE] 🔥 RAW REALTIME HIT:", payload);
          
          const targetUser = payload.new.user_name || "";
          
          if (targetUser.trim().toLowerCase() === currentUsername.trim().toLowerCase()) {
            console.log("[BELL ENGINE] ✅ Target Match! Ringing the bell.");
            setNotifications(prev => [payload.new, ...prev].slice(0, 10));
            setUnreadCount(prev => prev + 1);
          } else {
            console.log(`[BELL ENGINE] ❌ Mismatch. Target in DB: '${targetUser}', Current User: '${currentUsername}'`);
          }
        }
      )
      .subscribe((status, err) => {
        console.log("[BELL ENGINE] 🔌 Connection Status:", status);
        if (err) console.error("[BELL ENGINE] ⚠️ Connection Error:", err);
      });

    const handleForceRefresh = () => fetchNotifications(currentUsername);
    window.addEventListener('refresh_notifications', handleForceRefresh);
    window.addEventListener('force_ts_refresh', handleForceRefresh); 

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('refresh_notifications', handleForceRefresh);
      window.removeEventListener('force_ts_refresh', handleForceRefresh);
    };
  }, [currentUsername]);

  const fetchNotifications = async (username) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .ilike('user_name', username) 
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const handleBellClick = async () => {
    setIsOpen(!isOpen);
    if (unreadCount > 0 && currentUsername) {
      setUnreadCount(0);
      await supabase.from('notifications').update({ is_read: true }).ilike('user_name', currentUsername);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  // ⚡ THE SMART ROUTER
  const handleNotificationAction = (title) => {
    setIsOpen(false); 
    const upperTitle = title.toUpperCase();
    
    // ניתוב נכסים לארון
    if (upperTitle.includes('VERIFIED') || upperTitle.includes('EXPANDED') || upperTitle.includes('FAILED') || upperTitle.includes('CONFISCATED')) {
      navigate('/closet');
    } 
    // ניתוב טריידים לחדרי העסקאות
    else if (upperTitle.includes('TRADE')) {
      navigate('/trades');
    } 
    // ניתוב הצעות ללוח המודעות
    else if (upperTitle.includes('OFFER')) {
      navigate('/my-posts');
    } 
    // ברירת מחדל
    else {
      navigate('/dashboard'); 
    }
  };

  if (!currentUsername) return null;

  return (
    <div className="relative">
      <button 
        onClick={handleBellClick}
        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors relative"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-fi-accent rounded-full text-black text-[10px] font-bold flex items-center justify-center animate-pulse shadow-[0_0_10px_rgba(255,215,0,0.5)]">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#111113] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
            <h3 className="text-white font-bold text-sm">Notifications</h3>
          </div>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No new alerts</div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationAction(notif.title)}
                  className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${notif.is_read ? 'opacity-70' : 'bg-fi-accent/5 border-l-2 border-l-fi-accent'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-white font-bold text-xs">{notif.title}</h4>
                    <span className="text-[9px] text-gray-500 font-bold tracking-widest uppercase shrink-0 ml-2">
                      {timeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{notif.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}