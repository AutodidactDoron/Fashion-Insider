import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// --- THE LOGIC ENGINE (Inline) ---
function getTrustTier(score) {
  if (score < 20) return { label: 'GHOST', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
  if (score < 50) return { label: 'ROOKIE', color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10' };
  if (score < 80) return { label: 'VERIFIED', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
  if (score < 95) return { label: 'PRO', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
  return { label: 'APEX', color: 'text-black', bg: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400', border: 'border-yellow-400/50' };
}

export default function TrustBadge({ username, className = "" }) {
  const [ts, setTs] = useState(0);

  const fetchTS = useCallback(async () => {
    if (!username) return;
    const { data } = await supabase.from('user_profiles').select('trust_score').eq('user_name', username).single();
    if (data) setTs(data.trust_score);
  }, [username]);

  useEffect(() => {
    fetchTS();
    window.addEventListener('force_ts_refresh', fetchTS);
    const tsChannel = supabase.channel(`ts_${username}`).on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles', filter: `user_name=eq.${username}` }, (payload) => {
      if (payload.new) setTs(payload.new.trust_score);
    }).subscribe();
    return () => { window.removeEventListener('force_ts_refresh', fetchTS); supabase.removeChannel(tsChannel); };
  }, [username, fetchTS]);

  const tier = getTrustTier(ts);
  const isApex = tier.label === 'APEX';

  return (
    <div 
      className={`group relative inline-flex items-center gap-2 px-2 py-0.5 rounded border transition-all duration-300 ${tier.bg} ${tier.border} ${className}`}
    >
      {/* הראנק (ROOKIE, PRO וכו') */}
      <div className={`text-[10px] font-black tracking-widest uppercase ${tier.color} ${isApex ? 'animate-pro-shine' : ''}`}>
        {tier.label}
      </div>

      {/* המספר הגולמי - מוצג תמיד אבל בעיצוב עדין */}
      <div className="text-[9px] font-bold text-white/60 border-l border-white/10 pl-1.5">
        {ts}<span className="text-[7px] ml-0.5 opacity-50">TS</span>
      </div>

      {/* מד התקדמות מיקרוסקופי בתחתית התגית */}
      {!isApex && (
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-black/20 overflow-hidden rounded-b">
          <div 
            className={`h-full transition-all duration-1000 ${tier.color.replace('text-', 'bg-')}`} 
            style={{ width: `${ts}%` }}
          />
        </div>
      )}

      {/* Hover Tooltip - מוצג רק במעבר עכבר (Desktop) */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-black text-[9px] text-white px-2 py-1 rounded shadow-xl whitespace-nowrap border border-white/10">
          Trust Score: {ts}/100
        </div>
      </div>
    </div>
  );
}