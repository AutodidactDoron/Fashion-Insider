import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function GlobalRealtimeEngine() {
  const [activeUserId, setActiveUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setActiveUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setActiveUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let godChannel;
    let isMounted = true; // ⚡ THE KILL SWITCH: מונע יצירת חיבורי רפאים

    const connectEngine = () => {
      if (!isMounted) return;
      if (godChannel) supabase.removeChannel(godChannel);

      godChannel = supabase.channel('god_mode_engine')
        .on('broadcast', { event: 'force_system_reload' }, () => {
          if (isMounted) window.location.reload();
        })
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          if (!isMounted) return;

          switch (payload.table) {
            case 'user_profiles':
              if (activeUserId && payload.new && payload.new.id === activeUserId) {
                window.dispatchEvent(new Event('update_global_credits'));
                window.dispatchEvent(new Event('force_ts_refresh')); 
              }
              break;
            case 'notifications':
              // ⚡ FILTER: רענן רק אם ההתראה שייכת אלי
              if (payload.new && payload.new.user_name === activeUserId) {
                window.dispatchEvent(new Event('refresh_notifications'));
              }
              break;
            case 'trade_rooms':
              // ⚡ FILTER: רענן את חדר הטריידים רק אם אני מעורב בעסקה הזו
              const room = payload.new || payload.old;
              if (room && (room.initiator_name === activeUserId || room.responder_name === activeUserId)) {
                window.dispatchEvent(new Event('refresh_trades'));
              }
              break;
            case 'trade_messages':
              window.dispatchEvent(new Event('refresh_trades'));
              break;
            case 'post_interests':
              window.dispatchEvent(new Event('refresh_offers'));
              break;
            case 'user_closet_items':
              // ⚡ FILTER: רענן את הארון רק אם הפריט שעודכן שייך אלי
              if (payload.new && payload.new.user_name === activeUserId) {
                window.dispatchEvent(new Event('refresh_closet'));
              }
              break;
            case 'community_posts':
              window.dispatchEvent(new Event('refresh_feed'));
              break;
            case 'catalog_items':
            case 'catalog_requests':
              window.dispatchEvent(new Event('refresh_catalog'));
              window.dispatchEvent(new Event('refresh_admin_queues'));
              break;
            default:
              break;
          }
        })
        .subscribe((status) => {
          if (!isMounted) return;
          
          if (status === 'SUBSCRIBED') {
            console.log("🟢 God Mode Engine: Connection Established.");
          }
          
          // ⚡ FATAL BUG FIXED: הסרנו את 'CLOSED' מפקודת החיבור מחדש
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`⚠️ Realtime Link Interrupted (${status}). Executing Reconnection Protocol...`);
            setTimeout(connectEngine, 3000); 
          }
        });
    };

    connectEngine();

    const handleNetworkOnline = () => {
      if (!isMounted) return;
      console.log("🌐 Internet restored. Forcing interface refresh.");
      window.dispatchEvent(new Event('refresh_trades'));
      window.dispatchEvent(new Event('refresh_offers'));
      window.dispatchEvent(new Event('refresh_notifications'));
    };
    window.addEventListener('online', handleNetworkOnline);

    return () => { 
      isMounted = false; // הפעלת מתג ההשמדה בעת יציאה מהעמוד
      if (godChannel) supabase.removeChannel(godChannel);
      window.removeEventListener('online', handleNetworkOnline);
    };
  }, [activeUserId]);

  return null;
}