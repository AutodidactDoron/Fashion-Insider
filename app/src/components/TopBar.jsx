import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import TopUpModal from './TopUpModal'; 
import CreateTradeModal from './CreateTradeModal';
import NotificationBell from './NotificationBell';

export default function TopBar({ toggleSidebar }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isTradeOpen, setIsTradeOpen] = useState(false);

  const searchInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const marketCatalog = [
    { id: 1, name: "Nike Air Force 1 White", brand: "Nike", price: "10,250 CR" },
    { id: 2, name: "Nike Vomero 5 Silver Grey", brand: "Nike", price: "21,000 CR" },
    { id: 3, name: "New Balance 9060 Phantom", brand: "New Balance", price: "18,500 CR" },
    { id: 4, name: "Air Jordan 1 Retro High Chicago", brand: "Jordan", price: "36,500 CR" },
    { id: 5, name: "Yeezy Boost 350 V2 Zebra", brand: "Yeezy", price: "15,000 CR" }
  ];

  const searchResults = searchQuery.trim() === '' 
    ? [] 
    : marketCatalog.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.brand.toLowerCase().includes(searchQuery.toLowerCase())
      );

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

  function syncSession() {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    syncSession();
  }, [location.pathname]);

  function handleLogout() {
    supabase.auth.signOut();
    navigate('/dashboard', { replace: true });
  }

  return (
    <>
      <header className="fixed top-0 left-0 md:left-56 right-0 z-40 h-20 box-border bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-3 sm:px-6 transition-all">
        
        {/* צד שמאל - תפריט מובייל ושורת חיפוש (רספונסיבית) */}
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
          
          {/* מנוע החיפוש - זמין עכשיו גם במובייל */}
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
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                placeholder="Search items, brands, or collections..." 
                className="w-full bg-[#111113] border border-white/10 focus:border-fi-accent rounded-lg pl-8 sm:pl-10 pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 outline-none transition-all shadow-inner relative z-0"
              />
              
              {!searchQuery && (
                <div className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-1 bg-white/10 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded border border-white/5 z-10 pointer-events-none whitespace-nowrap">
                  <span>/</span> <span className="hidden lg:inline">to search</span>
                </div>
              )}
            </div>

            {isSearchFocused && searchQuery.trim() !== '' && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#111113] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Market Results</span>
                  <span className="text-[10px] font-black text-fi-accent">{searchResults.length} Found</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 font-medium">No assets found for "{searchQuery}"</div>
                  ) : (
                    searchResults.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-white/5 border border-white/10 rounded md flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{item.brand.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white group-hover:text-fi-accent transition-colors truncate">{item.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">{item.brand}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-white bg-white/10 px-2 py-1 rounded shrink-0 ml-3">{item.price}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* צד ימין - פרופיל וארנק */}
        <div className="flex items-center gap-2 sm:gap-4 ml-2 shrink-0">
          
          <button className="hidden xl:inline-flex px-3 py-1.5 rounded-lg font-bold text-xs text-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 animate-pro-shine hover:opacity-95 transition-opacity whitespace-nowrap items-center shadow-[0_0_15px_rgba(255,215,0,0.1)] shrink-0">
            UPGRADE TO PRO
          </button>
          
          <button 
            onClick={() => setIsTradeOpen(true)} 
            className="hidden md:inline-flex px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-[10px] hover:bg-white hover:text-black transition-all items-center whitespace-nowrap uppercase tracking-wider shrink-0"
          >
            LIST ITEM
          </button>

          <NotificationBell currentUser={user?.user_metadata?.user_name || "DemoUser"} />
          
          {user ? (
            <div className="flex items-center gap-2 border-l border-white/10 pl-2 sm:pl-4 shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#111113] border border-white/20 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-white/40 transition-colors">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Profile" className="w-full h-full object-cover" />
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

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden lg:block text-white font-black text-sm tracking-wide whitespace-nowrap">5,450 CR</span>
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
      <CreateTradeModal isOpen={isTradeOpen} onClose={() => setIsTradeOpen(false)} />
    </>
  );
}