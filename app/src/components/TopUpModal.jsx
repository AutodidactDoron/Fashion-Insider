import React, { useState } from 'react';
import { supabase } from "../supabaseClient"; // ודא שהנתיב ל-Supabase שלך נכון

export default function TopUpModal({ isOpen, onClose }) {
  const [crAmount, setCrAmount] = useState(1000);
  const [isProcessing, setIsProcessing] = useState(false);
  const conversionRate = 100;
  const usdPrice = (crAmount / conversionRate).toFixed(2);

  if (!isOpen) return null;

  // פונקציית הטריגר שפונה לשרת שלנו במקום ל-PayPal
  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // 1. שולפים את הטוקן של המשתמש הנוכחי
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Authentication failed. Please log in.");

      // 2. יורים את הבקשה ל-Edge Function שלנו
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buy-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ amount: crAmount })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Transaction failed in Treasury Engine');
      }

      // 3. הצלחה
      alert(`Transaction approved. Added ${crAmount} CR to your vault.`);
      onClose(); // סוגר את המודל

    } catch (error) {
      console.error("Payment Gateway Error:", error);
      alert(`Payment failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#111113] border border-fi-accent/30 rounded-2xl p-6 w-full max-w-md relative shadow-[0_0_40px_rgba(255,215,0,0.15)] flex flex-col max-h-[90vh]">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10" disabled={isProcessing}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="shrink-0">
          <h2 className="text-2xl font-black text-white mb-1 tracking-wide uppercase">Acquire Assets</h2>
          <p className="text-sm text-gray-400 mb-6">Top up your CR balance to dominate the market.</p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1000, 5000, 10000].map((amount) => (
              <button
                key={amount}
                onClick={() => setCrAmount(amount)}
                disabled={isProcessing}
                className={`py-3 rounded-lg font-bold text-sm transition-all duration-200 ${
                  crAmount === amount 
                    ? 'bg-fi-accent text-black shadow-[0_0_15px_rgba(255,215,0,0.4)] transform scale-105' 
                    : 'bg-black border border-white/10 text-gray-400 hover:border-white/30'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {amount.toLocaleString()} CR
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center mb-6 p-4 bg-black/50 rounded-lg border border-white/5">
            <span className="text-gray-400 font-medium">Total Cost:</span>
            <span className="text-2xl font-black text-white">${usdPrice}</span>
          </div>
        </div>

        {/* מנוע התשלום החדש - Native Button */}
        <div className="mt-2 relative z-0">
          <button 
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full py-4 rounded-lg font-black text-lg transition-all duration-300 flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-wait"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing Transaction...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                Complete Purchase
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}