import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import VaultSelectorModal from './VaultSelectorModal';

export default function InterestedAction({ postId, postOwnerName }) {
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);
  
  // ⚡ האובייקט המאוחד שומר את שני המזהים
  const [currentUser, setCurrentUser] = useState({ id: null, name: '' });
  
  const [offeredAssets, setOfferedAssets] = useState([]);
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // ⚡ שליפת השם האמיתי מהברזל לפני שממשיכים
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_name')
          .eq('id', user.id)
          .single();

        const explicitName = profile?.user_name || user.user_metadata?.user_name || 'A Trader';
        setCurrentUser({ id: user.id, name: explicitName });
      }
    };
    fetchUser();
  }, []);

  const handleInterestSubmit = async () => {
    if (!currentUser.id) return alert("System: Authentication Required.");

    // ⚡ אריזת הנתונים החכמה
    const payload = {
      text: message,
      assets: offeredAssets.map(a => ({
        id: a.id,
        name: a.name,
        brand: a.brand,
        stock_image_url: a.stock_image_url
      }))
    };

    const finalSerializedMessage = `__PRO_OFFER__:${JSON.stringify(payload)}`;

    const { error } = await supabase.from('post_interests').insert([{
      post_id: postId,
      message: finalSerializedMessage, 
      sender_name: currentUser.name // ⚡ התיקון הקריטי: שולחים את הטקסט החשוף
    }]);

    if (!error) {
      await supabase.from('notifications').insert([{
        user_name: postOwnerName, 
        title: 'NEW TRADE OFFER 📩',
        message: `${currentUser.name} submitted a structured offer on your post.`
      }]);

      // ⚡ The Ping: שידור לפעמון ההתראות ולפיד ההצעות
      window.dispatchEvent(new Event('refresh_notifications'));
      window.dispatchEvent(new Event('refresh_offers'));

      setIsSent(true);
      setShowInput(false);
    } else {
      console.error("Offer Submission Failed:", error);
    }
  };

  const handleAssetsSelected = (newAssets) => {
    setOfferedAssets(prev => [...prev, ...newAssets]);
  };

  const removeAsset = (assetId) => {
    setOfferedAssets(prev => prev.filter(a => a.id !== assetId));
  };

  // ⚡ משווים מול השם האמיתי כדי למנוע הצעות עצמיות
  if (!currentUser.id || currentUser.name === postOwnerName) return null;

  if (isSent) return (
    <div className="bg-fi-success/10 border border-fi-success/20 text-fi-success font-black text-[10px] tracking-widest uppercase py-2.5 px-4 rounded text-center w-full shadow-sm">
      Offer Logged
    </div>
  );

  return (
    <div className="w-full mt-4 border-t border-white/5 pt-4">
      {!showInput ? (
        <button 
          onClick={() => setShowInput(true)}
          className="w-full py-3 bg-white !text-black !font-black text-xs uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        >
          PITCH AN OFFER
        </button>
      ) : (
        <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-[#111113] border border-white/10 rounded-lg p-1.5 focus-within:border-fi-accent transition-colors">
            <textarea 
              placeholder="Negotiate your terms..."
              className="w-full bg-transparent p-2 text-white text-xs outline-none min-h-[60px] resize-none placeholder-gray-600"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            
            <div className="flex items-center justify-between border-t border-white/5 pt-2 px-1">
              <button 
                onClick={() => setIsVaultOpen(true)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-fi-accent uppercase tracking-widest transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Attach Assets
              </button>
            </div>
          </div>

          {offeredAssets.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {offeredAssets.map(asset => (
                <div key={asset.id} className="flex items-center gap-2 bg-black/60 border border-fi-accent/30 rounded p-1 pr-2 shadow-sm">
                  <img src={asset.stock_image_url} alt="" className="w-6 h-4 object-contain bg-white rounded-sm" />
                  <span className="text-[9px] font-bold text-white truncate max-w-[80px]">{asset.name}</span>
                  <button onClick={() => removeAsset(asset.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button 
              onClick={handleInterestSubmit} 
              disabled={message.trim() === '' && offeredAssets.length === 0}
              className="flex-1 py-2.5 bg-fi-accent text-black font-black text-[10px] rounded uppercase tracking-widest hover:bg-yellow-500 disabled:opacity-30 transition-colors"
            >
              Send Offer
            </button>
            <button 
              onClick={() => { setShowInput(false); setOfferedAssets([]); }} 
              className="px-5 py-2.5 bg-white/5 text-gray-400 font-bold text-[10px] rounded uppercase tracking-widest hover:bg-red-500/20 hover:text-red-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      <VaultSelectorModal 
        isOpen={isVaultOpen} 
        onClose={() => setIsVaultOpen(false)} 
        onAssetsSelected={handleAssetsSelected}
        excludedIds={offeredAssets.map(a => a.id)} 
      />
    </div>
  );
}