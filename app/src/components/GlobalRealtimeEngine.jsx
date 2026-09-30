import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function GlobalRealtimeEngine() {
  const [session, setSession] = useState(null);
  const [identity, setIdentity] = useState({ id: null, name: null });
  const identityRef = useRef({ id: null, name: null });

  // ─── בלוק 1: מעקב התחברות. עבודה מקומית בלבד, בלי פנייה לשרת. ───
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );

    return () => subscription.unsubscribe();
  }, []);

  // ─── בלוק 2: שליפת השם. כאן מותר לפנות לשרת. ───
  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      if (!session?.user?.id) {
        const empty = { id: null, name: null };
        identityRef.current = empty;
        setIdentity(empty);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_name')
        .eq('id', session.user.id)
        .single();

      if (!isActive) return;

      const resolved = {
        id: session.user.id,
        name: profile?.user_name || session.user.user_metadata?.user_name || null,
      };

      identityRef.current = resolved;
      setIdentity(resolved);
    };

    loadProfile();
    return () => { isActive = false; };
  }, [session?.user?.id]);

  // ─── בלוק 3: המאזין. ───
  useEffect(() => {
    let godChannel;
    let isMounted = true;

    const isMine = (value) => {
      if (!value) return false;
      const me = identityRef.current;
      if (me.id && value === me.id) return true;
      if (me.name && typeof value === 'string') {
        return value.trim().toLowerCase() === me.name.trim().toLowerCase();
      }
      return false;
    };

    const connectEngine = () => {
      if (!isMounted) return;
      if (godChannel) supabase.removeChannel(godChannel);

      godChannel = supabase.channel('god_mode_engine')
        .on('broadcast', { event: 'force_system_reload' }, () => {
          if (isMounted) window.location.reload();
        })
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          if (!isMounted) return;

          const row = payload.new || payload.old;
          if (!row) return;

          switch (payload.table) {
            case 'user_profiles':
              if (isMine(row.id)) {
                window.dispatchEvent(new Event('update_global_credits'));
                window.dispatchEvent(new Event('force_ts_refresh'));
              }
              break;

            case 'notifications':
              if (isMine(row.user_name)) {
                window.dispatchEvent(new Event('refresh_notifications'));
              }
              break;

            case 'trade_rooms': {
              if (
                isMine(row.initiator_id) ||
                isMine(row.responder_id) ||
                isMine(row.initiator_name) ||
                isMine(row.responder_name)
              ) {
                window.dispatchEvent(new Event('refresh_trades'));
              }
              break;
            }

            case 'trade_messages':
              window.dispatchEvent(new Event('refresh_trades'));
              break;

            case 'post_interests':
              window.dispatchEvent(new Event('refresh_offers'));
              break;

            case 'user_closet_items':
              if (isMine(row.user_name) || isMine(row.owner_id)) {
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
            console.log('🟢 God Mode Engine: Connection Established.');
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`⚠️ Realtime Link Interrupted (${status}). Reconnecting...`);
            setTimeout(connectEngine, 3000);
          }
        });
    };

    connectEngine();

    const handleNetworkOnline = () => {
      if (!isMounted) return;
      console.log('🌐 Internet restored. Forcing interface refresh.');
      window.dispatchEvent(new Event('refresh_trades'));
      window.dispatchEvent(new Event('refresh_offers'));
      window.dispatchEvent(new Event('refresh_notifications'));
    };
    window.addEventListener('online', handleNetworkOnline);

    return () => {
      isMounted = false;
      if (godChannel) supabase.removeChannel(godChannel);
      window.removeEventListener('online', handleNetworkOnline);
    };
  }, [identity.id]);

  return null;
}