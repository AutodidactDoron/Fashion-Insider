import React, { useState, useEffect } from 'react';
import VaultSelectorModal from './VaultSelectorModal';
import { supabase } from '../supabaseClient'; 

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ⚡ SYSTEM CONSTANTS
const PLATFORM_FEE = 100; 
const REQUIRED_RADIUS_METERS = 30; // ⚡ דיוק מקסימלי: 15 מטר בלבד. חנייה כבר לא תעבוד.

const SAFE_ZONES_GEO = {
  "Tel Aviv (Azrieli Center)": { lat: 32.074465, lng: 34.792211, label: "Main Entrance (Begin Rd Security)" },
  "Rishon LeZion (Zahav Mall)": { lat: 31.990604, lng: 34.774915, label: "Main Entrance (Saharov 21 Security)" },
  "Jerusalem (Malha Mall)": { lat: 31.751400, lng: 35.187300, label: "Train Station Bridge Security" },
  "Haifa (Grand Canyon Mall)": { lat: 32.787600, lng: 35.011800, label: "Main Entrance Gate D Security" },
  "Be'er Sheva (Negev Mall)": { lat: 31.241500, lng: 34.797200, label: "Main Entrance Security" },
  "Rehovot (Kaplan Hospital)": { lat: 31.87215372293834, lng: 34.813754347036415, label: "Main Entrance Gate (Pasternak St Security)" } // ⚡ מתוקן כירורגית לשער הראשי
,
  // --- 5 ה-Safe Zones הציבוריים והמפורסמים (מתוקנים) ---
  "Tel Aviv (Dizengoff Center - Gate 3)": { lat: 32.0778, lng: 34.7744, label: "Gate 3 Security (Outside)" },
  "Jerusalem (Central Bus Station)": { lat: 31.7891, lng: 35.2023, label: "Main Entrance (Jaffa Rd Security)" },
  "Rishon LeZion (Cinema City Plaza)": { lat: 31.9796, lng: 34.7741, label: "Main Entrance (Outside Near Security)" },
  "Be'er Sheva (Soroka Hospital)": { lat: 31.2464, lng: 34.8016, label: "Main Gate Security" },
  "Haifa (Technion Gate - Main)": { lat: 32.7766, lng: 35.0211, label: "Security Entrance" },
  "Rehovot (Ofer Mall)": { lat: 31.8933457, lng: 34.8070274, label: "Main Entrance (Floor 2)" }
};

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
      
      if (window.location.state && window.location.state.autoOpenRoomId) {
        const roomToOpen = tradesData.find(t => t.id === window.location.state.autoOpenRoomId);
        if (roomToOpen) {
          setActiveRoom(roomToOpen);
          window.history.replaceState({}, document.title);
        }
      } else {
        setActiveRoom(prev => prev ? tradesData.find(t => t.id === prev.id) || null : null);
      }
    }
    setIsLoading(false);
  };

  // ⚡ DYNAMIC ENTRY GATE: חינמי כברירת מחדל, חוסם רק אם יש Cooldown
  const handleEnterRoomRequest = async (trade) => {
    setIsLoading(true);
    try {
      // ⚡ השרת עושה את החישוב הכבד לפי מזהה החדר בלבד
      const { data, error } = await supabase.rpc('check_room_entry_requirements', { 
        p_room_id: trade.id, 
        p_user_id: currentUser.id 
      });
      
      if (error) throw error;
      
      const requiresFee = data && data.length > 0 ? data[0].requires_fee : false;

      // חסימה רק אם הופעל Cooldown ואין מספיק יתרה לקנס
      if (requiresFee && currentUser?.credits < 100) {
         alert(`Liquidity Gate Blocked: High-Frequency Cooldown Active. You need 100 CR to access this specific terminal.`);
         return;
      }
      
      // כניסה מאושרת
      setActiveRoom(trade);
    } catch (err) {
      console.error(err);
      alert('Terminal Error: Could not verify entry protocol.');
    } finally {
      setIsLoading(false);
    }
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
            if (trade.status === 'abort_pending') statusColor = 'text-yellow-400';
            if (trade.status === 'completed') statusColor = 'text-blue-400';
            if (trade.status === 'canceled' || trade.status === 'aborted_mutually' || trade.status === 'admin_resolved') statusColor = 'text-red-500';

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
                  onClick={() => handleEnterRoomRequest(trade)} // ⚡ THE FIX: הפנייה לשומר הסף הפיננסי
                  className="px-6 py-3 bg-white !text-black !font-black text-xs rounded uppercase hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  {['completed', 'canceled', 'aborted_mutually', 'admin_resolved'].includes(trade.status) ? 'View Receipt' : 'Enter Room'}
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
function TradeRoomEngine({ room, currentUser, profilesMap, onBack }) {
  const [roomState, setRoomState] = useState(room);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [meetupTimeLeft, setMeetupTimeLeft] = useState('--H --M');
  const [walletBalance, setWalletBalance] = useState(0);
  
  const [isProcessingAbort, setIsProcessingAbort] = useState(false);
  
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [hasPendingReport, setHasPendingReport] = useState(false);

  const [userLocation, setUserLocation] = useState(null);
  const [distanceToZone, setDistanceToZone] = useState(null);
  const [gpsError, setGpsError] = useState('');

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
          setRoomState(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_messages', filter: `room_id=eq.${roomState.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new]); 
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
    
    const checkPendingReport = async () => {
      const { count } = await supabase
        .from('trade_reports')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomState.id)
        .eq('reporter_name', currentUser.name || currentUser.id)
        .eq('status', 'pending_review');
        
      if (count > 0) setHasPendingReport(true);
    };
    checkPendingReport();

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
      checkPendingReport();
      fetchLatestRoom();
    };
    
    window.addEventListener('refresh_trades', handleLocalRoomUpdates);

    return () => { 
      window.removeEventListener('refresh_trades', handleLocalRoomUpdates);
    };
  }, [roomState.id, roomState.status]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; 
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
  };

  useEffect(() => {
    if (roomState.status !== 'meetup_pending') return;
    
    if (!navigator.geolocation) {
      setGpsError('GPS is not supported by your browser.');
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        
        const zone = SAFE_ZONES_GEO[roomState.safe_zone_selected];
        if (zone) {
          const dist = calculateDistance(latitude, longitude, zone.lat, zone.lng);
          setDistanceToZone(Math.round(dist));
          setGpsError('');
        }
      },
      (error) => {
        console.error("GPS Error:", error);
        setGpsError('Please enable Location Services to unlock the PIN.');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [roomState.status, roomState.safe_zone_selected]);

  useEffect(() => {
    if ((roomState.status !== 'meetup_pending' && roomState.status !== 'abort_pending') || !roomState.meetup_deadline) return;
    
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
    const lockedStatuses = ['meetup_pending', 'completed', 'canceled', 'aborted_mutually', 'abort_pending', 'disputed', 'admin_resolved'];
    
    if (myLock && opponentLock && !lockedStatuses.includes(roomState.status)) {
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
    
    const DLP_REGEX = /(\b05\d[-.\s]?\d{3}[-.\s]?\d{4}\b)|(\+972[-.\s]?5\d[-.\s]?\d{3}[-.\s]?\d{4}\b)|(whatsapp|ig|instagram|facebook|telegram|waze)/gi;
    const sanitizedText = chatInput.replace(DLP_REGEX, '***[REDACTED]***');

    await supabase.from('trade_messages').insert([{ 
      room_id: roomState.id, 
      sender_name: currentUser.name || currentUser.id, 
      message_content: sanitizedText 
    }]);
    setChatInput('');
  };

  const handleSubmitReport = async () => {
    if (!reportCategory) return alert("Please select a report category.");
    
    try {
      const { error } = await supabase.from('trade_reports').insert([{
        room_id: roomState.id,
        reporter_name: currentUser.name || currentUser.id,
        reported_name: opponentName,
        category: reportCategory,
        description: reportDetails
      }]);

      if (error) throw error;
      
      alert("Report successfully filed. Admin will review the chat logs.");
      setIsReportOpen(false);
      setReportCategory('');
      setReportDetails('');
      setHasPendingReport(true); 
    } catch (err) {
      console.error("Report Error:", err);
      alert("Failed to submit report. It might already exist.");
    }
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

    if (!myLock) {
      // ⚡ כאן הוסר ה-PLATFORM FEE מהדרישה
      if (walletBalance < myCredits) {
        return alert(`Insufficient liquidity. Required: ${myCredits}C (Offer). You have ${walletBalance}C.`);
      }
    }

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
    
    if ((val + PLATFORM_FEE) > walletBalance) {
      alert(`Liquidity Error: Max affordable offer is ${walletBalance - PLATFORM_FEE}C (Reserving ${PLATFORM_FEE}C for Platform Fee).`);
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

  const proposeMutualAbort = async () => {
    if (isProcessingAbort || roomState.status === 'abort_pending') return;
    setIsProcessingAbort(true);
    try {
      const { error } = await supabase
        .from('trade_rooms')
        .update({ 
          status: 'abort_pending',
          abort_requested_by: currentUser.name || currentUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomState.id);

      if (error) throw error;
      alert("Mutual Abort proposed. The other party must accept, or they will be penalized upon timeout.");
    } catch (err) {
      console.error("Abort Proposal Failed:", err);
      alert("Database Error: Failed to propose abort.");
    } finally {
      setIsProcessingAbort(false);
    }
  };

  const acceptMutualAbort = async () => {
    if (isProcessingAbort) return;
    setIsProcessingAbort(true);
    try {
      // ⚡ THE FIX: הפעלת החוזה החכם במקום עדכון טקסט קוסמטי
      const { error } = await supabase.rpc('accept_mutual_abort', {
        p_room_id: roomState.id
      });

      if (error) throw error;
      
      alert("Trade aborted mutually. Escrow unlocked and assets returned.");
      
      // ⚡ THE FIX: רענון גלובלי של כל האקוסיסטם כדי שהארנק והארון יתעדכנו מיידית
      window.dispatchEvent(new Event('refresh_trades'));
      window.dispatchEvent(new Event('update_global_credits'));
      window.dispatchEvent(new Event('force_ts_refresh'));
      onBack();
    } catch (err) {
      console.error("Abort Acceptance Failed:", err);
      alert("Smart Contract Error: Failed to release Escrow. Check console.");
    } finally {
      setIsProcessingAbort(false);
    }
  };

  const declineMutualAbort = async () => {
    if (isProcessingAbort) return;
    setIsProcessingAbort(true);
    try {
      const { error } = await supabase
        .from('trade_rooms')
        .update({ 
          status: 'meetup_pending', 
          abort_requested_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomState.id);
        
      if (error) throw error;
      alert("Abort declined. The trade protocol is active again.");
      window.dispatchEvent(new Event('refresh_trades'));
    } catch (err) {
      console.error("Decline Failed:", err);
      alert("Database Error: Failed to decline abort.");
    } finally {
      setIsProcessingAbort(false);
    }
  };

  const handleAssetsSelected = (newAssets) => { updateMyAssets([...myAssets, ...newAssets]); };
  const handleRemoveAsset = (idxToRemove) => { updateMyAssets(myAssets.filter((_, idx) => idx !== idxToRemove)); };

  // ⚡ THE SYSTEM REPORT MODAL WRAPPER
  const renderReportModal = () => (
    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 rounded-2xl">
      <div className="bg-[#111113] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-[0_0_30px_rgba(0,0,0,0.8)] text-left">
        <h3 className="text-red-500 font-black text-lg uppercase tracking-widest mb-4 border-b border-white/10 pb-4">Report {opponentName}</h3>
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Category</label>
            <select className="w-full bg-black border border-white/10 text-white text-sm rounded-lg px-3 py-3 outline-none" value={reportCategory} onChange={(e) => setReportCategory(e.target.value)}>
              <option value="" disabled>Select Reason...</option>
              <option value="No Show">No Show (Opponent ghosted meetup)</option>
              <option value="Scam Attempt">Scam / Fraud Attempt</option>
              <option value="Off-Platform Trading">Off-Platform Trading</option>
              <option value="Harassment">Harassment / Abuse</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Details (Optional)</label>
            <textarea className="w-full bg-black border border-white/10 text-white text-sm rounded-lg px-3 py-3 outline-none min-h-[100px] resize-none" placeholder="Provide context..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSubmitReport} className="flex-1 bg-red-900/20 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white font-black text-[10px] uppercase py-3 rounded">Submit Ticket</button>
          <button onClick={() => setIsReportOpen(false)} className="flex-1 text-gray-400 hover:text-white font-bold text-[10px] uppercase py-3 rounded">Cancel</button>
        </div>
      </div>
    </div>
  );
  
  const renderAssetCard = (asset, isMine, idx) => {
    const conditionColor = asset.condition === 'DS' ? 'bg-fi-accent/10 text-fi-accent border-fi-accent/20' : 
                           asset.condition === 'VNDS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                           'bg-gray-500/10 text-gray-400 border-gray-500/20';
                           
    return (
      <div key={idx} className="bg-black/60 border border-white/10 p-3 rounded-lg flex flex-col shadow-md w-full shrink-0 group cursor-help hover:border-fi-accent/50 transition-colors">
        <div className="flex items-center gap-3 w-full">
          {asset.stock_image_url && (
            <img src={asset.stock_image_url} alt="" className="w-12 h-12 object-contain bg-white rounded-md p-1 shrink-0 group-hover:scale-105 transition-transform" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white text-xs font-bold truncate">{asset.name}</span>
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

  // ⚡ 1. מסך סיום בהצלחה (Completed)
  if (roomState.status === 'completed') {
    return (
      <div className="max-w-2xl mx-auto mt-10 text-center space-y-6 relative">
        {/* 🛡️ כפתור דיווח מהיר בפינה */}
        <div className="absolute top-0 right-0 z-40">
          <button 
            onClick={() => setIsReportOpen(true)} 
            className="px-3 py-1.5 bg-red-950/20 hover:bg-red-500 text-red-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded border border-red-900/50 transition-all flex items-center gap-1.5"
          >
            Report User
          </button>
        </div>

        {/* ⚡ THE REPORT MODAL (מוזרק ישירות למסך הסיום כדי שיקפוץ בלחיצה) */}
        {isReportOpen && renderReportModal()}

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

  // ⚡ 2. מסך ביטול (canceled / aborted_mutually / admin_resolved)
  if (roomState.status === 'canceled' || roomState.status === 'aborted_mutually' || roomState.status === 'admin_resolved') {
    const isMutual = roomState.status === 'aborted_mutually';
    const isAdmin = roomState.status === 'admin_resolved';
    
    return (
      <div className="max-w-2xl mx-auto mt-10 text-center space-y-6 relative">
        {/* 🛡️ כפתור דיווח מהיר בפינה */}
        <div className="absolute top-0 right-0 z-40">
          <button 
            onClick={() => setIsReportOpen(true)} 
            className="px-3 py-1.5 bg-red-950/20 hover:bg-red-500 text-red-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded border border-red-900/50 transition-all flex items-center gap-1.5"
          >
            Report User
          </button>
        </div>

        {/* ⚡ THE REPORT MODAL (מוזרק ישירות למסך הביטול כדי שיקפוץ בלחיצה) */}
        {isReportOpen && renderReportModal()}

        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm font-bold uppercase mb-8">← Back to Trades</button>
        <div className={`bg-${isMutual ? 'yellow' : 'red'}-500/10 border border-${isMutual ? 'yellow' : 'red'}-500 rounded-2xl p-12 relative overflow-hidden`}>
          <div className={`absolute top-0 left-0 w-full h-1 bg-${isMutual ? 'yellow' : 'red'}-500`} />
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
            {isAdmin ? 'Admin Verdict Executed' : 'Protocol Aborted'}
          </h2>
          <p className={`text-${isMutual ? 'yellow' : 'red'}-400 font-bold mb-4`}>
            {isAdmin ? 'Trade forcibly closed by platform administration.' : isMutual ? 'Trade Mutually Canceled' : 'Trade Canceled By User'}
          </p>
          <p className="text-gray-500 text-xs">Escrow broken. Assets returned to origin.</p>
        </div>
      </div>
    );
  }

  if (roomState.status === 'abort_pending') {
    const didIRequest = roomState.abort_requested_by === (currentUser.name || currentUser.id);

    return (
      <div className="max-w-2xl mx-auto mt-10 text-center space-y-6 relative">
        {/* 🛡️ כפתור דיווח מהיר בפינה הימנית העליונה של מסך המתנה לביטול */}
        <div className="absolute top-0 right-0">
          <button 
            onClick={() => setIsReportOpen(true)} 
            className="px-3 py-1.5 bg-red-950/20 hover:bg-red-500 text-red-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded border border-red-900/50 transition-all flex items-center gap-1.5"
          >
            Report User
          </button>
        </div>

        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm font-bold uppercase mb-8">← Back to Trades</button>
        <div className="bg-yellow-500/10 border border-yellow-500 rounded-2xl p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 animate-pulse" />
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Mutual Abort Pending</h2>
          
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-8 inline-flex items-center gap-4 mx-auto">
             <span className="text-red-400 font-bold text-xs uppercase tracking-widest">Timeout In:</span>
             <span className="text-red-400 font-black font-mono text-xl">{meetupTimeLeft}</span>
          </div>

          {didIRequest ? (
            <>
              <p className="text-yellow-400 font-bold mb-4">Waiting for {opponentName} to accept...</p>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                They have the option to decline this request. If they decline, the trade will resume and you will have to proceed or execute a penalized Abort.
              </p>
            </>
          ) : (
            <>
              <p className="text-yellow-400 font-bold mb-6">{opponentName} requested to gracefully abort the trade without penalties.</p>
              
              <div className="flex justify-center gap-4 mb-6">
                <button
                  onClick={acceptMutualAbort}
                  disabled={isProcessingAbort}
                  className={`px-6 py-3 font-black uppercase tracking-widest rounded-lg transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)] ${isProcessingAbort ? 'bg-yellow-900/50 text-yellow-700 cursor-not-allowed shadow-none' : 'bg-yellow-500 text-black hover:bg-yellow-400'}`}
                >
                  {isProcessingAbort ? 'PROCESSING...' : 'ACCEPT (Free)'}
                </button>
                <button
                  onClick={declineMutualAbort}
                  disabled={isProcessingAbort}
                  className={`px-6 py-3 border font-black uppercase tracking-widest rounded-lg transition-all ${isProcessingAbort ? 'border-red-900/50 text-red-900 cursor-not-allowed' : 'border-red-500/50 text-red-400 hover:bg-red-500/20'}`}
                >
                  DECLINE
                </button>
              </div>
              
              <p className="text-gray-500 text-[10px] mt-4 uppercase tracking-widest">
                Declining will trap {opponentName} back into the active trade.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const targetZoneInfo = SAFE_ZONES_GEO[roomState.safe_zone_selected];
  const isMeetupPhase = roomState.status === 'meetup_pending';
  const isInRadius = distanceToZone !== null && distanceToZone <= REQUIRED_RADIUS_METERS;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100dvh-120px)] min-h-[600px] flex flex-col pb-4 relative">
      
      {/* ⚡ THE REPORT MODAL (OVERLAY) */}
      {isReportOpen && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            <h3 className="text-red-500 font-black text-lg uppercase tracking-widest mb-4 border-b border-white/10 pb-4">Report {opponentName}</h3>
            
            <p className="text-gray-400 text-xs mb-4">
              Filing a report sends the encrypted chat log to an Admin for review. <strong className="text-white">This does not freeze the trade timer.</strong> Please attempt to resolve the issue or use Mutual Abort if possible.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Category</label>
                <select 
                  className="w-full bg-black border border-white/10 text-white text-sm rounded-lg px-3 py-3 outline-none focus:border-red-500"
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                >
                  <option value="" disabled>Select Reason...</option>
                  <option value="No Show">No Show (Opponent ghosted meetup)</option>
                  <option value="Scam Attempt">Scam / Fraud Attempt</option>
                  <option value="Off-Platform Trading">Off-Platform Trading (Rules Violation)</option>
                  <option value="Harassment">Harassment / Abuse</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Details (Optional)</label>
                <textarea 
                  className="w-full bg-black border border-white/10 text-white text-sm rounded-lg px-3 py-3 outline-none focus:border-red-500 min-h-[100px] resize-none"
                  placeholder="Provide any additional context for the Admin..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleSubmitReport}
                className="flex-1 bg-red-900/20 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white font-black text-[10px] uppercase tracking-widest py-3 rounded transition-all"
              >
                Submit Ticket
              </button>
              <button 
                onClick={() => setIsReportOpen(false)}
                className="flex-1 bg-transparent text-gray-400 hover:text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

<div className="flex justify-between items-center mb-6 shrink-0">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest">← Leave Room</button>
        
        <div className="flex items-center gap-4">
          {/* ⚡ THE FIX: כפתור דיווח תמידי גם אם הטרייד הסתיים */}
          {hasPendingReport ? (
            <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-500 text-[9px] font-black uppercase tracking-widest rounded border border-yellow-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
              Ticket Pending
            </span>
          ) : (
            <button 
              onClick={() => setIsReportOpen(true)} 
              className="px-3 py-1.5 bg-red-950/20 hover:bg-red-500 text-red-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded border border-red-900/50 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Report User
            </button>
          )}

          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isMeetupPhase ? 'bg-green-500 animate-pulse' : roomState.status === 'completed' ? 'bg-blue-500' : 'bg-fi-accent'}`} /> 
            {roomState.status === 'completed' ? 'TRADE ARCHIVED' : isMeetupPhase ? 'MEETUP SECURED' : 'P2P SECURE CONNECTION'}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        
        <div className="lg:col-span-2 flex flex-col min-h-0">
          
          {isMeetupPhase ? (
            <div className="flex-1 bg-green-500/10 border border-green-500 rounded-xl p-8 relative overflow-y-auto custom-scrollbar flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-pulse" />
              
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Meetup Initiated</h2>
                    <p className="text-green-400 font-bold">Secure Exchange Protocol Active</p>
                  </div>
                  {/*hasPendingReport ? (
                    <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-500 text-[9px] font-black uppercase tracking-widest rounded border border-yellow-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Ticket Pending
                    </span>
                  ) : (
                    <button 
                      onClick={() => setIsReportOpen(true)} 
                      className="px-3 py-1.5 bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 text-[9px] font-black uppercase tracking-widest rounded border border-white/5 hover:border-red-500/30 transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Report
                    </button>
                  )*/}
                </div>
                
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center justify-between shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-red-400 font-bold text-xs uppercase tracking-widest">Protocol Expires In</span>
                  </div>
                  <span className="text-red-400 font-black font-mono text-xl tracking-wider">{meetupTimeLeft}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/50 rounded-xl p-5 text-left border border-white/10 flex flex-col justify-between">
                    <div>
                      <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Target Location</p>
                      <p className="text-white font-black text-sm mb-1">📍 {roomState.safe_zone_selected}</p>
                      {/* ⚡ THE DOM FIX: הצגת הוראת מיקום מדויקת למשתמש */}
                      {targetZoneInfo && (
                        <p className="text-fi-accent font-mono text-xs font-bold mt-1 bg-fi-accent/5 border border-fi-accent/10 px-2 py-1 rounded inline-block">
                          🎯 Stand at: {targetZoneInfo.label}
                        </p>
                      )}
                      
                      <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1 mt-4">Opponent</p>
                      <p className="text-white font-bold text-sm">👤 {opponentName}</p>
                    </div>
                    {/* ⚡ THE MAPS FIX */}
                    {targetZoneInfo && (
                      <div className="mt-4 flex gap-2 w-full">
                        <a 
                          href={`https://maps.google.com/?q=${targetZoneInfo.lat},${targetZoneInfo.lng}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-[9px] uppercase tracking-widest rounded transition-colors border border-white/20"
                        >
                          Google Maps
                        </a>
                        <a 
                          href={`https://waze.com/ul?ll=${targetZoneInfo.lat},${targetZoneInfo.lng}&navigate=yes`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center py-2 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 font-bold text-[9px] uppercase tracking-widest rounded transition-colors border border-blue-500/30"
                        >
                          Waze
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="bg-fi-accent/10 rounded-xl p-5 text-center border border-fi-accent/30 flex flex-col justify-center items-center relative overflow-hidden">
                  {!isInRadius ? (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-10">
                        <svg className="w-8 h-8 text-fi-accent mb-2 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <p className="text-white font-black text-xs uppercase tracking-widest mb-1">Move to Security Zone</p>
                        {gpsError ? (
                          <p className="text-red-400 text-[9px] text-center">{gpsError}</p>
                        ) : distanceToZone !== null ? (
                          /* ⚡ THE CSS/TEXT FIX: עדכון ויזואלי לתקרה של 50 מטר */
                          <p className="text-gray-400 text-[10px] text-center font-mono bg-white/5 px-2 py-1 rounded border border-white/10 mt-1">
                            Distance: <span className="text-red-400 font-bold">{distanceToZone}m</span> / <span className="text-green-400">50m</span>
                          </p>
                        ) : (
                          <p className="text-gray-400 text-[10px] text-center animate-pulse">Acquiring GPS Signal...</p>
                        )}
                      </div>
                    ) : null}

                    <p className="text-fi-accent text-[10px] font-bold uppercase tracking-widest mb-3">
                      {isInitiator ? "Your Handshake PIN" : "Verify Opponent"}
                    </p>
                    {isInitiator ? (
                      <>
                        <div className="bg-black border-2 border-fi-accent border-dashed rounded-xl p-3 w-full mb-3">
                          <span className="text-3xl font-mono font-black text-white tracking-widest">{roomState.id.split('-')[0].toUpperCase().substring(0, 5)}</span>
                        </div>
                        <p className="text-gray-400 text-[10px] leading-relaxed">
                          Show this code to <span className="text-white font-bold">{opponentName}</span>.
                        </p>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={async () => {
                            const userPin = prompt(`Enter the 5-digit verification PIN from ${opponentName}'s screen:`);
                            if (!userPin) return;
                            if (userPin.toUpperCase() === roomState.id.split('-')[0].toUpperCase().substring(0, 5)) {
                              try {
                                const { error: settlementError } = await supabase.rpc('finalize_secure_trade', { p_room_id: roomState.id });
                                if (settlementError) return alert("Smart Contract execution failed. Assets were not moved.");
                                window.dispatchEvent(new Event('refresh_trades'));
                                window.dispatchEvent(new Event('update_global_credits'));
                                window.dispatchEvent(new Event('force_ts_refresh'));
                              } catch (error) { alert("Verification Successful, but network failed to finalize status."); }
                            } else { alert("Invalid PIN. Verification failed."); }
                          }}
                          className="w-full py-4 bg-fi-accent text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-yellow-500 transition-colors shadow-[0_0_20px_rgba(255,215,0,0.3)] mb-3"
                        >
                          Scan / Enter PIN
                        </button>
                        <p className="text-gray-400 text-[10px] leading-relaxed">
                          Input the 5-digit code from <span className="text-white font-bold">{opponentName}</span>.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-white/5 pt-4 flex justify-start gap-3 flex-wrap">
                <button onClick={proposeMutualAbort} disabled={roomState.status === 'abort_pending'} className="px-4 py-2 bg-yellow-950/30 hover:bg-yellow-950/60 disabled:opacity-50 text-yellow-500 border border-yellow-900/40 text-[9px] font-black uppercase tracking-widest rounded transition-all">
                  {roomState.status === 'abort_pending' ? 'Abort Pending...' : 'Propose Mutual Abort (Free)'}
                </button>
                <button onClick={handleCancelTrade} className="px-4 py-2 bg-red-950/20 hover:bg-red-950/50 text-red-400 border border-red-900/30 text-[9px] font-black uppercase tracking-widest rounded transition-all">
                  Abort Protocol (⚠️ Penalty)
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 h-full min-h-0">
              {/* ⚡ THE COOLDOWN WARNING BADGE */}
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
                    {/* ⚡ THE FIX: רינדור דינמי מתוך אובייקט הליבה */}
                    {Object.keys(SAFE_ZONES_GEO).map(zone => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>
                <div className="text-right flex flex-col items-end">
            <button 
              onClick={toggleLock}
              className={`px-8 py-3 font-black text-sm uppercase rounded transition-all ${myLock ? 'bg-fi-accent text-black shadow-[0_0_20px_rgba(255,215,0,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              {myLock ? 'LOCKED 🔒' : 'LOCK TRADE'}
            </button>
            {/* ⚡ הוחלף: מציג אזהרת 5% רק אם הוצעו קרדיטים */}
            {!myLock && myCredits > 0 && (
              <p className="text-yellow-500 text-[9px] font-bold uppercase tracking-widest mt-1.5">
                * 5% Escrow Fee applies
              </p>
            )}
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
  <div className="mb-4 bg-black/50 border border-white/10 rounded-lg p-3 flex justify-between items-center shrink-0">
    <div className="flex flex-col">
      <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">
        CREDITS OFFERED
      </span>
      {/* ⚡ הזרקת השקיפות: המשתמש רואה את הנטו שהוא הולך לקבל לכיס */}
      <span className="text-[9px] text-green-500 font-bold uppercase tracking-widest mt-1">
        ↳ You net (After 5% Fee): {Math.floor(opponentCredits * 0.95)} CR
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="font-black text-lg text-white">
        {opponentCredits}
      </span>
      <span className="font-black text-sm text-gray-500">CR</span>
    </div>
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
          )}

        </div>

        <div className="bg-[#111113] border border-white/10 rounded-xl flex flex-col overflow-hidden h-[400px] lg:h-full min-h-0 shadow-2xl">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2 shrink-0">
            <h3 className="text-white font-bold text-sm uppercase tracking-widest">Encrypted Chat</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar flex flex-col-reverse">
            {messages.length === 0 ? (
              <p className="text-gray-600 text-xs text-center font-bold uppercase mt-10">System: Messages are logged and monitored.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map(msg => {
                  const isMe = msg.sender_name === currentUser.name || msg.sender_name === currentUser.id;
                  const senderDisplayName = profilesMap[msg.sender_name] || (UUID_REGEX.test(msg.sender_name) ? msg.sender_name.substring(0, 8) : msg.sender_name);

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">{senderDisplayName}</span>
                      <div className={`px-3 py-2 rounded-lg text-sm ${isMe ? 'bg-fi-accent text-black font-medium rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none'} ${msg.message_content.includes('[REDACTED]') ? 'border border-red-500/50' : ''}`}>
                        {msg.message_content}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-black/50 flex gap-2 shrink-0">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isMeetupPhase ? "Coordinate meetup..." : "Negotiate terms..."}
              className="flex-1 bg-transparent text-white text-sm outline-none px-2 placeholder-gray-600"
              disabled={roomState.status === 'abort_pending'}
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
    const maxAffordable = Math.max(0, walletBalance - PLATFORM_FEE);

    if (parsed > maxAffordable) {
      alert(`Liquidity Error: Max affordable offer is ${maxAffordable}C (Reserving ${PLATFORM_FEE}C for Platform Fee)`);
      parsed = maxAffordable;
      setLocalValue(maxAffordable);
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
    <div className={`mb-4 bg-black border ${isSaved ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : localValue > 0 ? 'border-fi-accent/50' : 'border-white/10'} rounded-lg p-3 flex justify-between items-center focus-within:border-fi-accent transition-all duration-300 shrink-0`}>
       <div className="flex flex-col">
         <span className={`font-bold text-[10px] uppercase tracking-widest transition-colors ${isSaved ? 'text-green-500' : localValue > 0 ? 'text-fi-accent' : 'text-gray-400'}`}>
           {isSaved ? '✓ FUNDS SECURED' : localValue > 0 ? 'FUNDS ON TABLE' : 'ADD CREDITS'}
         </span>
         <span className="text-[9px] text-gray-600 font-mono mt-0.5">Wallet: {walletBalance} CR</span>
         
         {/* ⚡ הזרקת השקיפות: מראה כמה היריב מקבל בפועל לאחר ה-5% עמלה */}
         {localValue > 0 && (
           <span className="text-[8.5px] text-yellow-500/80 font-bold uppercase tracking-widest mt-1">
             ↳ Opponent nets: {Math.floor(Number(localValue) * 0.95)} CR
           </span>
         )}
       </div>
       <div className="flex items-center gap-2">
         <input 
           type="number"
           min="0"
           max={walletBalance} /* ⚡ תוקן: הוסר ה-PLATFORM_FEE מהמגבלה של ה-Input */
           disabled={myLock}
           value={localValue === 0 ? '' : localValue}
           onFocus={() => setIsFocused(true)}
           onChange={(e) => setLocalValue(e.target.value)}
           onBlur={handleBlur}
           onKeyDown={handleKeyDown}
           placeholder="0"
           className={`w-24 bg-transparent text-right font-mono font-black text-lg outline-none placeholder-gray-700 transition-colors ${localValue > 0 && !isSaved ? 'text-fi-accent drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]' : 'text-white'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
         />
         <span className={`font-black text-sm transition-colors ${localValue > 0 ? 'text-fi-accent' : 'text-gray-500'}`}>CR</span>
       </div>
    </div>
  );
}