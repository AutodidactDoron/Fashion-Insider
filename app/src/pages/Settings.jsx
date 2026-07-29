import React from 'react';
// ⚡ THE FIX: ניתוב מדויק שיורד תיקייה אחת אחורה ונכנס לקומפוננטות
import IdVerificationUpload from '../components/IdVerificationUpload';

export default function Settings() {
  return (
    <section className="pb-20 max-w-5xl mx-auto">
      <div className="mb-8 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Command Center</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your identity, security, and platform preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="space-y-2 lg:col-span-1">
          <button className="w-full text-left px-4 py-3 bg-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-colors border border-white/10">
            Identity & KYC
          </button>
          <button className="w-full text-left px-4 py-3 text-gray-500 hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-widest rounded-lg transition-colors">
            Security & Auth
          </button>
          <button className="w-full text-left px-4 py-3 text-gray-500 hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-widest rounded-lg transition-colors">
            Payment Methods
          </button>
          <button className="w-full text-left px-4 py-3 text-gray-500 hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-widest rounded-lg transition-colors">
            Notifications
          </button>
        </div>

        {/* Active Content Area */}
        <div className="lg:col-span-3 space-y-8">
          
          <div className="bg-[#111113] border border-white/5 rounded-xl p-6 shadow-2xl">
            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6 border-b border-white/10 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-fi-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Trust & Verification
            </h3>
            <IdVerificationUpload />
          </div>

          <div className="bg-[#111113] border border-white/5 rounded-xl p-6 opacity-50 pointer-events-none">
            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-4 border-b border-white/10 pb-3">Profile Details</h3>
            <p className="text-gray-500 text-xs font-mono">Module locked. Authenticated via central provider.</p>
          </div>

        </div>

      </div>
    </section>
  );
}