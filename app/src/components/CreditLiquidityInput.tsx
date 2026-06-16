import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CreditLiquidityInputProps {
  userId: string;
  receiverId: string;
  onTradeCreated: () => void;
}

export default function CreditLiquidityInput({ userId, receiverId, onTradeCreated }: CreditLiquidityInputProps) {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [creditsToOffer, setCreditsToOffer] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);

  // סינכרון יתרת הארנק של היוזם בזמן אמת
  useEffect(() => {
    const fetchCurrentLiquidity = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      if (data && !error) {
        setWalletBalance(data.credits);
      }
    };
    
    if (userId) fetchCurrentLiquidity();
  }, [userId]);

  const executeSecureTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUiError(null);

    // הגנה שכבה 1: בדיקת יתרה קליינט
    if (creditsToOffer > walletBalance) {
      setUiError('שגיאת נזילות: הסכום המבוקש גבוה מהיתרה הקיימת בארנק.');
      setIsSubmitting(false);
      return;
    }

    // שליחת הטרייד ל-Supabase
    const { error: transactionError } = await supabase
      .from('trades')
      .insert([
        {
          initiator_id: userId,
          receiver_id: receiverId,
          initiator_credits: Number(creditsToOffer),
          status: 'pending'
        }
      ]);

    if (transactionError) {
      // תפיסת ה-RAISE EXCEPTION של ה-Database במידה ונוצר מרוץ זמנים (Race Condition)
      setUiError(transactionError.message);
    } else {
      // הצלחה - השרת ניכה את הכסף לארנק הנאמנות אוטומטית
      onTradeCreated();
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl">
      <div className="flex justify-between items-center mb-4">
        <label className="text-sm font-medium text-zinc-400">הוספת קרדיטים לעסקה</label>
        <span className="text-xs text-zinc-500 font-mono">
          נזילות זמינה: <strong className="text-emerald-400">{walletBalance}</strong>C
        </span>
      </div>

      <form onSubmit={executeSecureTrade} className="space-y-4">
        <div className="relative rounded-lg bg-zinc-900 border border-zinc-800 focus-within:border-emerald-500/50 transition-all duration-200">
          <input
            type="number"
            min="0"
            max={walletBalance}
            value={creditsToOffer || ''}
            onChange={(e) => setCreditsToOffer(Math.max(0, parseInt(e.target.value) || 0))}
            placeholder="0"
            disabled={isSubmitting}
            className="w-full bg-transparent px-4 py-3 text-lg font-mono text-zinc-100 placeholder-zinc-700 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500 font-mono text-sm">
            CREDITS
          </div>
        </div>

        {uiError && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 text-red-400 text-xs rounded-lg font-medium">
            {uiError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || creditsToOffer <= 0}
          className="w-full py-3 px-4 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold rounded-lg text-sm transition-all duration-150 shadow-[0_4px_20px_rgba(255,255,255,0.05)]"
        >
          {isSubmitting ? 'מבצע נעילת נאמנות...' : 'שלח הצעת טרייד'}
        </button>
      </form>
    </div>
  );
}