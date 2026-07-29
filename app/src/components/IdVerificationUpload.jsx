import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function IdVerificationUpload() {
  const [status, setStatus] = useState('unverified'); 
  const [file, setFile] = useState(null);
  const [isUploading, setIsLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  const checkCurrentVerificationStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('id_verifications')
      .select('status, rejection_reason')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setStatus(data.status);
      if (data.rejection_reason) setRejectionReason(data.rejection_reason);
    }
  };

  useEffect(() => {
    checkCurrentVerificationStatus();
    
    // ⚡ MOCK/LIVE ENGINE: זיהוי מכשיר קשיח למניעת העלאת זיופים מהמחשב
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileCheck = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    setIsMobile(mobileCheck);
    setCurrentUrl(window.location.href);

    let kycChannel;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        kycChannel = supabase.channel('user_kyc_realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'id_verifications', filter: `user_id=eq.${user.id}` },
            (payload) => checkCurrentVerificationStatus()
          )
          .subscribe();
      }
    });

    return () => {
      if (kycChannel) supabase.removeChannel(kycChannel);
    };
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
      alert("LIQUIDITY LIMIT: File size cannot exceed 5MB.");
      return;
    }
    setFile(selectedFile);
  };

  const executeUploadProtocol = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please capture a live photo of your ID.");

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Auth session expired");

      // מניעת העלאת PDF - רק תמונות חיות
      if (!file.type.startsWith('image/')) {
        throw new Error("Invalid format. Only live camera captures are accepted.");
      }

      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const securePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('kyc_documents')
        .upload(securePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('id_verifications')
        .insert([{
          user_id: user.id,
          secure_storage_path: securePath,
          status: 'pending_review'
        }]);

      if (dbError) throw dbError;

      setStatus('pending_review');
    } catch (err) {
      console.error(err);
      alert("Upload Failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'approved') {
    return (
      <div className="bg-green-500/10 border border-green-500 rounded-xl p-6 flex items-center gap-4 shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all">
        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 shrink-0">✓</div>
        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-wider">Identity Verified</h4>
          <p className="text-gray-400 text-xs mt-0.5">Your global profile is now locked with verified status. Trust Score ceiling increased.</p>
        </div>
      </div>
    );
  }

  if (status === 'pending_review') {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 flex items-center gap-4 shadow-xl transition-all">
        <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 shrink-0 animate-pulse">⏳</div>
        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-wider">Verification Pending</h4>
          <p className="text-gray-400 text-xs mt-0.5">Documents ingested. Compliance team is auditing the secure logs. Expect resolution within 24h.</p>
        </div>
      </div>
    );
  }

  // ⚡ DESKTOP FALLBACK: מסך חסימה וברקוד
  if (!isMobile) {
    return (
      <div className="bg-[#111113] border border-white/5 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-2xl">
        <div className="space-y-2">
          <h4 className="text-white font-black text-xl uppercase tracking-tighter">Security Protocol Activated</h4>
          <p className="text-gray-400 text-xs max-w-sm mx-auto leading-relaxed">
            To prevent fraud and automated AI manipulation, identity verification must be completed using a live mobile camera. Desktop uploads are strictly prohibited.
          </p>
        </div>
        
        <div className="bg-white p-2 rounded-xl">
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl)}`} 
            alt="Scan to Verify" 
            className="w-32 h-32"
          />
        </div>
        
        <p className="text-fi-accent text-xs font-black uppercase tracking-widest animate-pulse">
          Scan QR code to open camera
        </p>
      </div>
    );
  }

  // ⚡ MOBILE NATIVE: כפיית מצלמה חיה
  return (
    <div className="bg-[#111113] border border-white/5 rounded-xl p-6 space-y-4 transition-all">
      <div>
        <h4 className="text-white font-black text-sm uppercase tracking-wider">Identity Verification</h4>
        <p className="text-gray-500 text-xs mt-0.5">Capture a live photo of your ID/Passport.</p>
      </div>

      {status === 'rejected' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400 font-medium animate-pulse">
          <strong className="font-black uppercase tracking-widest block mb-1">✕ Previous Request Rejected:</strong>
          {rejectionReason || "Documents provided were illegible or expired. Please resubmit."}
        </div>
      )}

      <form onSubmit={executeUploadProtocol} className="space-y-4">
        <div className="border-2 border-dashed border-white/10 hover:border-fi-accent/50 transition-colors rounded-xl p-8 text-center bg-black/40 relative cursor-pointer group">
          <input 
            type="file" 
            accept="image/*"
            capture="environment" // ⚡ הפקודה הקשיחה למערכת ההפעלה לפתוח מצלמה אחורית
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          <div className="space-y-3">
            <svg className="w-8 h-8 text-gray-500 mx-auto group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <p className="text-gray-300 text-sm font-bold uppercase tracking-widest group-hover:text-white transition-colors">
              {file ? `Captured: ${file.name}` : "Tap to Open Camera"}
            </p>
          </div>
        </div>

        {file && (
          <button
            type="submit"
            disabled={isUploading}
            className="w-full py-4 bg-white hover:bg-gray-200 text-black font-black text-sm uppercase tracking-widest rounded-lg transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUploading ? (
               <>
                 <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 Encrypting...
               </>
            ) : "Submit ID for Audit"}
          </button>
        )}
      </form>
    </div>
  );
}