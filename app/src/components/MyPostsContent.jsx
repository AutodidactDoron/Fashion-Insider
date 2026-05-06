import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // המנוע הקריטי שחסר לקפיצת העמוד
import { supabase } from '../supabaseClient';

export default function MyPostsContent() {
  const navigate = useNavigate(); // אתחול מנוע הניווט

  const [myPosts, setMyPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State לניהול עריכה בזמן אמת
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');

  // State לניהול ההצעות
  const [interests, setInterests] = useState({});

  // הליבה הדינמית
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.user_metadata?.user_name) {
        const username = user.user_metadata.user_name;
        setCurrentUser(username);
        fetchMyPosts(username); 
      } else {
        setIsLoading(false); 
      }
    };
    initPage();
  }, []);

  const fetchMyPosts = async (username) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .eq('user_name', username) 
      .order('created_at', { ascending: false });

    if (data) setMyPosts(data);
    if (error) console.error("Error fetching posts:", error);
    setIsLoading(false);
  };

  const handleToggleInterests = async (postId) => {
    if (interests[postId]) {
      setInterests(prev => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
      return;
    }

    const { data, error } = await supabase
      .from('post_interests')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (data) {
      setInterests(prev => ({ ...prev, [postId]: data }));
    }
  };

  const handleDelete = async (postId) => {
    const { error } = await supabase.from('community_posts').delete().eq('id', postId);
    if (!error) {
      setMyPosts(prev => prev.filter(post => post.id !== postId));
    }
  };

  const handleEditStart = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
  };

  const handleEditCancel = () => {
    setEditingPostId(null);
    setEditContent('');
  };

  const handleEditSave = async (postId) => {
    if (!editContent.trim()) return;
    const { error } = await supabase.from('community_posts').update({ content: editContent }).eq('id', postId);
    if (!error) {
      setMyPosts(prev => prev.map(post => post.id === postId ? { ...post, content: editContent } : post));
      setEditingPostId(null);
    }
  };

  // --- TRADE ROOM INITIALIZATION (מנוע יצירת חדר המסחר ששודרג) ---
  const handleInviteToTrade = async (postId, responderName) => {
    if (!currentUser) return alert("You must be logged in.");

    try {
      // 1. יצירת החדר ב-Database
      const { data: roomData, error: roomError } = await supabase
        .from('trade_rooms')
        .insert([{
          post_id: postId,
          initiator_name: currentUser,
          responder_name: responderName,
          status: 'pending_acceptance'
        }])
        .select()
        .single();

      if (roomError) {
        console.error("Trade Room Creation Error:", roomError);
        alert("System Error: Could not initialize secure room.");
        return;
      }

      // 2. עדכון סטטוס ההצעה
      await supabase
        .from('post_interests')
        .update({ status: 'accepted' })
        .eq('post_id', postId)
        .eq('sender_name', responderName);

      // 3. ירי ההתראה לצד השני
      await supabase.from('notifications').insert([{
        user_name: responderName,
        title: 'TRADE INVITATION 🤝',
        message: `${currentUser} invited you to a private trade room. Go to My Trades to enter.`
      }]);

      // 4. קפיצה פיזית לעמוד הטריידים החדש שלך
      navigate('/trades'); 
      
    } catch (err) {
      console.error("Client Execution Error:", err);
    }
  };

  if (isLoading) return <div className="text-white p-8">Loading your vault...</div>;

  return (
    <section id="my-posts-section" className="pb-20 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">My Active Broadcasts</h1>
          <p className="text-gray-500 text-sm mt-1">Manage, edit, or delete your market positions.</p>
        </div>
        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
          <span className="text-fi-accent font-bold">{myPosts.length}</span>
          <span className="text-gray-400 text-xs ml-2 uppercase tracking-wider">Active</span>
        </div>
      </div>

      {myPosts.length === 0 ? (
        <div className="bg-[#111113] border border-white/10 rounded-xl p-12 text-center">
          <p className="text-gray-500 font-medium">You have no active broadcasts in the market.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myPosts.map((post) => (
            <div key={post.id} className="bg-[#111113] rounded-xl p-5 sm:p-6 border border-white/5 hover:border-white/10 transition-colors shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${post.type === 'WTS' ? 'bg-red-500/10 text-red-400' : post.type === 'WTB' ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {post.type}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(post.created_at).toLocaleDateString()} · {new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>

              {editingPostId === post.id ? (
                <div className="mb-4">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-black/50 border border-fi-accent/50 rounded-lg p-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-fi-accent transition-all min-h-[100px]"
                  />
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleEditSave(post.id)} className="px-4 py-2 bg-white text-black font-bold text-xs rounded hover:bg-gray-200 transition-colors">
                      SAVE CHANGES
                    </button>
                    <button onClick={handleEditCancel} className="px-4 py-2 bg-transparent text-gray-400 font-bold text-xs hover:text-white transition-colors">
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-300 text-sm leading-relaxed mb-4">
                  {post.content}
                </p>
              )}

              {post.assets && post.assets.length > 0 && (
                <div className="flex gap-2 mb-6 flex-wrap">
                  {post.assets.map((asset, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-gray-300 font-medium tracking-wide">
                      {asset.stock_image_url && (
                        <img src={asset.stock_image_url} alt="" className="w-6 h-4 object-contain bg-white rounded-sm" />
                      )}
                      <span>{asset.brand && asset.name ? `${asset.brand} ${asset.name}` : asset}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                <button 
                  onClick={() => handleEditStart(post)}
                  disabled={editingPostId === post.id}
                  className="flex items-center gap-2 px-4 py-2 rounded bg-white/5 text-white hover:bg-white/10 font-bold text-xs transition-colors disabled:opacity-50"
                >
                  EDIT
                </button>
                <button 
                  onClick={() => {
                    if(window.confirm('Are you sure you want to delete this broadcast?')) {
                      handleDelete(post.id);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white font-bold text-xs transition-colors"
                >
                  DELETE
                </button>
              </div>

              {/* INCOMING OFFERS SECTION */}
              <div className="mt-6 border-t border-white/5 pt-4">
                <button 
                  onClick={() => handleToggleInterests(post.id)}
                  className="text-[10px] font-black text-fi-accent uppercase tracking-widest hover:underline flex items-center gap-1.5"
                >
                  {interests[post.id] ? 'Hide Offers' : 'View Incoming Offers'}
                </button>

                {interests[post.id] && (
                  <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    {interests[post.id].length === 0 ? (
                      <p className="text-gray-500 text-xs italic">No offers received yet.</p>
                    ) : (
                      interests[post.id].map(offer => (
                        <div key={offer.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-4 flex justify-between items-center group hover:border-white/10 transition-colors">
                          <div>
                            <p className="text-white font-bold text-xs flex items-center gap-2">
                              {offer.sender_name}
                              <span className="bg-white/10 text-gray-400 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">Offer</span>
                            </p>
                            <p className="text-gray-400 text-[11px] mt-1.5">{offer.message || "No specific message provided."}</p>
                          </div>
                          <div className="flex gap-2">
                            {/* --- הכפתור הקריטי המעודכן --- */}
                            <button 
                              onClick={() => handleInviteToTrade(post.id, offer.sender_name)}
                              className="px-4 py-2 bg-fi-accent text-black font-bold text-[10px] rounded uppercase hover:bg-yellow-500 transition-colors shadow-lg"
                            >
                              Invite to Trade
                            </button>
                            {/* ----------------------------- */}
                            <button className="px-4 py-2 bg-white/5 text-gray-400 font-bold text-[10px] rounded uppercase hover:bg-red-500/10 hover:text-red-400 transition-colors">
                              Decline
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </section>
  );
}