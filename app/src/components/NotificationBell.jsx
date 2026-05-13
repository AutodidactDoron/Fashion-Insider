import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    let channel;

    const initBell = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const userId = user.id; 
        setCurrentUserId(userId);
        
        fetchNotifications(userId);

        const uniqueChannelId = `alerts_feed_${userId.substring(0, 8)}`;
        
        channel = supabase
          .channel(uniqueChannelId)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications' 
          }, (payload) => {
            if (payload.new.user_name === userId) {
              setNotifications(prev => [payload.new, ...prev]);
              setUnreadCount(prev => prev + 1);
            }
          })
          .subscribe();
      }
    };

    initBell();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handleForceRefresh = () => {
      if (currentUserId) fetchNotifications(currentUserId);
    };
    window.addEventListener('force_ts_refresh', handleForceRefresh);
    return () => window.removeEventListener('force_ts_refresh', handleForceRefresh);
  }, [currentUserId]);

  const fetchNotifications = async (userId) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_name', userId) 
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  // ⚡ THE FIX: Adjusted the read logic
  const handleBellClick = async () => {
    setIsOpen(!isOpen);
    
    // Only execute if there are actually unread messages
    if (unreadCount > 0 && currentUserId) {
      // 1. Clear the red badge immediately
      setUnreadCount(0);
      
      // 2. Update the DB in the background
      await supabase.from('notifications').update({ is_read: true }).eq('user_name', currentUserId);
      
      // NOTE: We deliberately DO NOT mutate the local `notifications` state here.
      // This keeps the yellow highlight active while the user is reading the menu.
    }
  };

  if (!currentUserId) return null;

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
                <div key={notif.id} className={`p-4 border-b border-white/5 transition-colors ${notif.is_read ? 'opacity-50' : 'bg-fi-accent/5 border-l-2 border-l-fi-accent'}`}>
                  <h4 className="text-white font-bold text-xs mb-1">{notif.title}</h4>
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