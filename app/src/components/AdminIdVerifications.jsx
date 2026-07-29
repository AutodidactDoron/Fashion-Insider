import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminIdVerifications() {
  const [verifications, setVerifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVerifications = async () => {
    try {
      const { data, error } = await supabase
        .from('id_verifications')
        .select(`
          id, user_id, secure_storage_path, status, submitted_at, rejection_reason,
          user_profiles ( user_name, trust_score )
        `)
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      if (data) {
        const enrichedItems = await Promise.all(data.map(async (item) => {
          // ⚡ THE FIX: מנגנון חיטוי נתיבים למניעת ERR_DECRYPTION_FAILED
          if (item.status !== 'pending_review' || !item.secure_storage_path) {
            return { ...item, signedUrl: null };
          }

          let finalUrl = null;

          if (item.secure_storage_path.startsWith('http')) {
            finalUrl = item.secure_storage_path;
          } else {
            const cleanPath = item.secure_storage_path
              .replace(/^kyc_documents\//, '')
              .replace(/^\/+/, '');

            const { data: signedData, error: signError } = await supabase.storage
              .from('kyc_documents')
              .createSignedUrl(cleanPath, 1800); // 30 Min Compliance Window

            if (signError) {
              console.error(`[STORAGE ERR] Path: ${cleanPath}`, signError);
            } else {
              finalUrl = signedData?.signedUrl;
            }
          }

          return {
            ...item,
            signedUrl: finalUrl
          };
        }));

        setVerifications(enrichedItems);
      }
    } catch (err) {
      console.error("KYC Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();

    const adminKycChannel = supabase.channel('admin_kyc_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'id_verifications' }, (payload) => {
        console.log('[ADMIN REALTIME] Incoming KYC Document', payload);
        fetchVerifications();
      })
      .subscribe();

    return () => supabase.removeChannel(adminKycChannel);
  }, []);

  // ⚡ THE FIX: קבלת הציון הנוכחי וביצוע המתמטיקה בסביבה בטוחה
  const handleApproveKYC = async (id, userId, userName, currentTs) => {
    if (!window.confirm(`APPROVE IDENTITY: Grant official 'ID VERIFIED' status to ${userName}?`)) return;

    try {
      const { error: kycError } = await supabase
        .from('id_verifications')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', id);

      if (kycError) throw kycError;

      // חישוב הרף המקסימלי (100) בצד הלקוח
      const newTrustScore = Math.min(100, (currentTs || 0) + 10);

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ 
          id_verified: true,
          is_verified: true, // גיבוי לטבלאות ישנות
          trust_score: newTrustScore 
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      await supabase.from('notifications').insert([{
        user_name: userName,
        title: 'IDENTITY VERIFIED 🛡️',
        message: 'Compliance audit successful. Your account is now officially verified. High-tier trading unlocked.'
      }]);

      fetchVerifications();
    } catch (err) {
      console.error("Approval Pipeline Failed:", err);
      alert("Verification pipeline failed. Check console.");
    }
  };

  const handleRejectKYC = async (id, userName) => {
    const reason = prompt(`Provide a structural rejection reason for ${userName}:`, "Document is blurry or expired.");
    if (reason === null) return; 

    try {
      const { error: kycError } = await supabase
        .from('id_verifications')
        .update({ 
          status: 'rejected', 
          rejection_reason: reason,
          reviewed_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (kycError) throw kycError;

      await supabase.from('notifications').insert([{
        user_name: userName,
        title: 'VERIFICATION REJECTED ✕',
        message: `Identity verification audit failed. Reason: ${reason}`
      }]);

      fetchVerifications();
    } catch (err) {
      console.error(err);
      alert("Rejection execution failed.");
    }
  };

  if (isLoading && verifications.length === 0) return <div className="text-fi-accent p-8 uppercase font-black tracking-widest">Auditing Security Vault...</div>;

  const pendingRequests = verifications.filter(v => v.status === 'pending_review');
  const historyRequests = verifications.filter(v => v.status !== 'pending_review');

  return (
    <div className="space-y-8">
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Compliance & KYC Audits</h2>
        <p className="text-gray-500 text-sm mt-1">Review legal documents and grant verified status to high-end traders.</p>
      </div>

      <section className="space-y-4">
        <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
          Pending Review Log ({pendingRequests.length})
        </h3>

        {pendingRequests.length === 0 ? (
          <div className="bg-[#111113] border border-white/5 rounded-xl p-8 text-center text-gray-600 font-bold uppercase tracking-widest text-xs">
            Clean Ledger. No documents pending audit.
          </div>
        ) : (
          <div className="grid gap-6">
            {pendingRequests.map(req => {
              const uName = req.user_profiles?.user_name || 'Unknown';
              const currentTs = req.user_profiles?.trust_score || 0;
              const isPdf = req.secure_storage_path.toLowerCase().endsWith('.pdf');

              return (
                <div key={req.id} className="bg-[#111113] border border-white/5 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center shadow-2xl">
                  
                  <div className="space-y-2">
                    <p className="text-gray-500 text-[9px] uppercase font-mono">Timestamp: {new Date(req.submitted_at).toLocaleString()}</p>
                    <h4 className="text-white font-black text-xl tracking-tight">{uName}</h4>
                    <div className="bg-black/40 border border-white/5 p-3 rounded-lg inline-block">
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Current Score</p>
                      <p className="text-fi-accent font-mono font-black text-sm">{currentTs} TS</p>
                    </div>
                  </div>

                  <div className="bg-black border border-white/10 rounded-lg h-44 overflow-hidden relative group flex items-center justify-center p-2">
                    {isPdf ? (
                      <div className="text-center space-y-2">
                        <svg className="w-10 h-10 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        <span className="block text-[10px] text-gray-400 font-bold uppercase">Encrypted PDF Asset</span>
                      </div>
                    ) : req.signedUrl ? (
                      <img src={req.signedUrl} alt="KYC Proof" className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                    ) : (
                      <span className="text-red-500 text-xs font-mono">ERR_DECRYPTION_FAILED</span>
                    )}

                    {req.signedUrl && (
                      <a 
                        href={req.signedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-black uppercase tracking-widest backdrop-blur-xs"
                      >
                        Inspect Fullscreen ↗
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full">
                    {/* ⚡ THE FIX: שולחים את הציון הנוכחי לתוך הפונקציה */}
                    <button 
                      onClick={() => handleApproveKYC(req.id, req.user_id, uName, currentTs)}
                      className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-black text-xs uppercase tracking-widest rounded-lg transition-colors shadow-lg"
                    >
                      Verify Account ✓
                    </button>
                    <button 
                      onClick={() => handleRejectKYC(req.id, uName)}
                      className="w-full py-3 bg-transparent hover:bg-red-950/30 text-gray-500 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-xs font-black uppercase tracking-widest rounded-lg transition-colors"
                    >
                      Reject Document
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2 pt-6 border-t border-white/5">
        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Audit Archive Logs</h3>
        <div className="bg-[#111113] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[9px] text-gray-600 uppercase tracking-widest bg-black/30">
                  <th className="p-4 border-b border-white/5">Trader</th>
                  <th className="p-4 border-b border-white/5">Verdict</th>
                  <th className="p-4 border-b border-white/5">Notes / Reasons</th>
                </tr>
              </thead>
              <tbody className="text-xs text-gray-400 font-medium">
                {historyRequests.map(hist => (
                  <tr key={hist.id} className="border-b border-white/5 hover:bg-white/[0.01]">
                    <td className="p-4 font-bold text-white uppercase text-[11px]">{hist.user_profiles?.user_name || 'System'}</td>
                    <td className="p-4">
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${hist.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {hist.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[10px] text-gray-500 truncate max-w-xs">{hist.rejection_reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}