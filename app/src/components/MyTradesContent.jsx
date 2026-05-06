import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import VaultSelectorModal from './VaultSelectorModal';

export default function MyTradesContent() {
  const [currentUser, setCurrentUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- THE INITIALIZATION ENGINE ---
  useEffect(() => {
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.user_metadata?.user_name) {
        const username = user.user_metadata.user_name;
        setCurrentUser(username);
        fetchMyTrades(username);
      } else {
        setIsLoading(false);
      }
    };
    initPage();
  }, []);

  const fetchMyTrades = async (username) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('trade_rooms')
      .select('*')
      .or(`initiator_name.eq.${username},responder_name.eq.${username}`)
      .order('updated_at', { ascending: false });

    if (data) setTrades(data);
    setIsLoading(false);
  };

  if (isLoading) return <div className="text-white p-8 font-bold tracking-widest uppercase">Decrypting Trade Logs...</div>;
  if (!currentUser) return <div className="text-white p-8">Authentication Required.</div>;

  return activeRoom ? (
    <TradeRoomEngine 
      room={activeRoom} 
      currentUser={currentUser} 
      onBack={() => { setActiveRoom(null); fetchMyTrades(currentUser); }} 
    />
  ) : (
    <section className="pb-20 max-w-5xl mx-auto">
      <div className="mb-8 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Trade Terminals</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your active negotiations and meetups.</p>
      </div>

      {trades.length === 0 ? (
        <div className="bg-[#111113] border border-white/10 rounded-xl p-12 text-center">
          <p className="text-gray-500 font-medium">No active trade protocols found.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {trades.map(trade => {
            const isInitiator = currentUser === trade.initiator_name;
            const opponent = isInitiator ? trade.responder_name : trade.initiator_name;
            
            let statusColor = 'text-fi-accent';
            if (trade.status === 'meetup_pending') statusColor = 'text-green-400';
            if (trade.status === 'completed') statusColor = 'text-blue-400';

            return (
              <div key={trade.id} className="bg-[#111113] border border-white/10 rounded-xl p-6 flex justify-between items-center hover:border-white/20 transition-colors">
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${statusColor} bg-white/5 px-2 py-1 rounded`}>
                    {trade.status.replace('_', ' ')}
                  </span>
                  <h3 className="text-white font-bold mt-3 text-lg">Trade vs. {opponent}</h3>
                  <p className="text-gray-500 text-xs mt-1">Room ID: {trade.id.split('-')[0]}</p>
                </div>
                <button 
                  onClick={() => setActiveRoom(trade)}
                  className="px-6 py-3 bg-white text-black font-black text-xs rounded uppercase hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  {trade.status === 'completed' ? 'View Receipt' : 'Enter Room'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ==========================================
// 🛡️ THE TRADE ROOM ENGINE 
// ==========================================
function TradeRoomEngine({ room, currentUser, onBack }) {
  const [roomState, setRoomState] = useState(room);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  // --- URGENCY ENGINE (72H COUNTDOWN) ---
  const [meetupTimeLeft, setMeetupTimeLeft] = useState('--H --M');

  useEffect(() => {
    if (roomState.status !== 'meetup_pending' || !roomState.meetup_deadline) return;
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = new Date(roomState.meetup_deadline).getTime() - now;
      
      if (distance < 0) {
        setMeetupTimeLeft('EXPIRED');
        return;
      }
      
      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      setMeetupTimeLeft(`${hours}H ${minutes}M`);
    };

    updateTimer(); // Execute immediately
    const interval = setInterval(updateTimer, 60000); // Tick every 60 seconds
    
    return () => clearInterval(interval);
  }, [roomState.status, roomState.meetup_deadline]);

  const isInitiator = currentUser === roomState.initiator_name;
  const opponentName = isInitiator ? roomState.responder_name : roomState.initiator_name;
  
  const myLock = isInitiator ? roomState.initiator_locked : roomState.responder_locked;
  const opponentLock = isInitiator ? roomState.responder_locked : roomState.initiator_locked;

  const myAssets = (isInitiator ? roomState.initiator_assets : roomState.responder_assets) || [];
  const opponentAssets = (isInitiator ? roomState.responder_assets : roomState.initiator_assets) || [];

  // --- CROSS-COMPONENT COMMUNICATION ENGINE ---
  useEffect(() => {
    if (roomState.status === 'completed') {
      window.dispatchEvent(new Event('force_ts_refresh'));
    }
  }, [roomState.status]);

  useEffect(() => {
    fetchMessages();
    const roomChannel = supabase.channel(`room_${roomState.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trade_rooms', filter: `id=eq.${roomState.id}` }, (payload) => {
        setRoomState(payload.new);
      }).subscribe();

    const chatChannel = supabase.channel(`chat_${roomState.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_messages', filter: `room_id=eq.${roomState.id}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      }).subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(chatChannel);
    };
  }, []);

  useEffect(() => {
    if (myLock && opponentLock && roomState.status !== 'meetup_pending' && roomState.status !== 'completed') {
      let counter = 5;
      setCountdown(counter);
      const timer = setInterval(async () => {
        counter -= 1;
        setCountdown(counter);
        if (counter === 0) {
          clearInterval(timer);
          if (isInitiator) {
            await supabase.from('trade_rooms').update({ 
              status: 'meetup_pending',
              meetup_deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
            }).eq('id', roomState.id);
          }
        }
      }, 1000);
      return () => clearInterval(timer);
    } else if (!myLock || !opponentLock) {
      setCountdown(null);
    }
  }, [myLock, opponentLock]);

  const fetchMessages = async () => {
    const { data } = await supabase.from('trade_messages').select('*').eq('room_id', roomState.id).order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    await supabase.from('trade_messages').insert([{ room_id: roomState.id, sender_name: currentUser, message_content: chatInput }]);
    setChatInput('');
  };

  const toggleLock = async () => {
    if (!roomState.safe_zone_selected) return alert("Select a Safe Zone first.");
    if (myAssets.length === 0 && opponentAssets.length === 0) return alert("Trade table is empty.");
    
    const newLockState = !myLock;
    const updateField = isInitiator ? { initiator_locked: newLockState } : { responder_locked: newLockState };
    
    setRoomState(prev => ({ ...prev, ...updateField }));
    await supabase.from('trade_rooms').update(updateField).eq('id', roomState.id);
  };

  const updateSafeZone = async (zone) => {
    setRoomState(prev => ({ 
      ...prev, safe_zone_selected: zone, initiator_locked: false, responder_locked: false 
    }));
    await supabase.from('trade_rooms').update({ 
      safe_zone_selected: zone, initiator_locked: false, responder_locked: false 
    }).eq('id', roomState.id);
  };

  const updateMyAssets = async (newAssetsArray) => {
    const targetField = isInitiator ? 'initiator_assets' : 'responder_assets';
    setRoomState(prev => ({
      ...prev, [targetField]: newAssetsArray, initiator_locked: false, responder_locked: false
    }));
    await supabase.from('trade_rooms').update({
      [targetField]: newAssetsArray, initiator_locked: false, responder_locked: false
    }).eq('id', roomState.id);
  };

  const handleAssetsSelected = (newAssets) => { updateMyAssets([...myAssets, ...newAssets]); };
  const handleRemoveAsset = (idxToRemove) => { updateMyAssets(myAssets.filter((_, idx) => idx !== idxToRemove)); };

  const renderAssetCard = (asset, isMine, idx) => (
    <div key={idx} className="bg-black/60 border border-white/10 p-2 rounded-lg flex items-center gap-3 shadow-md w-full">
      {asset.stock_image_url && (
        <img src={asset.stock_image_url} alt="" className="w-10 h-10 object-contain bg-white rounded-md p-1" />
      )}
      <div className="flex-1">
        <p className="text-white text-xs font-bold truncate w-32">{asset.name}</p>
        <p className="text-gray-500 text-[9px] uppercase">{asset.brand || 'Item'}</p>
      </div>
      {isMine && !myLock && roomState.status !== 'completed' && (
        <button onClick={() => handleRemoveAsset(idx)} className="text-gray-600 hover:text-red-400 transition-colors px-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );

  // --- COMPLETED PHASE UI ---
  if (roomState.status === 'completed') {
    return (
      <div className="max-w-2xl mx-auto mt-10 text-center space-y-6">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm font-bold uppercase mb-8">← Back to Trades</button>
        <div className="bg-blue-500/10 border border-blue-500 rounded-2xl p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Trade Completed</h2>
          <p className="text-blue-400 font-bold mb-8">Digital Receipt Signed</p>
          <div className="flex justify-center gap-4 mb-6">
             <span className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded font-black uppercase text-sm">+5 Trust Score</span>
          </div>
          <p className="text-gray-500 text-xs">Transaction ID: {roomState.id}</p>
        </div>
      </div>
    );
  }

  // --- MEETUP PHASE UI (The PIN Engine) ---
  if (roomState.status === 'meetup_pending') {
    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(roomState.safe_zone_selected)}`;
    const verificationPin = roomState.id.split('-')[0].toUpperCase().substring(0, 5);

    const handleVerifyTrade = async () => {
      const userPin = prompt(`Enter the 5-digit verification PIN from ${opponentName}'s screen:`);
      if (!userPin) return;

      if (userPin.toUpperCase() === verificationPin) {
        
        // 1. Database-First Execution: Update the DB BEFORE touching local UI
        await supabase.from('trade_rooms').update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        }).eq('id', roomState.id);

        try {
          // 2. Lock in the Trust Score
          await supabase.rpc('increment_trust_score', { target_user: currentUser, amount: 5 });
          await supabase.rpc('increment_trust_score', { target_user: opponentName, amount: 5 });
          
          // 3. NOW update local state. The useEffect will fire, but the DB is already fully updated.
          setRoomState(prev => ({ ...prev, status: 'completed' }));
          
          // 4. Dispatch the global event to TopBar & Bell explicitly
          window.dispatchEvent(new Event('force_ts_refresh'));

          // 5. Release UI thread: Push alert to next tick so DOM can paint the new TS
          setTimeout(() => {
            alert("Verification Successful! Trade Complete. +5 TS added to both accounts.");
          }, 100);

        } catch (error) {
          console.error("Error paying TS:", error);
          alert("Verification Successful, but there was a delay updating the Trust Score.");
        }

      } else {
        alert("Invalid PIN. Verification failed.");
      }
    };

    return (
      <div className="max-w-4xl mx-auto mt-10 text-center space-y-6">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm font-bold uppercase mb-8">← Back to Trades</button>
        
        <div className="bg-green-500/10 border border-green-500 rounded-2xl p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-pulse" />
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Meetup Initiated</h2>
          <p className="text-green-400 font-bold mb-8">Secure Exchange Protocol Active</p>
          {/* URGENCY ALERT BOX */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 flex items-center justify-between shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-red-400 font-bold text-xs uppercase tracking-widest">Protocol Expires In</span>
            </div>
            <span className="text-red-400 font-black font-mono text-xl tracking-wider">{meetupTimeLeft}</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-black/50 rounded-xl p-6 text-left border border-white/10 flex flex-col justify-between">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Target Location</p>
                <p className="text-white font-bold text-lg mb-4">📍 {roomState.safe_zone_selected}</p>
                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Opponent</p>
                <p className="text-white font-bold text-lg">👤 {opponentName}</p>
              </div>
              <a 
                href={googleMapsLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-colors border border-white/20"
              >
                Open Google Maps
              </a>
            </div>

            <div className="bg-fi-accent/10 rounded-xl p-6 text-center border border-fi-accent/30 flex flex-col justify-center items-center">
              <p className="text-fi-accent text-xs font-bold uppercase tracking-widest mb-4">
                {isInitiator ? "Your Handshake PIN" : "Verify Opponent"}
              </p>
              
              {isInitiator ? (
                <>
                  <div className="bg-black border-2 border-fi-accent border-dashed rounded-xl p-4 w-full mb-4">
                    <span className="text-4xl font-mono font-black text-white tracking-widest">{verificationPin}</span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Show this code to <span className="text-white font-bold">{opponentName}</span> to release funds/items.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-full mb-4 mt-2">
                    <button 
                      onClick={handleVerifyTrade}
                      className="w-full py-5 bg-fi-accent text-black font-black text-sm uppercase tracking-widest rounded-xl hover:bg-yellow-500 transition-colors shadow-[0_0_20px_rgba(255,215,0,0.3)]"
                    >
                      Scan / Enter PIN
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Input the 5-digit code from <span className="text-white font-bold">{opponentName}</span>'s screen.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- NEGOTIATION PHASE UI ---
  return (
    <div className="max-w-6xl mx-auto h-[80vh] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest">← Leave Room</button>
        <div className="flex items-center gap-4">
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> P2P SECURE CONNECTION
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-[#111113] border border-white/10 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Meetup Location</p>
              <select 
                className="bg-black border border-white/10 text-white text-sm rounded px-3 py-2 outline-none focus:border-fi-accent"
                value={roomState.safe_zone_selected || ''}
                onChange={(e) => updateSafeZone(e.target.value)}
                disabled={myLock} 
              >
                <option value="" disabled>Select Safe Zone...</option>
                <option value="Tel Aviv (Dizengoff Center)">Tel Aviv (Dizengoff Center)</option>
                <option value="Rishon LeZion (Zahav Mall)">Rishon LeZion (Zahav Mall)</option>
                <option value="Jerusalem (Malha Mall)">Jerusalem (Malha Mall)</option>
              </select>
            </div>
            <div className="text-right">
              <button 
                onClick={toggleLock}
                className={`px-8 py-3 font-black text-sm uppercase rounded transition-all ${myLock ? 'bg-fi-accent text-black shadow-[0_0_20px_rgba(255,215,0,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {myLock ? 'LOCKED 🔒' : 'LOCK TRADE'}
              </button>
            </div>
          </div>

          <div className="flex-1 bg-[#111113] border border-white/10 rounded-xl relative flex flex-col overflow-hidden">
            {countdown !== null && (
              <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center">
                <h2 className="text-fi-accent font-black text-2xl uppercase tracking-widest mb-4">Initializing Smart Contract</h2>
                <span className="text-9xl font-black text-white">{countdown}</span>
              </div>
            )}

            <div className={`flex-1 border-b border-white/10 p-6 flex flex-col ${opponentLock ? 'bg-fi-accent/5' : ''} transition-colors overflow-y-auto`}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{opponentName}'s Offer</span>
                {opponentLock && <span className="text-[10px] bg-fi-accent text-black font-black px-2 py-1 rounded uppercase">Ready</span>}
              </div>
              <div className="flex-1 flex flex-col gap-3 items-start">
                {opponentAssets.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl min-h-[100px]">
                    <p className="text-gray-600 font-bold text-sm uppercase tracking-widest">Waiting...</p>
                  </div>
                ) : (
                  opponentAssets.map((asset, idx) => renderAssetCard(asset, false, idx))
                )}
              </div>
            </div>

            <div className={`flex-1 p-6 flex flex-col ${myLock ? 'bg-fi-accent/5' : ''} transition-colors overflow-y-auto`}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">My Offer</span>
                {!myLock && (
                  <button onClick={() => setIsVaultOpen(true)} className="px-3 py-1.5 bg-white/10 text-white font-bold text-[10px] uppercase rounded hover:bg-white/20 transition-colors">
                    + Add from Vault
                  </button>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-3 items-start">
                 {myAssets.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl min-h-[100px]">
                    <p className="text-gray-600 font-bold text-sm uppercase tracking-widest">Table is empty</p>
                  </div>
                ) : (
                  myAssets.map((asset, idx) => renderAssetCard(asset, true, idx))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#111113] border border-white/10 rounded-xl flex flex-col overflow-hidden h-[600px] lg:h-auto">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">Encrypted Chat</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <p className="text-gray-600 text-xs text-center font-bold uppercase mt-10">System: Messages are logged.</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.sender_name === currentUser ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">{msg.sender_name}</span>
                  <div className={`px-3 py-2 rounded-lg text-sm ${msg.sender_name === currentUser ? 'bg-fi-accent text-black font-medium rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none'}`}>
                    {msg.message_content}
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-black/50 flex gap-2">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Negotiate terms..."
              className="flex-1 bg-transparent text-white text-sm outline-none px-2 placeholder-gray-600"
              disabled={roomState.status === 'meetup_pending'}
            />
            <button type="submit" disabled={!chatInput.trim()} className="p-2 text-fi-accent disabled:opacity-30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>
      </div>

      <VaultSelectorModal isOpen={isVaultOpen} onClose={() => setIsVaultOpen(false)} onAssetsSelected={handleAssetsSelected} excludedIds={myAssets.map(a => a.id)} />
    </div>
  );
}