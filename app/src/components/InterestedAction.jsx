import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function InterestedAction({ postId, postOwnerName }) {
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);
  
  // State חדש שמחזיק את המשתמש האמיתי מהשרת
  const [currentUser, setCurrentUser] = useState(null);

  // שאיבת הזהות החיה ברגע שהקומפוננטה עולה
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // שולפים את השם ששמרנו ב-Metadata בזמן ההרשמה
        setCurrentUser(user.user_metadata.user_name); 
      }
    };
    fetchUser();
  }, []);

  const handleInterestSubmit = async () => {
    if (!currentUser) return alert("You must be logged in.");

    const { error } = await supabase.from('post_interests').insert([{
      post_id: postId,
      message: message,
      sender_name: currentUser // שימוש בזהות האמיתית
    }]);

    if (!error) {
      await supabase.from('notifications').insert([{
        user_name: postOwnerName, 
        title: 'NEW TRADE INTEREST 📩',
        message: `${currentUser} is interested in your post.`
      }]);

      setIsSent(true);
      setShowInput(false);
    }
  };

  // מנגנון חסימה: אל תציג את הכפתור בכלל אם עדיין לא טענו יוזר, או אם היוזר הוא בעל הפוסט
  if (!currentUser || currentUser === postOwnerName) return null;

  if (isSent) return <div className="text-fi-accent font-bold text-[10px] tracking-widest uppercase py-2">Interest Logged</div>;

  return (
    <div className="w-full mt-4">
      {!showInput ? (
        <button 
          onClick={() => setShowInput(true)}
          className="w-full py-2.5 bg-white !text-black !font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-all active:scale-95"
        >
          I'm Interested
        </button>
      ) : (
        <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
          <textarea 
            placeholder="Pitch your trade offer (optional)..."
            className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-xs focus:border-fi-accent outline-none min-h-[80px] resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleInterestSubmit} className="flex-1 py-2 bg-fi-accent text-black font-bold text-[10px] rounded uppercase hover:bg-yellow-500 transition-colors">Send Interest</button>
            <button onClick={() => setShowInput(false)} className="px-4 py-2 text-gray-500 font-bold text-[10px] uppercase hover:text-white">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}