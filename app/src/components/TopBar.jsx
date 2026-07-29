import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import TopUpModal from './TopUpModal'; 
import NotificationBell from './NotificationBell';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import UpgradeModal from './UpgradeModal';

const CONDITION_MULTIPLIERS = {
  DS: 1.0,
  VNDS: 0.85,
  USED: 0.65,
};

export default function TopBar({ toggleSidebar }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isProUser, setIsProUser] = useState(false); // ⚡ NEW STATE: Tracking PRO in TopBar

  const searchInputRef = useRef(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem('fi_last_market_search') || '';
  });
  
  const [catalogItems, setCatalogItems] = useState([]);
  const [selectedShoe, setSelectedShoe] = useState(null);
  const [chartData, setChartData] = useState([]);

  const [liveCredits, setLiveCredits] = useState(0);
  const [userEscrowCredits, setUserEscrowCredits] = useState(0);
  const [userAvatar, setUserAvatar] = useState(null);

  useEffect(() => {
    localStorage.setItem('fi_last_market_search', searchQuery);
  }, [searchQuery]);

  // ⚡ מנוע סנכרון קטלוג - Initial Fetch + Realtime WebSockets
  useEffect(() => {
    const fetchCatalog = async () => {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*');

      if (!error && data) {
        const formattedData = data.map(item => ({
          id: item.id,
          name: item.name,
          brand: item.brand,
          rawMin: item.min_range,
          rawMax: item.max_range,
          rawMarketValue: item.market_value,
          img: item.stock_image_url
        }));
        setCatalogItems(formattedData);
      }
    };
    
    fetchCatalog();

    // פתיחת ערוץ האזנה שקוף לתוספות חדשות לקטלוג (ESTABLISH)
    const catalogSubscription = supabase
      .channel('global_market_index')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'catalog_items' },
        (payload) => {
          const newItem = payload.new;
          // עיבוד המידע למבנה המקומי והזרקתו לזיכרון של החיפוש
          const formattedItem = {
            id: newItem.id,
            name: newItem.name,
            brand: newItem.brand,
            rawMin: newItem.min_range,
            rawMax: newItem.max_range,
            rawMarketValue: newItem.market_value,
            img: newItem.stock_image_url
          };
          setCatalogItems(prev => [...prev, formattedItem]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(catalogSubscription);
    };
  }, []);

  // ⚡ אלגוריתם חיפוש חכם (Case-Insensitive & Multi-Field)
  const searchResults = useMemo(() => {
    if (searchQuery.trim() === '') return [];
    const query = searchQuery.toLowerCase();
    
    return catalogItems.filter(item => {
      // חיפוש גמיש גם בשם הדגם וגם בשם המותג
      const nameMatch = item.name ? item.name.toLowerCase().includes(query) : false;
      const brandMatch = item.brand ? item.brand.toLowerCase().includes(query) : false;
      return nameMatch || brandMatch;
    }).slice(0, 5); // הגבלת תוצאות לביצועים
  }, [catalogItems, searchQuery]);

  useEffect(() => {
    if (selectedShoe) {
      const generateRealisticData = () => {
        let basePrice = selectedShoe.rawMarketValue * CONDITION_MULTIPLIERS[selectedShoe.condition];
        return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => {
          basePrice = basePrice * (1 + (Math.random() * 0.15 - 0.075));
          return { date: month, price: Math.round(basePrice) };
        });
      };
      setChartData(generateRealisticData());
    }
  }, [selectedShoe]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
        if (e.key === '/' && document.activeElement.tagName === 'INPUT') return;
        e.preventDefault(); 
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchUserWallet = async (userId) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('credits, escrow_credits, avatar_url, is_pro') // ⚡ Added is_pro
      .eq('id', userId)
      .single();
    
    if (data) {
      setLiveCredits(data.credits || 0);
      setUserEscrowCredits(data.escrow_credits || 0);
      setUserAvatar(data.avatar_url);
      setIsProUser(data.is_pro || false); // ⚡ Assigning to state
    }
  };

  function syncSession() {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserWallet(currentUser.id);
      }
    });
  }

  useEffect(() => {
    syncSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchUserWallet(currentUser.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    syncSession();
  }, [location.pathname]);

  useEffect(() => {
    const handleCreditUpdate = () => {
      if (user) fetchUserWallet(user.id);
    };
    window.addEventListener('update_global_credits', handleCreditUpdate);
    return () => window.removeEventListener('update_global_credits', handleCreditUpdate);
  }, [user]);

  function handleLogout() {
    supabase.auth.signOut();
    navigate('/dashboard', { replace: true });
  }

  // ⚡ THE NAVIGATION INJECTION: הוספת לוגיקת הניתוב עבור ה-TopBar
  const handleProfileClick = () => {
    const username = user?.user_metadata?.user_name || user?.email?.split('@')[0];
    if (username) {
      navigate(`/profile/${username}`);
    }
  };

  const handleResultClick = (item) => {
    setSelectedShoe({ ...item, condition: 'DS' });
    setIsSearchFocused(false);
  };

  const handleSearchFocus = (e) => {
    setIsSearchFocused(true);
    e.target.select();
  };

  return (
    <>
      <header className="fixed top-0 left-0 md:left-56 right-0 z-40 h-20 box-border bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-3 sm:px-6 transition-all">
        
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={toggleSidebar}
            className="md:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="relative w-full max-w-2xl group flex-1 min-w-0">
            <div className="relative">
              <svg className={`absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors z-10 pointer-events-none ${isSearchFocused ? 'text-fi-accent' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              
              <input 
                ref={searchInputRef}
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                placeholder="Search globally (Press Q/' to focus)..." 
                className="w-full bg-[#111113] border border-white/10 focus:border-fi-accent rounded-lg pl-8 sm:pl-10 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 outline-none transition-all shadow-inner relative z-0"
              />
            </div>

            {isSearchFocused && searchQuery.trim() !== '' && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#111113] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Live Market Data</span>
                  <span className="text-[10px] font-black text-fi-accent">{searchResults.length} Found</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 font-medium">No assets found for "{searchQuery}"</div>
                  ) : (
                    searchResults.map(item => (
                      <div 
                        key={item.id} 
                        onMouseDown={() => handleResultClick(item)}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={item.img} alt={item.name} className="w-10 h-8 object-contain bg-white/5 rounded border border-white/10 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white group-hover:text-fi-accent transition-colors truncate">{item.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">{item.brand}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-white bg-white/10 px-2 py-1 rounded shrink-0 ml-3">
                          {item.rawMarketValue.toLocaleString()} CR
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 ml-2 shrink-0">
          
          {/* ⚡ THE UPGRADE BUTTON / PRO STAR BADGE INJECTION */}
          {isProUser ? (
            <div title="PRO Status Active" className="hidden xl:flex items-center justify-center w-9 h-9 rounded-full bg-[linear-gradient(110deg,#e2e8f0_10%,#fbcfe8_35%,#c4b5fd_50%,#99f6e4_65%,#e2e8f0_90%)] bg-[length:200%_auto] animate-pro-shine border border-white/50 shadow-[0_0_15px_rgba(203,213,225,0.4)] shrink-0 transition-all cursor-help hover:scale-105 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/90 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <svg className="w-4 h-4 text-zinc-900 drop-shadow-sm relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
          ) : (
            <button 
              type="button"
              onClick={() => setIsUpgradeModalOpen(true)}
              className="hidden xl:inline-flex px-3 py-1.5 rounded-lg font-bold text-xs text-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 animate-pro-shine hover:opacity-95 transition-opacity whitespace-nowrap items-center shadow-[0_0_15px_rgba(255,215,0,0.1)] shrink-0"
            >
              UPGRADE TO PRO
            </button>
          )}
          
          <NotificationBell currentUser={user?.user_metadata?.user_name || "DemoUser"} />
          
          {user ? (
            <div className="flex items-center gap-2 border-l border-white/10 pl-2 sm:pl-4 shrink-0">
              <div 
                onClick={handleProfileClick}
                role="button"
                tabIndex={0}
                className="w-8 h-8 rounded-full bg-[#111113] border border-white/20 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-white/40 transition-colors"
              >
                <img 
                  src={userAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} 
                  alt="Profile" 
                  className="w-full h-full object-cover pointer-events-none" 
                />
              </div>
              <button onClick={handleLogout} className="hidden lg:block px-2 py-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 text-[10px] uppercase font-bold whitespace-nowrap transition-colors">
                Logout
              </button>
            </div>
          ) : (
            <div className="border-l border-white/10 pl-2 sm:pl-4 shrink-0">
              <Link to="/login" className="px-3 py-1.5 rounded-lg bg-fi-accent text-black text-[10px] font-bold hover:opacity-90 transition-opacity whitespace-nowrap uppercase tracking-wider">
                Sign in
              </Link>
            </div>
          )}

          <div className="flex items-center gap-4 border-l border-white/10 pl-4 shrink-0">
            <div className="hidden lg:flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-white font-mono font-black text-sm tracking-wide whitespace-nowrap">
                  {liveCredits.toLocaleString()} CR
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">In Escrow:</span>
                <span className="text-amber-400 font-mono font-bold text-[11px]">
                  {userEscrowCredits.toLocaleString()} C
                </span>
              </div>
            </div>

            <button 
              onClick={() => setIsTopUpOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-green-500 text-black text-[10px] font-black hover:bg-green-400 transition-colors whitespace-nowrap uppercase tracking-widest shadow-[0_0_10px_rgba(34,197,94,0.3)] shrink-0"
            >
              TOP UP
            </button>
          </div>
        </div>
      </header>

      <TopUpModal isOpen={isTopUpOpen} onClose={() => setIsTopUpOpen(false)} />

      {/* ⚡ THE PORTAL INJECTION (Upgrade Modal) */}
      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
        currentUser={{ name: user?.user_metadata?.user_name || user?.email?.split('@')[0] }} 
      />

      {selectedShoe && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-white/10 rounded-xl p-6 w-full max-w-2xl relative shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
            <button onClick={() => setSelectedShoe(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="mb-6 pr-8">
              <h2 className="text-xl font-bold text-white mb-2">{selectedShoe.name}</h2>
              
              <div className="flex items-center gap-2">
                {Object.keys(CONDITION_MULTIPLIERS).map(cond => (
                  <button
                    key={cond}
                    onClick={() => setSelectedShoe(prev => ({ ...prev, condition: cond }))}
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all duration-200
                      ${selectedShoe.condition === cond 
                        ? 'bg-fi-accent text-black shadow-[0_0_10px_rgba(255,215,0,0.5)] scale-105' 
                        : 'bg-black/60 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-64 w-full bg-black rounded-lg border border-white/5 p-4" style={{ transform: 'translateZ(0)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} dx={-10} tickFormatter={(value) => `${value}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#111113', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }} itemStyle={{ color: '#FCD535', fontWeight: 'bold' }} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="price" stroke="#FCD535" strokeWidth={3} dot={{ fill: '#111113', stroke: '#FCD535', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#FCD535', stroke: '#111113', strokeWidth: 2 }} isAnimationActive={true} animationDuration={800} animationEasing="ease-out" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6 flex justify-between items-center border-t border-white/5 pt-6">
              <div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Est. Market Value</div>
                <div className="text-white text-xl font-bold animate-in fade-in slide-in-from-bottom-1 duration-300" key={selectedShoe.condition}>
                  {Math.round(selectedShoe.rawMarketValue * CONDITION_MULTIPLIERS[selectedShoe.condition]).toLocaleString()} CR
                </div>
              </div>
              <button onClick={() => setSelectedShoe(null)} className="px-6 py-2 rounded bg-white !text-black !font-bold text-sm hover:bg-gray-200 transition-colors">
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}