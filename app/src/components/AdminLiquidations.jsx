import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminLiquidations() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('liquidation_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    
    // האזנה לבקשות משיכה חדשות בזמן אמת
    const subscription = supabase
      .channel('liquidation_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'liquidation_requests' }, fetchRequests)
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  const handleMarkAsWired = async (id, userName, amount) => {
    if (!window.confirm(`CONFIRM WIRE: Mark ${amount} CR as successfully transferred to ${userName}?`)) return;

    const { error } = await supabase
      .from('liquidation_requests')
      .update({ status: 'completed_wire' })
      .eq('id', id);

    if (error) {
      alert("Database error: Could not update status.");
    } else {
      fetchRequests();
    }
  };

  const handleRefund = async (id, userId, userName, amount) => {
    if (!window.confirm(`REFUND REJECTED: Return ${amount} CR back to ${userName}'s digital wallet?`)) return;

    // 1. מחזירים את הכסף לארנק הווירטואלי
    const { error: refundError } = await supabase.rpc('increment_credits', { p_user_id: userId, p_amount: amount });
    
    // הערה למפתח: אם אין לך עדיין RPC בשם increment_credits, נשתמש בשאילתה ישירה
    // למען הבטיחות במערכת שלך, הנה עדכון ישיר ב-JS (דורש ש-RLS יאפשר זאת לאדמין):
    /*
    const { error: profileError } = await supabase.from('user_profiles')
      .update({ credits: supabase.raw(`credits + ${amount}`) })
      .eq('id', userId);
    */

    // 2. מעדכנים את סטטוס הבקשה
    const { error } = await supabase
      .from('liquidation_requests')
      .update({ status: 'rejected_refunded' })
      .eq('id', id);

    if (error) {
      alert("Error: Failed to process refund. Check permissions.");
    } else {
      fetchRequests();
    }
  };

  if (isLoading) return <div className="text-fi-accent p-8 uppercase font-black tracking-widest">Loading Financials...</div>;

  return (
    <div className="space-y-6">
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Treasury Liquidation</h2>
        <p className="text-gray-500 text-sm mt-1">Manage outgoing wire transfers for liquidated accounts.</p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-[#111113] border border-white/5 rounded-xl p-12 text-center text-gray-500 font-bold uppercase tracking-widest text-sm">
          No pending wire requests.
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map(req => {
            const isPending = req.status === 'pending_wire';
            
            return (
              <div key={req.id} className="bg-[#111113] border border-white/5 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                      isPending ? 'bg-orange-500/10 text-orange-400' : 
                      req.status === 'completed_wire' ? 'bg-green-500/10 text-green-400' : 
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {req.status.replace('_', ' ')}
                    </span>
                    <span className="text-gray-500 text-xs">{new Date(req.requested_at).toLocaleString()}</span>
                  </div>
                  <h3 className="text-white font-bold text-lg">{req.user_name || 'Unknown User'}</h3>
                  <p className="text-gray-600 text-[10px] font-mono mt-1">ID: {req.user_id}</p>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto">
                  <div className="text-right flex-1 md:flex-none">
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">Amount to Wire</p>
                    <p className="text-white font-black font-mono text-2xl">{req.amount.toLocaleString()} CR</p>
                  </div>

                  {isPending && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button 
                        onClick={() => handleMarkAsWired(req.id, req.user_name, req.amount)}
                        className="px-4 py-2 bg-green-900/30 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 text-[10px] font-black uppercase tracking-widest rounded transition-all"
                      >
                        Mark as Wired ✓
                      </button>
                      <button 
                        onClick={() => handleRefund(req.id, req.user_id, req.user_name, req.amount)}
                        className="px-4 py-2 bg-transparent hover:bg-red-950/50 text-red-500/50 hover:text-red-400 border border-red-500/20 text-[10px] font-black uppercase tracking-widest rounded transition-all"
                      >
                        Reject & Refund ↺
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}