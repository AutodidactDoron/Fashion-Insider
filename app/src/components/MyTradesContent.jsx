import React, { useState, useEffect } from 'react';
import VaultSelectorModal from './VaultSelectorModal';
import { supabase } from '../supabaseClient'; 

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function MyTradesContent() {
  const [currentUser, setCurrentUser] = useState({ id: null, name: null });
  const [profilesMap, setProfilesMap] = useState({});
  const [trades, setTrades] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_name')
          .eq('id', user.id)
          .single();

        const userName = profile?.user_name || user.user_metadata?.user_name;
        
        if (userName) {
          setCurrentUser({ id: user.id, name: userName });
          fetchMyTrades(user.id, userName);
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    initPage();
  }, []);

  useEffect(() => {
    if (!currentUser.id) return;

    const handleForceRefresh = () => fetchMyTrades(currentUser.id, currentUser.name);
    window.addEventListener('refresh_trades', handleForceRefresh);

    const tradesSubscription = supabase
      .channel('my_active_trades')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trade_rooms' },
        () => {
          fetchMyTrades(currentUser.id, currentUser.name);
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('refresh_trades', handleForceRefresh);
      supabase.removeChannel(tradesSubscription);
    };
  }, [currentUser.id, currentUser.name]);

  const fetchMyTrades = async (userId, userName) => {
    const { data: tradesData, error } = await supabase
      .from('trade_rooms')
      .select('*')
      .or(`initiator_name.eq.${userName},responder_name.eq.${userName},initiator_name.eq.${userId},responder_name.eq.${userId}`) 
      .order('updated_at', { ascending: false });

    if (error) {
      console.error("Fetch Trades Error:", error);
    } else if (tradesData) {
      const uniqueUUIDs = new Set();
      tradesData.forEach(trade => {
        if (UUID_REGEX.test(trade.initiator_name)) uniqueUUIDs.add(trade.initiator_name);
        if (UUID_REGEX.test(trade.responder_name)) uniqueUUIDs.add(trade.responder_name);
      });

      const map = {};
      const validUUIDs = Array.from(uniqueUUIDs);

      if (validUUIDs.length > 0) {
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('id, user_name')
          .in('id', validUUIDs);
          
        if (profilesData) {
          profilesData.forEach(profile => {
            map[profile.id] = profile.user_name;
          });
        }
      }
      
      setProfilesMap(map);
      setTrades(tradesData);
      setActiveRoom(prev => prev ? tradesData.find(t => t.id === prev.id) || null : null);
    }
    setIsLoading(false);
  };

  if (isLoading) return <div className="text-white p-8 font-bold tracking-widest uppercase">Decrypting Trade Logs...</div>;
  if (!currentUser.id) return <div className="text-white p-8">Authentication Required.</div>;

  return activeRoom ? (
    <TradeRoomEngine 
      room={activeRoom} 
      currentUser={currentUser} 
      profilesMap={profilesMap}
      onBack={() => setActiveRoom(null)} 
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
            const isInitiator = trade.initiator_name === currentUser.name || trade.initiator_name === currentUser.id;
            const opponentRaw = isInitiator ? trade.responder_name : trade.initiator_name;
            const opponentName = profilesMap[opponentRaw] || (UUID_REGEX.test(opponentRaw) ? opponentRaw.substring(0, 8) : opponentRaw);
            
            let statusColor = 'text-fi-accent';
            if (trade.status === 'meetup_pending') statusColor = 'text-green-400';
            if (trade.status === 'completed') statusColor = 'text-blue-400';
            if (trade.status === 'canceled') statusColor = 'text-red-500';

            return (
              <div key={trade.id} className="bg-[#111113] border border-white/10 rounded-xl p-6 flex justify-between items-center hover:border-white/20 transition-colors">
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${statusColor} bg-white/5 px-2 py-1 rounded`}>
                    {trade.status.replace('_', ' ')}
                  </span>
                  <h3 className="text-white font-bold mt-3 text-lg">Trade vs. {opponentName}</h3>
                  <p className="text-gray-500 text-xs mt-1">Room ID: {trade.id.split('-')[0]}</p>
                </div>
                <button 
                  onClick={() => setActiveRoom(trade)}
                  className="px-6 py-3 bg-white !text-black !font-black text-xs rounded uppercase hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]"
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
// 🛡️ THE TRADE ROOM ENGINE (Heartbeat + Realtime)
// ==========================================
function TradeRoomEngine({ room, currentUser, profilesMap, onBack }) {
  const [roomState, setRoomState] = useState(room);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [meetupTimeLeft, setMeetupTimeLeft] = useState('--H --M');
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    setRoomState(room);
  }, [room]);

  useEffect(() => {
    const roomSocket = supabase
      .channel(`live_room_${roomState.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trade_rooms', filter: `id=eq.${roomState.id}` },
        (payload) => {
          console.log("⚡ Socket Sync:", payload.new);
          setRoomState(payload.new);
        }
      )
      .subscribe();

    const heartbeat = setInterval(async () => {
      const { data, error } = await supabase.from('trade_rooms').select('*').eq('id', roomState.id).single();
      if (data && !error) {
        setRoomState(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) return data;
          return prev;
        });
      }
    }, 3000); 

    return () => {
      supabase.removeChannel(roomSocket);
      clearInterval(heartbeat);
    };
  }, [roomState.id]);

  useEffect(() => {
    const fetchWalletLiquidity = async () => {
      const { data } = await supabase.from('user_profiles').select('credits').eq('id', currentUser.id).single();
      if (data) setWalletBalance(data.credits || 0);
    };
    fetchWalletLiquidity();
  }, [currentUser.id, roomState.status]);

  useEffect(() => {
    fetchMessages();
    
    const fetchLatestRoom = async () => {
      const { data } = await supabase.from('trade_rooms').select('*').eq('id', roomState.id).single();
      if (data) {
        if (data.status === 'completed' && roomState.status !== 'completed') {
          window.dispatchEvent(new Event('force_ts_refresh'));
          alert("Verification Successful! Trade Complete. Trust Score and Wallet updated.");
        }
        setRoomState(data);
      }
    };
    fetchLatestRoom();

    const handleLocalRoomUpdates = () => {
      fetchMessages();
      fetchLatestRoom();
    };
    
    window.addEventListener('refresh_trades', handleLocalRoomUpdates);

    return () => { 
      window.removeEventListener('refresh_trades', handleLocalRoomUpdates);
    };
  }, [roomState.id, roomState.status]);

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

    updateTimer(); 
    const interval = setInterval(updateTimer, 60000); 
    
    return () => clearInterval(interval);
  }, [roomState.status, roomState.meetup_deadline]);

  const isInitiator = roomState.initiator_name === currentUser.name || roomState.initiator_name === currentUser.id;
  const opponentRaw = isInitiator ? roomState.responder_name : roomState.initiator_name;
  const opponentName = profilesMap[opponentRaw] || (UUID_REGEX.test(opponentRaw) ? opponentRaw.substring(0, 8) : opponentRaw);
  
  const myLock = isInitiator ? roomState.initiator_locked : roomState.responder_locked;
  const opponentLock = isInitiator ? roomState.responder_locked : roomState.initiator_locked;

  const myAssets = (isInitiator ? roomState.initiator_assets : roomState.responder_assets) || [];
  const opponentAssets = (isInitiator ? roomState.responder_assets : roomState.initiator_assets) || [];

  const myCredits = (isInitiator ? roomState.initiator_credits : roomState.responder_credits) || 0;
  const opponentCredits = (isInitiator ? roomState.responder_credits : roomState.initiator_credits) || 0;

  useEffect(() => {
    if (myLock && opponentLock && roomState.status !== 'meetup_pending' && roomState.status !== 'completed' && roomState.status !== 'canceled') {
      let counter = 5;
      setCountdown(counter);
      const timer = setInterval(async () => {
        counter -= 1;
        setCountdown(counter);
        if (counter === 0) {
          clearInterval(timer);
          if (isInitiator) {
            try {
              const { data, error } = await supabase.rpc('initiate_meetup_escrow', { p_room_id: roomState.id });
              
              if (error) {
                console.error("Escrow DB Error:", error);
                alert("System Alert: Failed to execute Smart Contract. See console.");
                setCountdown(null); 
              } else if (data === false) {
                console.warn("Escrow returned false. Room might already be locked.");
                setCountdown(null);
              } else {
                window.dispatchEvent(new Event('refresh_trades'));
              }
            } catch (err) {
              console.error("Escrow Network Error:", err);
              setCountdown(null);
            }
          }
        }
      }, 1000);
      return () => clearInterval(timer);
    } else if (!myLock || !opponentLock) {
      setCountdown(null);
    }
  }, [myLock, opponentLock, roomState.status, isInitiator, roomState.id]);

  const fetchMessages = async () => {
    const { data } = await supabase.from('trade_messages').select('*').eq('room_id', roomState.id).order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    await supabase.from('trade_messages').insert([{ 
      room_id: roomState.id, 
      sender_name: currentUser.name || currentUser.id, 
      message_content: chatInput 
    }]);
    setChatInput('');
  };

  const toggleLock = async () => {
    if (!roomState.safe_zone_selected) return alert("Select a Safe Zone first.");
    
    const totalAssetsInRoom = myAssets.length + opponentAssets.length;
    if (totalAssetsInRoom === 0) {
      if (myCredits > 0 || opponentCredits > 0) {
        return alert("TRADE BLOCKED: A secure exchange must involve at least one physical asset (clothing/shoes). Credits-only transfers are disabled.");
      }
      return alert("Trade table is completely empty.");
    }

    if (!myLock && myCredits > walletBalance) return alert(`Insufficient funds. You only have ${walletBalance} credits.`);
    
    const newLockState = !myLock;
    const updateField = isInitiator ? { initiator_locked: newLockState } : { responder_locked: newLockState };
    
    const payload = { ...updateField, updated_at: new Date().toISOString() };
    setRoomState(prev => ({ ...prev, ...payload }));
    await supabase.from('trade_rooms').update(payload).eq('id', roomState.id);
  };

  const updateSafeZone = async (zone) => {
    const payload = { safe_zone_selected: zone, initiator_locked: false, responder_locked: false, updated_at: new Date().toISOString() };
    setRoomState(prev => ({ ...prev, ...payload }));
    await supabase.from('trade_rooms').update(payload).eq('id', roomState.id);
  };

  const updateMyAssets = async (newAssetsArray) => {
    const targetField = isInitiator ? 'initiator_assets' : 'responder_assets';
    const payload = { [targetField]: newAssetsArray, initiator_locked: false, responder_locked: false, updated_at: new Date().toISOString() };
    setRoomState(prev => ({ ...prev, ...payload }));
    await supabase.from('trade_rooms').update(payload).eq('id', roomState.id);
  };

  const updateMyCredits = async (amount) => {
    const val = Math.max(0, parseInt(amount) || 0);
    if (val > walletBalance) {
      alert(`Liquidity Error: Max balance is ${walletBalance}C`);
      return;
    }
    
    const targetField = isInitiator ? 'initiator_credits' : 'responder_credits';
    const payload = { [targetField]: val, initiator_locked: false, responder_locked: false, updated_at: new Date().toISOString() };
    
    setRoomState(prev => ({ ...prev, ...payload }));
    const { error } = await supabase.from('trade_rooms').update(payload).eq('id', roomState.id);
    if (error) console.error("Database Update Error:", error);
  };

  const handleCancelTrade = async () => {
    const confirmCancel = window.confirm("🚨 תשומת לב פאונדר: ביטול פרוטוקול יגרור קנס מיידי של 50 קרדיטים ופגיעה של 2- במוניטין שלך. הצד השני יפוצה באופן אוטומטי. האם להמשיך?");
    if (!confirmCancel) return;

    const { error } = await supabase.rpc('cancel_secure_trade', {
      p_room_id: roomState.id,
      p_canceler_id: currentUser.id
    });

    if (error) {
      console.error("Cancelation Failed:", error);
      alert("Failed to abort trade protocol.");
    } else {
      alert("Protocol Terminated. Assets released, penalty executed.");
      window.dispatchEvent(new Event('refresh_trades'));
      window.dispatchEvent(new Event('update_global_credits'));
      window.dispatchEvent(new Event('force_ts_refresh'));
      onBack();
    }
  };

  const handleAssetsSelected = (newAssets) => { updateMyAssets([...myAssets, ...newAssets]); };
  const handleRemoveAsset = (idxToRemove) => { updateMyAssets(myAssets.filter((_, idx) => idx !== idxToRemove)); };

  // ⚡ THE HOVER ENGINE: Asset Card UI
  // ⚡ THE HOVER ENGINE V2: Inline Intelligence Reveal
  const renderAssetCard = (asset, isMine, idx) => {
    const conditionColor = asset.condition === 'DS' ? 'bg-fi-accent/10 text-fi-accent border-fi-accent/20' : 
                           asset.condition === 'VNDS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                           'bg-gray-500/10 text-gray-400 border-gray-500/20';
                           
    return (
      <div key={idx} className="bg-black/60 border border-white/10 p-3 rounded-lg flex flex-col shadow-md w-full shrink-0 group cursor-help hover:border-fi-accent/50 transition-colors">
        
        {/* THE MAIN ROW */}
        <div className="flex items-center gap-3 w-full">
          {asset.stock_image_url && (
            <img src={asset.stock_image_url} alt="" className="w-12 h-12 object-contain bg-white rounded-md p-1 shrink-0 group-hover:scale-105 transition-transform" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white text-xs font-bold truncate">{asset.name}</span>
              {/* Constant Exposure: Size & Condition */}
              {(asset.size || asset.condition) && (
                <div className="flex items-center gap-1 shrink-0">
                  {asset.size && <span className="bg-white/10 text-gray-300 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold">{asset.size}</span>}
                  {asset.condition && <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest border ${conditionColor}`}>{asset.condition}</span>}
                </div>
              )}
            </div>
            <p className="text-gray-500 text-[10px] uppercase truncate font-bold tracking-widest">{asset.brand || 'Item'}</p>
          </div>

          {isMine && !myLock && roomState.status !== 'completed' && (
            <button onClick={(e) => { e.stopPropagation(); handleRemoveAsset(idx); }} className="text-gray-600 hover:text-red-400 transition-colors p-2 shrink-0 z-10 relative bg-white/5 hover:bg-red-500/10 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* ⚡ THE INTELLIGENCE REVEAL (Dynamic Height Transition) */}
        <div className="w-full max-h-0 overflow-hidden opacity-0 group-hover:max-h-[500px] group-hover:opacity-100 transition-all duration-500 ease-in-out">
          <div className="border-t border-white/10 mt-3 pt-3 grid grid-cols-2 gap-2">
            <div className="bg-black/50 p-2 rounded border border-white/5 flex flex-col justify-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Size</p>
              <p className="text-white text-xs font-mono font-bold">{asset.size || 'N/A'}</p>
            </div>
            <div className="bg-black/50 p-2 rounded border border-white/5 flex flex-col justify-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Condition</p>
              <p className={`text-[10px] font-black mt-0.5 uppercase ${asset.condition === 'DS' ? 'text-fi-accent' : asset.condition === 'VNDS' ? 'text-blue-400' : 'text-gray-400'}`}>{asset.condition || 'N/A'}</p>
            </div>
            <div className="bg-black/50 p-2 rounded border border-white/5 col-span-2 flex justify-between items-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Est. Market Value</p>
              <p className="text-white text-sm font-black tracking-wider">{asset.marketValue ? `${asset.marketValue.toLocaleString()} CR` : 'N/A'}</p>
            </div>
          </div>
        </div>
        
      </div>
    );
  };

  if (roomState.status === 'completed') {
    return (
      <div className="max-w-2xl mx-auto mt-10 text-center space-y-6">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm font-bold uppercase mb-8">← Back to Trades</button>
        <div className="bg-blue-500/10 border border-blue-500 rounded-2xl p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Trade Completed</h2>
          <p className="text-blue-400 font-bold mb-8">Digital Receipt Signed</p>
          <div className="flex justify-center gap-4 mb-6">
             <span className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded font-black uppercase text-sm">+ Trust Score Rewarded</span>
          </div>
          <p className="text-gray-500 text-xs">Transaction ID: {roomState.id}</p>
        </div>
      </div>
    );
  }

  if (roomState.status === 'canceled') {
    return (
      <div className="max-w-2xl mx-auto mt-10 text-center space-y-6">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm font-bold uppercase mb-8">← Back to Trades</button>
        <div className="bg-red-500/10 border border-red-500 rounded-2xl p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Protocol Aborted</h2>
          <p className="text-red-400 font-bold mb-4">Trade Canceled By User</p>
          <p className="text-gray-500 text-xs">Escrow broken. Assets returned to origin.</p>
        </div>
      </div>
    );
  }

  if (roomState.status === 'meetup_pending') {
    const googleMapsLink = `http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(roomState.safe_zone_selected)}`;
    const verificationPin = roomState.id.split('-')[0].toUpperCase().substring(0, 5);

    const handleVerifyTrade = async () => {
      const userPin = prompt(`Enter the 5-digit verification PIN from ${opponentName}'s screen:`);
      if (!userPin) return;

      if (userPin.toUpperCase() === verificationPin) {
        try {
          const { error: settlementError } = await supabase.rpc('finalize_secure_trade', { p_room_id: roomState.id });
          if (settlementError) return alert("Smart Contract execution failed. Assets were not moved.");
          
          window.dispatchEvent(new Event('refresh_trades'));
          window.dispatchEvent(new Event('update_global_credits'));
          window.dispatchEvent(new Event('force_ts_refresh'));

        } catch (error) {
          console.error("Error paying TS:", error);
          alert("Verification Successful, but network failed to finalize status.");
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

          <div className="mt-8 border-t border-white/5 pt-6 flex justify-start">
            <button
              onClick={handleCancelTrade}
              className="px-4 py-2.5 bg-red-950/20 hover:bg-red-950/50 text-red-400 border border-red-900/30 hover:border-red-500/40 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-150"
            >
              Abort Protocol (⚠️ 50C Penalty)
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100dvh-120px)] min-h-[600px] flex flex-col pb-4">
      
      <div className="flex justify-between items-center mb-6 shrink-0">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest">← Leave Room</button>
        <div className="flex items-center gap-4">
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> P2P SECURE CONNECTION
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <div className="bg-[#111113] border border-white/10 rounded-xl p-4 flex justify-between items-center shrink-0">
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

          <div className="flex-1 bg-[#111113] border border-white/10 rounded-xl relative flex flex-col md:flex-row overflow-hidden min-h-0">
            {countdown !== null && (
              <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center">
                <h2 className="text-fi-accent font-black text-2xl uppercase tracking-widest mb-4">Initializing Smart Contract</h2>
                <span className="text-9xl font-black text-white">{countdown}</span>
              </div>
            )}

            <div className={`flex-1 border-b md:border-b-0 md:border-r border-white/10 p-4 flex flex-col ${opponentLock ? 'bg-fi-accent/5' : ''} transition-colors overflow-hidden min-h-0`}>
              <div className="flex justify-between items-center mb-4 shrink-0">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{opponentName}'s Offer</span>
                {opponentLock && <span className="text-[10px] bg-fi-accent text-black font-black px-2 py-1 rounded uppercase">Ready</span>}
              </div>
              
              {opponentCredits > 0 && (
                <div className="mb-4 bg-fi-accent/10 border border-fi-accent/30 rounded-lg p-3 flex justify-between items-center shrink-0">
                   <span className="text-fi-accent font-bold text-xs uppercase">Credits Offered</span>
                   <span className="text-white font-mono font-black text-lg">{opponentCredits} C</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3 min-h-0 relative">
                {opponentAssets.length === 0 && opponentCredits === 0 ? (
                  <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl min-h-[80px]">
                    <p className="text-gray-600 font-bold text-sm uppercase tracking-widest">Waiting...</p>
                  </div>
                ) : (
                  opponentAssets.map((asset, idx) => renderAssetCard(asset, false, idx))
                )}
              </div>
            </div>

            <div className={`flex-1 p-4 flex flex-col ${myLock ? 'bg-fi-accent/5' : ''} transition-colors overflow-hidden min-h-0`}>
              <div className="flex justify-between items-center mb-4 shrink-0">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">My Offer</span>
                {!myLock && (
                  <button onClick={() => setIsVaultOpen(true)} className="px-3 py-1.5 bg-white/10 text-white font-bold text-[10px] uppercase rounded hover:bg-white/20 transition-colors shrink-0">
                    + Add from Vault
                  </button>
                )}
              </div>

              <CreditInputField 
                myCredits={myCredits}
                walletBalance={walletBalance}
                myLock={myLock}
                onBalanceSync={(newVal) => updateMyCredits(newVal)}
              />

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3 min-h-0 relative">
                 {myAssets.length === 0 && myCredits === 0 ? (
                  <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl min-h-[80px]">
                    <p className="text-gray-600 font-bold text-sm uppercase tracking-widest">Table is empty</p>
                  </div>
                ) : (
                  myAssets.map((asset, idx) => renderAssetCard(asset, true, idx))
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="bg-[#111113] border border-white/10 rounded-xl flex flex-col overflow-hidden h-[400px] lg:h-full min-h-0">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2 shrink-0">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">Encrypted Chat</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <p className="text-gray-600 text-xs text-center font-bold uppercase mt-10">System: Messages are logged.</p>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_name === currentUser.name || msg.sender_name === currentUser.id;
                const senderDisplayName = profilesMap[msg.sender_name] || (UUID_REGEX.test(msg.sender_name) ? msg.sender_name.substring(0, 8) : msg.sender_name);

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">{senderDisplayName}</span>
                    <div className={`px-3 py-2 rounded-lg text-sm ${isMe ? 'bg-fi-accent text-black font-medium rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none'}`}>
                      {msg.message_content}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-black/50 flex gap-2 shrink-0">
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

function CreditInputField({ myCredits, walletBalance, myLock, onBalanceSync }) {
  const [localValue, setLocalValue] = useState(myCredits);
  const [isSaved, setIsSaved] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(myCredits);
    }
  }, [myCredits, isFocused]);

  const executeTransaction = (amount) => {
    let parsed = Math.max(0, parseInt(amount) || 0);
    if (parsed > walletBalance) {
      alert(`Liquidity Error: Max balance is ${walletBalance}C`);
      parsed = walletBalance;
      setLocalValue(walletBalance);
    }
    
    onBalanceSync(parsed);
    
    if (parsed > 0) {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 1500);
    }
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    executeTransaction(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur(); 
    }
  };

  return (
    <div className={`mb-4 bg-black border ${isSaved ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : myCredits > 0 ? 'border-fi-accent/50' : 'border-white/10'} rounded-lg p-3 flex justify-between items-center focus-within:border-fi-accent transition-all duration-300 shrink-0`}>
       <div className="flex flex-col">
         <span className={`font-bold text-[10px] uppercase tracking-widest transition-colors ${isSaved ? 'text-green-500' : myCredits > 0 ? 'text-fi-accent' : 'text-gray-400'}`}>
           {isSaved ? '✓ FUNDS SECURED' : myCredits > 0 ? 'FUNDS ON TABLE' : 'ADD CREDITS'}
         </span>
         <span className="text-[9px] text-gray-600 font-mono mt-0.5">Wallet: {walletBalance} CR</span>
       </div>
       <div className="flex items-center gap-2">
         <input 
           type="number"
           min="0"
           max={walletBalance}
           disabled={myLock}
           value={localValue === 0 ? '' : localValue}
           onFocus={() => setIsFocused(true)}
           onChange={(e) => setLocalValue(e.target.value)}
           onBlur={handleBlur}
           onKeyDown={handleKeyDown}
           placeholder="0"
           className={`w-24 bg-transparent text-right font-mono font-black text-lg outline-none placeholder-gray-700 transition-colors ${myCredits > 0 && !isSaved ? 'text-fi-accent drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]' : 'text-white'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
         />
         <span className={`font-black text-sm transition-colors ${myCredits > 0 ? 'text-fi-accent' : 'text-gray-500'}`}>CR</span>
       </div>
    </div>
  );
}