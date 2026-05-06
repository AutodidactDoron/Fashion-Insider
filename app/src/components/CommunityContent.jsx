import React, { useState, useEffect } from 'react';
import VaultSelectorModal from './VaultSelectorModal';
import { supabase } from '../supabaseClient'; 
import InterestedAction from './InterestedAction';
import TrustBadge from './TrustBadge';

export default function CommunityContent() {
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [attachedAssets, setAttachedAssets] = useState([]);
  const [feed, setFeed] = useState([]); 
  const [broadcastText, setBroadcastText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeed();
    const channel = supabase
      .channel('community_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, () => {
        fetchFeed();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFeed = async () => {
    const { data } = await supabase
      .from('community_posts')
      .select('*')
      .order('bumped_at', { ascending: false })
      .limit(50);
    
    if (data) setFeed(data);
    setIsLoading(false);
  };

  const handleAssetsSelected = (newAssets) => {
    setAttachedAssets(prev => [...prev, ...newAssets]);
  };

  const removeAsset = (assetId) => {
    setAttachedAssets(prev => prev.filter(a => a.id !== assetId));
  };

  const handleBroadcast = async () => {
    if (!broadcastText.trim() && attachedAssets.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.user_metadata?.user_name) {
      alert("Authentication error: Please log in to broadcast.");
      return;
    }

    const liveUsername = user.user_metadata.user_name;

    const newPost = {
      user_name: liveUsername,
      is_pro: true,
      is_verified: true,
      type: 'WTS', 
      content: broadcastText,
      assets: attachedAssets
      // bids_count הוסר לחלוטין מהלוגיקה החדשה
    };

    const { error } = await supabase.from('community_posts').insert([newPost]);

    if (!error) {
      setBroadcastText('');
      setAttachedAssets([]);
      fetchFeed();
    }
  };

  return (
    <section id="community-section" className="pb-20">
      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* הפיד המרכזי */}
        <div className="flex-1 space-y-6 min-w-0">
          
          <div className="bg-[#111113] rounded-xl p-3 sm:p-5 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-fi-accent" />
            
            <div className="flex items-center gap-2 sm:gap-4 w-full">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Founder" alt="Me" className="w-full h-full object-cover" />
              </div>
              
              <input
                type="text"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Broadcast a trade..."
                className="flex-1 min-w-0 w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-white placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:border-fi-accent transition-all"
              />

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsVaultOpen(true)} 
                  className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-fi-accent hover:border-fi-accent hover:bg-fi-accent/10 transition-all group"
                  title="Attach Vault Asset"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleBroadcast} 
                  className="w-9 h-9 sm:w-auto sm:px-6 sm:py-3 shrink-0 flex items-center justify-center rounded-lg bg-white text-black font-bold text-sm hover:bg-gray-200 transition-colors"
                >
                  <span className="hidden sm:inline">BROADCAST</span>
                  <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>

            {attachedAssets.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5 w-full">
                {attachedAssets.map(asset => (
                  <div key={asset.id} className="flex items-center gap-2 bg-black/40 border border-fi-accent/20 rounded-lg p-1.5 pr-3 shadow-sm">
                    <img src={asset.stock_image_url} alt="" className="w-8 h-6 object-contain bg-white rounded-sm" />
                    <span className="text-[11px] font-bold text-white truncate max-w-[100px]">{asset.name}</span>
                    <button onClick={() => removeAsset(asset.id)} className="text-gray-500 hover:text-white transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {feed.map((post) => (
              <div key={post.id} className="bg-[#111113] rounded-xl p-4 sm:p-6 border border-white/5 hover:border-white/10 transition-colors group">
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0">
                    {post.user_name ? post.user_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm sm:text-base">{post.user_name}</span>
                        <TrustBadge username={post.user_name} className="text-[9px] sm:text-[10px] bg-black/50 border border-white/5 px-2 py-0.5 rounded shadow-sm" />
                        {post.is_pro && <span className="text-xs sm:text-sm" title="PRO Trader">👑</span>}
                        {post.is_verified && (
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-fi-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <span className="text-gray-500 text-[10px] sm:text-xs ml-1 sm:ml-2">
                          · {new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 rounded shrink-0 ${post.type === 'WTS' ? 'bg-red-500/10 text-red-400' : post.type === 'WTB' ? 'bg-green-500/10 text-green-400' : 'bg-purple-500/10 text-purple-400'}`}>
                        {post.type}
                      </span>
                    </div>
                    
                    <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mt-2 break-words">
                      {post.content}
                    </p>
                    
                    {post.assets && post.assets.length > 0 && (
                      <div className="flex gap-2 mt-3 sm:mt-4 flex-wrap">
                        {post.assets.map((asset, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md bg-white/5 border border-white/10 text-[10px] sm:text-xs text-gray-300 font-medium tracking-wide">
                            {asset.stock_image_url && (
                              <img src={asset.stock_image_url} alt="" className="w-5 h-3 sm:w-6 sm:h-4 object-contain bg-white rounded-sm" />
                            )}
                            <span className="truncate max-w-[120px] sm:max-w-full">{asset.brand && asset.name ? `${asset.brand} ${asset.name}` : asset}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* הסרנו את בלוק ה-Bids, יישרנו את כפתור ה-Interested לימין המוחלט */}
                    <div className="flex items-center justify-end mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-white/5">
                      <InterestedAction postId={post.id} postOwnerName={post.user_name} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* צד ימין - מודיעין שוק */}
        <div className="w-full xl:w-80 shrink-0 space-y-6">
          
          {/* מנוע FOMO חדש: Recent Executions במקום Volume Watch */}
          <div className="bg-[#111113] rounded-xl p-5 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">Recent Executions</h3>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            </div>
            <div className="space-y-4 relative z-10">
              {[
                { item: "Jordan 1 'Chicago'", action: "Trade Locked", time: "2m ago" },
                { item: "Yeezy 350 V2", action: "Sold for CR", time: "14m ago" },
                { item: "Supreme Bogo", action: "Trade Locked", time: "1h ago" },
              ].map((activity, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="min-w-0 pr-3">
                    <span className="block text-sm font-semibold text-gray-300 group-hover:text-white transition-colors truncate">{activity.item}</span>
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest">{activity.time}</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shrink-0 ${activity.action === 'Trade Locked' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'}`}>
                    {activity.action}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111113] rounded-xl p-5 border border-white/10">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Top Traders</h3>
            <div className="space-y-4">
              {[
                { name: 'SneakerKing', rank: '1', score: '99.8' },
                { name: 'HypeTrader', rank: '2', score: '98.5' },
                { name: 'VaultBoy', rank: '3', score: '95.2' },
              ].map((whale, i) => (
                <div key={i} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                  <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-gray-400 font-bold text-xs border border-white/5">
                    #{whale.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-bold truncate">{whale.name}</div>
                    <div className="text-gray-500 text-xs">Trust Score: <span className="text-fi-accent">{whale.score}%</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <VaultSelectorModal 
        isOpen={isVaultOpen} 
        onClose={() => setIsVaultOpen(false)} 
        onAssetsSelected={handleAssetsSelected}
        excludedIds={attachedAssets.map(a => a.id)} 
      />
    </section>
  );
}