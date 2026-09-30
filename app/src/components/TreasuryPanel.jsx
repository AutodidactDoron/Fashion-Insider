import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// ⚡ SINGLE SOURCE OF TRUTH: every revenue stream the RPC layer can emit.
const REVENUE_TYPES = {
  trade_fee:                { label: 'Trade Tax (5%)',     color: 'text-blue-400'   },
  post_bump:                { label: 'Post Bump',          color: 'text-amber-400'  },
  spam_penalty:             { label: 'Spam Penalty',       color: 'text-red-400'    },
  pro_subscription_monthly: { label: 'PRO — Monthly',      color: 'text-purple-400' },
  pro_subscription_yearly:  { label: 'PRO — Yearly',       color: 'text-purple-400' },
  auto_renew_monthly:       { label: 'Auto-Renew Monthly', color: 'text-purple-300' },
  auto_renew_yearly:        { label: 'Auto-Renew Yearly',  color: 'text-purple-300' },
};

function describeType(raw) {
  return REVENUE_TYPES[raw] || {
    label: (raw || 'unknown').replace(/_/g, ' '),
    color: 'text-gray-400',
  };
}

export default function TreasuryPanel() {
  const [ledger, setLedger] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    fetchTreasuryData();
  }, []);

  const fetchTreasuryData = async () => {
    setIsLoading(true);
    try {
      // ⚡ שליפה מקוננת: הפרופילים נמשכים דרך המפתחות הזרים בקריאה אחת
      const { data, error } = await supabase
        .from('platform_revenue_ledger')
        .select(`
          *,
          payer:payer_id ( user_name ),
          counterparty:counterparty_id ( user_name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLedger(data || []);
      setTotalRevenue((data || []).reduce((acc, row) => acc + (row.amount || 0), 0));
    } catch (error) {
      console.error('Critical: Failed to fetch treasury ledger.', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (value, fieldKey) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      console.error('Clipboard unavailable.');
    }
  };

  useEffect(() => {
    if (!selectedEntry) return;
    const onKey = (e) => { if (e.key === 'Escape') setSelectedEntry(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedEntry]);

  const formatAmount = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString()}`;

  // ⚡ מרכז את לוגיקת התצוגה של הצדדים במקום אחד
  const describeParties = (entry) => {
    const payer        = entry.payer?.user_name;
    const counterparty = entry.counterparty?.user_name;

    if (!payer && !counterparty) return { short: '—', isLegacy: true };
    if (counterparty)            return { short: `${payer} ⇄ ${counterparty}`, isLegacy: false };
    return { short: payer, isLegacy: false };
  };

  return (
    <div className="w-full text-white animate-fade-in">

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

      <div className="bg-black/50 border border-white/10 rounded-xl overflow-hidden">
        {/* ⚡ חמש עמודות במקום ארבע */}
        <div className="grid grid-cols-[1.1fr_1fr_1.2fr_1.3fr_0.8fr] gap-3 p-4 border-b border-white/10 bg-white/5">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Txn ID</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Revenue Type</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Charged To</span>
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Amount</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm font-mono text-gray-500">SYNCING LEDGER...</div>
        ) : ledger.length === 0 ? (
          <div className="p-8 text-center text-sm font-mono text-gray-600 uppercase tracking-widest">No Revenue Recorded Yet</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {ledger.map((entry) => {
              const type    = describeType(entry.transaction_type);
              const parties = describeParties(entry);

              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="w-full text-left grid grid-cols-[1.1fr_1fr_1.2fr_1.3fr_0.8fr] gap-3 p-4 border-b border-white/5 hover:bg-white/5 focus:bg-white/10 focus:outline-none transition-colors items-center cursor-pointer"
                >
                  <span className="text-[11px] text-gray-400 font-mono">
                    {new Date(entry.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>

                  <span className="text-[11px] text-gray-500 font-mono truncate">
                    {entry.id.split('-')[0]}…
                  </span>

                  <span className={`text-[10px] font-bold uppercase tracking-widest ${type.color}`}>
                    {type.label}
                  </span>

                  <span className={`text-[11px] font-mono truncate ${parties.isLegacy ? 'text-gray-600 italic' : 'text-gray-300'}`}>
                    {parties.short}
                  </span>

                  <span className={`text-[13px] font-black font-mono text-right ${entry.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatAmount(entry.amount || 0)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ⚡ TRANSACTION INSPECTOR */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#111113] border border-white/10 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-white/10 sticky top-0 bg-[#111113]">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Transaction Inspector</p>
                <p className={`text-lg font-black uppercase tracking-tight ${describeType(selectedEntry.transaction_type).color}`}>
                  {describeType(selectedEntry.transaction_type).label}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-500 hover:text-white text-xl leading-none px-2"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <InspectorRow
                label="Transaction ID"
                value={selectedEntry.id}
                onCopy={() => copyToClipboard(selectedEntry.id, 'id')}
                copied={copiedField === 'id'}
              />
              <InspectorRow label="Raw Type" value={selectedEntry.transaction_type} />
              <InspectorRow label="Total Amount" value={`${formatAmount(selectedEntry.amount || 0)} CR`} />

              {/* ⚡ פירוק הצדדים */}
              {selectedEntry.payer_id ? (
                <>
                  <InspectorRow
                    label="Charged To"
                    value={
                      selectedEntry.payer?.user_name
                        ? `${selectedEntry.payer.user_name} — ${selectedEntry.payer_amount ?? 0} CR`
                        : 'Profile deleted'
                    }
                    onCopy={() => copyToClipboard(selectedEntry.payer_id, 'payer')}
                    copied={copiedField === 'payer'}
                  />
                  {selectedEntry.counterparty_id && (
                    <InspectorRow
                      label="Counterparty"
                      value={
                        selectedEntry.counterparty?.user_name
                          ? `${selectedEntry.counterparty.user_name} — ${selectedEntry.counterparty_amount ?? 0} CR`
                          : 'Profile deleted'
                      }
                      onCopy={() => copyToClipboard(selectedEntry.counterparty_id, 'cp')}
                      copied={copiedField === 'cp'}
                    />
                  )}
                </>
              ) : (
                <InspectorRow
                  label="Charged To"
                  value="Legacy entry — recorded before payer tracking was introduced"
                />
              )}

              <InspectorRow
                label="Linked Trade Room"
                value={selectedEntry.room_id || 'Not linked to a trade room'}
                onCopy={selectedEntry.room_id ? () => copyToClipboard(selectedEntry.room_id, 'room') : null}
                copied={copiedField === 'room'}
              />

              <InspectorRow
                label="Timestamp"
                value={new Date(selectedEntry.created_at).toLocaleString('en-GB', {
                  dateStyle: 'full', timeStyle: 'medium',
                })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InspectorRow({ label, value, onCopy, copied }) {
  return (
    <div>
      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[12px] text-gray-200 font-mono bg-black/60 border border-white/10 rounded-lg px-3 py-2 break-all">
          {value}
        </code>
        {onCopy && (
          <button
            onClick={onCopy}
            className="shrink-0 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}