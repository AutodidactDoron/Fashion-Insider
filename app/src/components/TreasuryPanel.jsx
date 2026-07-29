import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // ודא שהנתיב תקין אצלך

export default function TreasuryPanel() {
  const [ledger, setLedger] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTreasuryData();
  }, []);

  const fetchTreasuryData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_revenue_ledger')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setLedger(data || []);
      const total = data?.reduce((acc, row) => acc + row.amount, 0) || 0;
      setTotalRevenue(total);
    } catch (error) {
      console.error("Critical: Failed to fetch treasury ledger.", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full text-white animate-fade-in">
      {/* כותרת ונתוני מאקרו */}
      <div className="mb-8 flex justify-between items-end border-b border-white/10 pb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">• CORPORATE TREASURY</h2>
          <p className="text-[11px] text-gray-500">Real-time ledger of all platform revenue streams.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest mb-1">Total Net Revenue</p>
          <p className="text-3xl font-black font-mono text-white drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">
            {totalRevenue.toLocaleString()} CR
          </p>
        </div>
      </div>

      {/* טבלת הנתונים */}
      <div className="bg-black/50 border border-white/10 rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 p-4 border-b border-white/10 bg-white/5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Transaction ID</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Revenue Type</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Amount (CR)</span>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-sm font-mono text-gray-500">SYNCING LEDGER...</div>
        ) : ledger.length === 0 ? (
          <div className="p-8 text-center text-sm font-mono text-gray-600 uppercase tracking-widest">No Revenue Recorded Yet</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {ledger.map((entry) => (
              <div key={entry.id} className="grid grid-cols-4 p-4 border-b border-white/5 hover:bg-white/5 transition-colors items-center">
                <span className="text-[11px] text-gray-400 font-mono">
                  {new Date(entry.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="text-[11px] text-gray-500 font-mono truncate pr-4">
                  {entry.id.split('-')[0]}...
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {entry.transaction_type === 'trade_fee' ? (
                    <span className="text-blue-400">Trade Tax (5%)</span>
                  ) : (
                    <span className="text-red-400">Spam Penalty</span>
                  )}
                </span>
                <span className="text-[13px] text-green-500 font-black font-mono text-right">
                  +{entry.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}