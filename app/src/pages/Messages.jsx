import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Messages() {
  const navigate = useNavigate();
  const [activeConversations, setActiveConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGlobalInbox();
  }, []);

  const fetchGlobalInbox = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. שאיבת הפרופיל לקבלת השם החשוף
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_name')
      .eq('id', user.id)
      .single();
    
    const userName = profile?.user_name || user.user_metadata?.user_name;

    // ⚡ THE FIX 1: OMNI-CATCHER - סריקה רחבה וחסינה של חדרים פעילים
    const { data: rooms, error: roomsError } = await supabase
      .from('trade_rooms')
      .select('id, initiator_name, responder_name, status, updated_at')
      .in('status', ['pending_acceptance', 'negotiation', 'meetup_pending', 'abort_pending'])
      .or(`initiator_name.eq.${userName},responder_name.eq.${userName},initiator_name.eq.${user.id},responder_name.eq.${user.id}`);

    if (roomsError || !rooms || rooms.length === 0) {
      setActiveConversations([]);
      setIsLoading(false);
      return;
    }

    // 2. לולאת מיפוי לשאיבת ההודעה האחרונה מכל חדר פעיל
    const inboxData = await Promise.all(rooms.map(async (room) => {
      const isInitiator = room.initiator_name === userName || room.initiator_name === user.id;
      let opponentRaw = isInitiator ? room.responder_name : room.initiator_name;
      
      // המרת UUID לשם קריא במקרה של טריידים ישנים
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (UUID_REGEX.test(opponentRaw)) {
           const {data: oppProfile} = await supabase.from('user_profiles').select('user_name').eq('id', opponentRaw).single();
           if (oppProfile) opponentRaw = oppProfile.user_name;
      }

      // ⚡ THE FIX 2: BULLETPROOF FETCH - שליפה ללא קריסה כשהחדר ריק
      const { data: messages } = await supabase
        .from('trade_messages')
        .select('message_content, created_at, sender_name')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMessage = messages && messages.length > 0 ? messages[0] : null;

      return {
        roomId: room.id,
        opponentName: opponentRaw,
        status: room.status,
        lastMessage: lastMessage?.message_content || 'Trade protocol initialized. Waiting for comms.',
        lastMessageTime: lastMessage?.created_at || room.updated_at,
        isUnread: lastMessage ? lastMessage.sender_name !== userName && lastMessage.sender_name !== user.id : false
      };
    }));

    // מיון לפי זמן ההודעה האחרונה (הכי חדש למעלה)
    inboxData.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
    setActiveConversations(inboxData);
    setIsLoading(false);
  };

  if (isLoading) return <div className="text-white p-8 font-bold tracking-widest uppercase">Decrypting global inbox...</div>;

  return (
    <section className="pb-20 max-w-4xl mx-auto p-4 sm:p-0">
      <div className="mb-8 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Comms Hub</h1>
        <p className="text-gray-500 text-sm mt-1">Global inbox for all active trade negotiations.</p>
      </div>

      {activeConversations.length === 0 ? (
        <div className="bg-[#111113] border border-white/10 rounded-xl p-12 text-center">
          <p className="text-gray-500 font-medium uppercase tracking-widest text-sm">Inbox Zero</p>
          <p className="text-gray-600 text-xs mt-2">No active trade communications found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeConversations.map(conv => (
            <div 
              key={conv.roomId} 
              onClick={() => navigate('/trades', { state: { autoOpenRoomId: conv.roomId } })}
              className="bg-[#111113] border border-white/5 hover:border-fi-accent/50 rounded-xl p-4 sm:p-5 flex items-center gap-4 cursor-pointer transition-all group shadow-md"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {conv.opponentName.charAt(0).toUpperCase()}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-white font-bold text-sm truncate">Trade vs. {conv.opponentName}</h3>
                  <span className="text-gray-500 text-[10px] uppercase tracking-wider shrink-0 ml-2">
                    {new Date(conv.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className={`text-xs truncate ${conv.isUnread ? 'text-fi-accent font-bold' : 'text-gray-400'}`}>
                  {conv.lastMessage}
                </p>
              </div>

              <div className="shrink-0 hidden sm:flex flex-col items-end gap-2">
                <span className={`text-[9px] px-2 py-1 rounded uppercase tracking-widest font-bold ${conv.status === 'meetup_pending' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-gray-400'}`}>
                  {conv.status.replace('_', ' ')}
                </span>
                <svg className="w-4 h-4 text-gray-600 group-hover:text-fi-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}