import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from '../supabaseClient';
import UpgradeModal from './UpgradeModal';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ⚡ THE LOGIC ENGINE: Shared Trust Tier Architecture
function getTrustTier(score) {
  if (score < 20) return { label: 'GHOST', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
  if (score < 50) return { label: 'ROOKIE', color: 'text-gray-400', bg: 'bg-white/5', border: 'border-white/10' };
  if (score < 80) return { label: 'VERIFIED', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
  if (score < 95) return { label: 'PRO', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
  return { label: 'APEX', color: 'text-black', bg: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400', border: 'border-yellow-400/50' };
}

export default function MyPostsContent() {
  const navigate = useNavigate(); 
  const [myPosts, setMyPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [interests, setInterests] = useState({});
  const [currentUser, setCurrentUser] = useState({ id: null, name: null, isPro: false });
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // ⚡ RATE LIMIT TRACKING STATE
  const [dailyPostCount, setDailyPostCount] = useState(0);

  const openPanelsRef = useRef(new Set());
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // שליפת השם והסטטוס PRO ישירות מפרופיל הליבה
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_name, is_pro')
          .eq('id', user.id)
          .single();

        const explicitName = profile?.user_name || user.user_metadata?.user_name;
        const isPro = profile?.is_pro || false;

        setCurrentUser({ id: user.id, name: explicitName, isPro });
        
        fetchMyPosts(explicitName || user.id); 
        fetchDailyPostUsage(explicitName || user.id);
      } else {
        setIsLoading(false); 
      }
    };
    initPage();
  }, []);

  useEffect(() => {
    const triggerRefresh = () => setRefreshTick(t => t + 1);
    window.addEventListener('refresh_offers', triggerRefresh);
    return () => window.removeEventListener('refresh_offers', triggerRefresh);
  }, []);

  useEffect(() => {
    if (refreshTick > 0) {
      openPanelsRef.current.forEach(postId => {
        fetchOffersForPost(postId);
      });
    }
  }, [refreshTick]);

  // ⚡ 1. ספירת כל הפוסטים שנוצרו ב-24 השעות האחרונות (כולל אלו שנמחקו!)
  const fetchDailyPostUsage = async (userIdentifier) => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .or(`user_name.eq.${userIdentifier},user_name.eq.${currentUser.id}`)
      .gte('created_at', twentyFourHoursAgo); 

    if (!error && count !== null) {
      setDailyPostCount(count);
    }
  };

  const fetchMyPosts = async (userIdentifier) => {
    setIsLoading(true);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .or(`user_name.eq.${userIdentifier},user_name.eq.${currentUser.id}`)
      .gte('bumped_at', twentyFourHoursAgo)
      .order('bumped_at', { ascending: false });

    if (data) setMyPosts(data);
    if (error) console.error("Error fetching posts:", error);
    setIsLoading(false);
  };

  const fetchOffersForPost = async (postId) => {
    const { data: interestsData, error } = await supabase
      .from('post_interests')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error || !interestsData) return;

    const potentialUUIDs = new Set();
    const potentialNames = new Set();
    
    interestsData.forEach(offer => {
      if (UUID_REGEX.test(offer.sender_name)) potentialUUIDs.add(offer.sender_name);
      else potentialNames.add(offer.sender_name);
    });

    const profilesMap = {};

    if (potentialUUIDs.size > 0 || potentialNames.size > 0) {
      let query = supabase.from('user_profiles').select('id, user_name, trust_score');
      if (potentialUUIDs.size > 0) query = query.in('id', Array.from(potentialUUIDs));
      
      const { data: profilesData } = await query;

      if (profilesData) {
        profilesData.forEach(p => {
          profilesMap[p.id] = { name: p.user_name, ts: p.trust_score || 0 };
          profilesMap[p.user_name] = { name: p.user_name, ts: p.trust_score || 0 };
        });
      }
    }

    const enrichedInterests = interestsData.map(offer => {
      let parsedMessage = offer.message;
      let attachedAssets = [];

      if (offer.message && offer.message.startsWith('__PRO_OFFER__:')) {
        try {
          const jsonStr = offer.message.replace('__PRO_OFFER__:', '');
          const payload = JSON.parse(jsonStr);
          parsedMessage = payload.text;
          attachedAssets = payload.assets || [];
        } catch (e) {
          console.error("Failed parsing structured offer payload", e);
        }
      }

      const profileData = profilesMap[offer.sender_name];
      const display_name = profileData ? profileData.name : (UUID_REGEX.test(offer.sender_name) ? offer.sender_name.substring(0, 8) : offer.sender_name);
      const trustScore = profileData ? profileData.ts : 0;

      return {
        ...offer,
        display_name,
        trustScore,
        parsedMessage,
        attachedAssets
      };
    });

    setInterests(prev => ({ ...prev, [postId]: enrichedInterests }));
  };

  const handleToggleInterests = async (postId) => {
    if (openPanelsRef.current.has(postId)) {
      openPanelsRef.current.delete(postId);
      setInterests(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    } else {
      openPanelsRef.current.add(postId);
      await fetchOffersForPost(postId);
    }
  };

  const handleDelete = async (postId) => {
    const { error } = await supabase
      .from('community_posts')
      .update({ is_deleted: true })
      .eq('id', postId);

    if (!error) {
      setMyPosts(prev => prev.filter(post => post.id !== postId));
      fetchDailyPostUsage(currentUser.name || currentUser.id);
    } else {
      alert("Error deleting post.");
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

  const handleInviteToTrade = async (postId, responderName, responderId) => {
    if (!currentUser.name) return alert("System Identity Check Failed. Please refresh.");

    try {
      const { data: roomData, error: roomError } = await supabase
        .from('trade_rooms')
        .insert([{
          post_id: postId,
          initiator_name: currentUser.name,
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

      await supabase
        .from('post_interests')
        .update({ status: 'accepted' })
        .eq('post_id', postId)
        .eq('sender_name', responderId);

      await supabase.from('notifications').insert([{
        user_name: responderName,
        title: 'TRADE INVITATION 🤝',
        message: `You were invited to a private trade room. Go to My Trades to enter.`
      }]);

      navigate('/trades'); 
      
    } catch (err) {
      console.error("Client Execution Error:", err);
    }
  };

  const handleBumpPost = async (postId) => {
    if (!currentUser.name) return alert("User identification error.");

    try {
      const { data, error } = await supabase.rpc('bump_post', {
        p_post_id: postId,
        p_user_name: currentUser.name,
        p_bump_cost: 50
      });

      if (error) {
        if (error.message.includes('INSUFFICIENT_FUNDS')) {
          alert("Insufficient Credits! You need 50 CR to bump this post.");
        } else {
          alert("Bump failed: " + error.message);
        }
        return;
      }

      alert("🚀 Broadcast successfully bumped to the top of the market!");
      fetchMyPosts(currentUser.name || currentUser.id);

    } catch (err) {
      console.error("Bump Error:", err);
    }
  };

  if (isLoading) return <div className="text-white p-8">Loading your vault...</div>;

  const maxPosts = currentUser.isPro ? 15 : 3;
  const usagePercentage = Math.min(100, Math.round((dailyPostCount / maxPosts) * 100));
  const isLimitReached = dailyPostCount >= maxPosts;

  return (
    <section id="my-posts-section" className="pb-20 max-w-4xl mx-auto">
      
      {/* ⚡ THE GEMINI SCARCITY BAR */}
      <div className="mb-6 bg-[#111113] border border-white/10 rounded-2xl p-5 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isLimitReached ? 'bg-red-500 animate-pulse' : 'bg-fi-accent'}`} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">24h Broadcast Quota</h3>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${currentUser.isPro ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/10 text-gray-400'}`}>
                  {currentUser.isPro ? 'PRO TIER' : 'FREE TIER'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {isLimitReached 
                  ? "Quota exhausted. Upgrade to PRO or wait for reset." 
                  : `${maxPosts - dailyPostCount} broadcasts remaining today.`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-black text-white">{dailyPostCount} / {maxPosts}</span>
            <span className="text-[10px] text-gray-500 ml-1">POSTS</span>
          </div>
        </div>

        <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5 p-0.5">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              isLimitReached 
                ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]' 
                : usagePercentage > 66 
                ? 'bg-amber-400' 
                : 'bg-gradient-to-r from-fi-accent via-yellow-400 to-amber-500'
            }`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </div>

      {/* ⚡ THE NEW PRO BANNER INJECTION (Replaces the old inline text trigger) */}
      {!currentUser.isPro && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-950/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-amber-500 font-black tracking-widest text-sm uppercase">Boost Your Visibility</h3>
            <p className="text-zinc-400 text-xs mt-1">Upgrade to PRO to unlock 15 daily broadcasts and priority feed placement.</p>
          </div>
          <button
            onClick={() => setIsUpgradeModalOpen(true)}
            className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs tracking-widest px-6 py-2.5 rounded shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all uppercase"
          >
            UPGRADE TO PRO
          </button>
        </div>
      )}

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
                <button 
                  onClick={() => handleBumpPost(post.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-fi-accent/10 text-fi-accent border border-fi-accent/30 hover:bg-fi-accent hover:text-black font-black text-xs transition-all shadow-md"
                >
                  ⚡ BUMP (50 CR)
                </button>
              </div>

              <div className="mt-6 border-t border-white/5 pt-4">
                <button 
                  onClick={() => handleToggleInterests(post.id)}
                  className="text-[10px] font-black text-fi-accent uppercase tracking-widest hover:underline flex items-center gap-1.5"
                >
                  {openPanelsRef.current.has(post.id) ? 'Hide Offers' : 'View Incoming Offers'}
                </button>

                {openPanelsRef.current.has(post.id) && interests[post.id] && (
                  <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    {interests[post.id].length === 0 ? (
                      <p className="text-gray-500 text-xs italic">No offers received yet.</p>
                    ) : (
                      interests[post.id].map(offer => {
                        const tier = getTrustTier(offer.trustScore);

                        return (
                          <div key={offer.id} className="bg-black/50 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-fi-accent/30 transition-all duration-300 shadow-md">
                            <div className="flex items-start gap-4 min-w-0">
                              
                              {offer.attachedAssets && offer.attachedAssets.length > 0 && (
                                <div className="w-16 h-12 rounded bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-1">
                                  <img 
                                    src={offer.attachedAssets[0].stock_image_url} 
                                    alt="" 
                                    className="w-full h-full object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-white font-black text-sm truncate max-w-[120px]">{offer.display_name}</span>
                                  
                                  <div className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded border ${tier.bg} ${tier.border}`}>
                                    <span className={`text-[8px] font-black tracking-widest uppercase ${tier.color} ${tier.label === 'APEX' ? 'animate-pro-shine' : ''}`}>
                                      {tier.label}
                                    </span>
                                    <span className="text-[9px] font-bold text-white/80 border-l border-white/10 pl-1.5">
                                      {offer.trustScore}<span className="text-[7px] ml-0.5 opacity-50">TS</span>
                                    </span>
                                  </div>

                                  <span className="bg-fi-accent/10 border border-fi-accent/20 text-fi-accent text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider hidden sm:inline-block">
                                    Open
                                  </span>
                                </div>
                                <p className="text-gray-200 text-xs font-semibold leading-relaxed max-w-xl break-words">
                                  {offer.parsedMessage || "No specific message provided."}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 shrink-0 justify-end">
                              <button 
                                onClick={() => handleInviteToTrade(post.id, offer.display_name, offer.sender_name)}
                                className="px-4 py-2.5 bg-fi-accent text-black font-black text-[10px] rounded uppercase hover:bg-yellow-500 transition-colors shadow-lg"
                              >
                                Invite
                              </button>
                              <button className="px-4 py-2.5 bg-white/5 text-gray-400 font-bold text-[10px] rounded uppercase hover:bg-red-500/10 hover:text-red-400 transition-colors">
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ⚡ THE PORTAL INJECTION (Upgrade Modal) */}
      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
        currentUser={currentUser} 
      />
    </section>
  );
}