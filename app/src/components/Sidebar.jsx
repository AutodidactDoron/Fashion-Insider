import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import TrustBadge from './TrustBadge';

export default function Sidebar({ isOpen, closeSidebar }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    closeSidebar(); 
    navigate('/dashboard', { replace: true });
  };

  return (
    <aside
      id="sidebar"
      className={`fixed top-0 left-0 bottom-0 z-50 w-56 bg-[#111113] border-r border-white/10 flex flex-col overflow-y-auto transform transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
    >
      {/* 1. הלוגו: מומרכז, לחיץ, ונעול לגובה זהה לפס העליון (h-20) */}
      <div className="h-20 flex items-center justify-center border-b border-white/5 shrink-0">
        <Link to="/dashboard" onClick={closeSidebar} className="text-xl font-black hover:opacity-80 transition-opacity tracking-tight cursor-pointer">
          <span className="text-white">Fashion</span> <span className="text-fi-accent">Insider</span>
        </Link>
      </div>

      {user && (
        <div
          className="px-4 py-6 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
          id="user-profile-btn"
          role="button"
          tabIndex={0}
        >
          <div className="flex flex-col items-center text-center">
            <div className="relative inline-block mb-2">
              <img
                id="display-avatar"
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover bg-fi-accent display-avatar shadow-lg shadow-fi-accent/10"
              />
            </div>
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <span id="display-username" className="font-bold text-white truncate max-w-[140px] tracking-wide">
                {user.user_metadata?.user_name || user.email?.split('@')[0]}
              </span>
            </div>
            
            <div id="verified-badge-sidebar-block" className="flex items-center justify-center gap-1 mt-2 text-fi-accent text-[10px] uppercase font-black tracking-widest">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>ID VERIFIED</span>
            </div>

            <div className="mt-4 w-full flex justify-center">
              <TrustBadge 
                username={user.user_metadata?.user_name || user.email?.split('@')[0]} 
                className="bg-black/80 border border-white/10 px-4 py-2 rounded-full text-sm shadow-inner" 
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. תפריט הניווט: הכל מומרכז */}
      <nav className="mt-4 px-4 pb-6 space-y-1.5 text-sm text-gray-400">
        <Link to="/dashboard" onClick={closeSidebar} className="nav-link block w-full text-center py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-white font-medium transition-colors">
          Dashboard
        </Link>
        <Link to="/community" onClick={closeSidebar} className="nav-link block w-full text-center py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-white font-medium transition-colors">
          Community
        </Link>
        <Link to="/my-posts" onClick={closeSidebar} className="nav-link block w-full text-center py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-white font-medium transition-colors">
          My Posts
        </Link>
        <Link to="/closet" onClick={closeSidebar} className="nav-link block w-full text-center py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-white font-medium transition-colors">
          My Closet
        </Link>
        <Link to="/trades" onClick={closeSidebar} className="nav-link block w-full text-center py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-white font-medium transition-colors">
          My Trades
        </Link>
        <Link to="/messages" onClick={closeSidebar} className="nav-link block w-full text-center py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-white font-medium transition-colors">
          Messages
        </Link>
        <Link to="/settings" onClick={closeSidebar} className="nav-link block w-full text-center py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-white font-medium transition-colors">
          Settings
        </Link>

        <div className="pt-5 mt-5 border-t border-white/5 space-y-2">
          <button
            type="button"
            className="lucky-wheel-fab nav-link w-full text-center py-2.5 px-3 rounded-lg hover:bg-amber-500/10 hover:text-amber-400 flex items-center justify-center gap-2 text-amber-400/90 transition-colors"
          >
            <span className="lucky-wheel-fab-icon text-lg">🎡</span>
            <span className="font-bold text-xs uppercase tracking-wide">Try your luck</span>
          </button>
          <button
            type="button"
            className="btn-upgrade-pro nav-link w-full text-center py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 font-black text-xs tracking-widest text-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-[length:200%_100%] animate-pro-shine hover:opacity-95 transition-opacity"
          >
            UPGRADE TO PRO
          </button>
          
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full mt-3 py-2.5 px-3 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wide"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          )}
        </div>
      </nav>
    </aside>
  );
}