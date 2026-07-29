import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// ⚡ Global Regex to identify true Cryptographic UUIDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    
    // ⚡ Smart Column Detection: Routing the query based on data type
    const queryColumn = UUID_REGEX.test(username) ? 'id' : 'user_name';
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('trust_score')
      .eq(queryColumn, username)
      .single();
      
    if (data && !error) setTs(data.trust_score);
  }, [username]);

  useEffect(() => {
    // 1. משיכה ראשונית של המוניטין בעת טעינת התג
    fetchTS();
    
    // 2. האזנה לפעימת ה-DOM הגלובלית בלבד (Zero WebSockets)
    window.addEventListener('force_ts_refresh', fetchTS);
      
    return () => { 
      window.removeEventListener('force_ts_refresh', fetchTS); 
    };
  }, [fetchTS]);

  const tier = getTrustTier(ts);
  const isApex = tier.label === 'APEX';

  return (
    <div 
      className={`group relative inline-flex items-center gap-2 px-2 py-0.5 rounded border transition-all duration-300 ${tier.bg} ${tier.border} ${className}`}
    >
      <div className={`text-[10px] font-black tracking-widest uppercase ${tier.color} ${isApex ? 'animate-pro-shine' : ''}`}>
        {tier.label}
      </div>

      {/* ⚡ THE APEX CONTRAST FIX: התניית צבע דינמית למספר והקו המפריד */}
      <div className={`text-[9px] font-bold border-l pl-1.5 ${isApex ? 'text-black/80 border-black/20' : 'text-white/60 border-white/10'}`}>
        {ts}<span className={`text-[7px] ml-0.5 ${isApex ? 'font-black opacity-70' : 'opacity-50'}`}>TS</span>
      </div>

      {!isApex && (
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-black/20 overflow-hidden rounded-b">
          <div 
            className={`h-full transition-all duration-1000 ${tier.color.replace('text-', 'bg-')}`} 
            style={{ width: `${ts}%` }}
          />
        </div>
      )}

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-black text-[9px] text-white px-2 py-1 rounded shadow-xl whitespace-nowrap border border-white/10">
          Trust Score: {ts}/100
        </div>
      </div>
    </div>
  );
}