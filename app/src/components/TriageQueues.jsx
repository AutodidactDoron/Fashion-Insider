import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function TriageQueuesPanel() {
  const [activeReports, setActiveReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roomChats, setRoomChats] = useState({});

  useEffect(() => {
    fetchDisputes();

    // ⚡ THE RADAR PIPELINE: מנוע טלמטריה וחיבור חי למסד הנתונים
    const channelName = `admin_triage_radar_${Date.now()}`;
    const reportsSubscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trade_reports' },
        (payload) => {
          console.log("⚡ RADAR PING (Live Data Detected):", payload);
          fetchDisputes(); 
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log("🟢 TRIAGE RADAR ONLINE: Listening to trade_reports");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("🔴 RADAR ERROR:", err);
        }
      });

    return () => {
      console.log("🛑 TRIAGE RADAR OFFLINE: Disconnecting channel");
      supabase.removeChannel(reportsSubscription);
    };
  }, []);

  const fetchDisputes = async () => {
    setIsLoading(true);
    const { data: reports, error } = await supabase
      .from('trade_reports')
      .select('*, trade_rooms(initiator_name, responder_name)')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false });

    if (reports) {
      setActiveReports(reports);
      reports.forEach(report => fetchChatLog(report.room_id));
    }
    setIsLoading(false);
  };

  const fetchChatLog = async (roomId) => {
    if (roomChats[roomId]) return; 
    const { data } = await supabase
      .from('trade_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    
    if (data) {
      setRoomChats(prev => ({ ...prev, [roomId]: data }));
    }
  };

  const executeVerdict = async (report, guiltyUser, innocentUser) => {
    if (!window.confirm(`EXECUTE VERDICT: Punish ${guiltyUser} (Strikes + Time Ban) and free ${innocentUser}?`)) return;

    try {
      const { error: rpcError } = await supabase.rpc('admin_resolve_dispute', {
        p_room_id: report.room_id,
        p_guilty_user: guiltyUser,
        p_innocent_user: innocentUser
      });

      if (rpcError) throw rpcError;

      await supabase.from('trade_reports').update({ status: 'resolved' }).eq('room_id', report.room_id);

      alert("Verdict Executed. Market logic enforced.");
      setActiveReports(prev => prev.filter(r => r.room_id !== report.room_id));
    } catch (err) {
      console.error("Verdict Failed:", err);
      alert("System Error during execution.");
    }
  };

  const dismissReport = async (reportId) => {
      if (!window.confirm("Dismiss this report? The trade will continue normally and no assets will be touched.")) return;
      try {
          await supabase.from('trade_reports').update({ status: 'dismissed' }).eq('id', reportId);
          setActiveReports(prev => prev.filter(r => r.id !== reportId));
      } catch (err) {
          console.error("Dismiss Failed:", err);
      }
  }

  if (isLoading) return <div className="text-white p-8 font-bold tracking-widest uppercase">Loading Security Feeds...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Triage Queues</h2>
        <p className="text-gray-500 text-sm mt-1">Review user reports, encrypted comms, and pass final verdicts.</p>
      </div>

      {activeReports.length === 0 ? (
        <div className="bg-[#111113] border border-white/10 rounded-xl p-12 text-center">
          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Queue is clear</p>
        </div>
      ) : (
        <div className="space-y-8">
          {activeReports.map(report => (
            <div key={report.id} className="bg-[#111113] border border-red-500/20 rounded-xl overflow-hidden shadow-2xl">
              <div className="bg-red-500/10 px-6 py-4 border-b border-red-500/20 flex justify-between items-center">
                <span className="text-red-400 font-black tracking-widest uppercase text-xs flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Active Report
                </span>
                <span className="text-gray-400 text-xs font-mono">Room ID: {report.room_id.split('-')[0]}</span>
              </div>
              
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. פרטי התלונה */}
                <div className="bg-black/50 border border-white/5 rounded-lg p-5 flex flex-col">
                  <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-4">Report Details</h3>
                  <div className="space-y-4">
                      <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest">Reporter</p>
                          <p className="text-white text-sm font-bold">{report.reporter_name}</p>
                      </div>
                      <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest">Reported User</p>
                          <p className="text-red-400 text-sm font-bold">{report.reported_name}</p>
                      </div>
                      <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest">Category</p>
                          <span className="inline-block mt-1 px-2 py-1 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded">{report.category}</span>
                      </div>
                      <div>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest">Description</p>
                          <p className="text-gray-300 text-xs mt-1 bg-black p-3 rounded border border-white/5 min-h-[60px]">{report.description || 'No description provided.'}</p>
                      </div>
                  </div>
                </div>

                {/* 2. היסטוריית הצ'אט */}
                <div className="bg-black/50 border border-white/5 rounded-lg p-5 flex flex-col h-80 lg:h-auto">
                  <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-4">Encrypted Comms Log</h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {roomChats[report.room_id]?.length === 0 ? (
                       <p className="text-gray-600 text-xs italic text-center mt-4">No messages logged in this room.</p>
                    ) : (
                      roomChats[report.room_id]?.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender_name === report.reporter_name ? 'items-start' : 'items-end'}`}>
                          <span className={`text-[8px] font-black uppercase tracking-wider mb-0.5 ${msg.sender_name === report.reporter_name ? 'text-gray-500' : 'text-red-400'}`}>{msg.sender_name}</span>
                          <span className={`text-xs px-3 py-2 rounded-lg ${msg.sender_name === report.reporter_name ? 'bg-white/10 text-white rounded-tl-none' : 'bg-red-950/30 text-red-100 border border-red-900/50 rounded-tr-none'}`}>{msg.message_content}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. שולחן השופט */}
                <div className="flex flex-col justify-center space-y-4 bg-black/20 p-5 rounded-lg border border-white/5">
                  <h3 className="text-center text-sm font-black text-white uppercase tracking-widest mb-2 border-b border-white/10 pb-4">Execute Verdict</h3>
                  
                  <button 
                    onClick={() => executeVerdict(report, report.reported_name, report.reporter_name)}
                    className="w-full py-4 border border-red-900/50 hover:border-red-500 text-red-400 hover:text-white bg-red-950/20 hover:bg-red-600 font-bold text-xs uppercase tracking-widest transition-all rounded shadow-lg"
                  >
                    Punish <span className="underline">{report.reported_name}</span>
                    <span className="block text-[8px] text-red-300/70 mt-1 normal-case tracking-normal">Time Ban & increase strikes</span>
                  </button>

                  <button 
                    onClick={() => executeVerdict(report, report.reporter_name, report.reported_name)}
                    className="w-full py-4 border border-orange-900/50 hover:border-orange-500 text-orange-400 hover:text-white bg-orange-950/20 hover:bg-orange-600 font-bold text-xs uppercase tracking-widest transition-all rounded shadow-lg"
                  >
                    Punish <span className="underline">{report.reporter_name}</span>
                    <span className="block text-[8px] text-orange-300/70 mt-1 normal-case tracking-normal">False report penalty</span>
                  </button>

                  <div className="pt-4 mt-2 border-t border-white/5">
                      <button 
                        onClick={() => dismissReport(report.id)}
                        className="w-full py-3 border border-gray-700/50 hover:border-gray-500 text-gray-500 hover:text-white bg-transparent hover:bg-gray-800 font-bold text-[10px] uppercase tracking-widest transition-all rounded"
                      >
                        Dismiss Report
                      </button>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}