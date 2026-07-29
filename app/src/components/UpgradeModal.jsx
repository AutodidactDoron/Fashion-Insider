import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';

export default function UpgradeModal({ isOpen, onClose, currentUser, refreshUserProfile }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uiError, setUiError] = useState(null);

  if (!isOpen) return null;

  const handleUpgrade = async (planType) => {
    setIsSubmitting(true);
    setUiError(null);

    try {
      const { data, error } = await supabase.rpc('subscribe_to_pro', {
        p_user_name: currentUser.name,
        p_plan_type: planType
      });

      if (error) {
        if (error.message.includes('INSUFFICIENT_FUNDS')) {
          setUiError("שגיאת נזילות: אין לך מספיק קרדיטים בארנק לשדרוג זה.");
        } else {
          setUiError("Upgrade failed: " + error.message);
        }
        setIsSubmitting(false);
        return;
      }

      alert(`🎉 Welcome to PRO Tier! (${planType} plan activated)`);
      if (refreshUserProfile) refreshUserProfile();
      onClose();
    } catch (err) {
      console.error("Pro Upgrade Error:", err);
      setUiError("אירעה שגיאה בתקשורת מול השרת.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" dir="ltr">
      <div className="w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-xl p-6 shadow-[0_0_40px_rgba(245,158,11,0.15)] relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300">✕</button>
        
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-amber-500 uppercase tracking-widest">Upgrade to Pro</h2>
          <p className="text-sm text-zinc-400 mt-2">Unlock 15 daily broadcasts, priority feed placement, and the PRO badge.</p>
        </div>

        {uiError && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-900/50 text-red-400 text-xs rounded-lg text-center font-medium">
            {uiError}
          </div>
        )}

        {/* אזור ה-UI המעודכן - הדבק את זה מתחת להודעות השגיאה (uiError) */}
        {currentUser?.isPro ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center shadow-inner mt-4">
            <div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center mb-4 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-white font-black text-lg uppercase tracking-widest mb-2">Pro Tier Active</h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed px-4">
              Your account is currently upgraded. Fashion Insider operates on a <strong className="text-amber-500 font-medium">pre-paid</strong> basis, meaning there are absolutely no auto-renewal charges.
            </p>
            <button 
              onClick={onClose}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider rounded transition-all"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Monthly Tier */}
            <div className="relative rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-amber-500/50 transition-all">
               <div className="flex justify-between items-center mb-2">
                 <span className="font-bold text-zinc-100">Monthly Tier</span>
                 <span className="text-amber-500 font-mono font-bold">1,000 CR</span>
               </div>
               <p className="text-xs text-zinc-500 mb-3">Perfect for consistent daily leverage.</p>
               <button 
                 onClick={() => handleUpgrade('monthly')}
                 disabled={isSubmitting}
                 className="w-full py-2 bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-300 font-bold text-xs uppercase tracking-wide rounded transition-all"
               >
                 {isSubmitting ? 'Processing...' : 'Select Monthly'}
               </button>
            </div>

            {/* Yearly Tier */}
            <div className="relative rounded-xl border border-amber-500/50 bg-amber-950/10 p-4 hover:border-amber-500 transition-all">
               <div className="absolute -top-3 left-4 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">
                 Best Value - Save 2,000 CR
               </div>
               <div className="flex justify-between items-center mb-2 mt-1">
                 <span className="font-bold text-amber-500">Yearly Tier</span>
                 <span className="text-amber-500 font-mono font-bold">10,000 CR</span>
               </div>
               <p className="text-xs text-zinc-400 mb-3">Lock in your dominance for a full year.</p>
               <button 
                 onClick={() => handleUpgrade('yearly')}
                 disabled={isSubmitting}
                 className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wide rounded transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)]"
               >
                 {isSubmitting ? 'Processing...' : 'Select Yearly'}
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}