import React, { useState } from 'react';

export default function CreateTradeModal({ isOpen, onClose }) {
  const [haveType, setHaveType] = useState('item'); // 'item' or 'cr'
  const [wantType, setWantType] = useState('cr'); // 'item' or 'cr'
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-lg relative shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <h2 className="text-xl font-black text-white tracking-wide uppercase">List Item</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Trading Engine Form */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* [H] Section - What you have */}
          <div className="p-4 rounded-xl border border-white/5 bg-black/50 relative">
            <div className="absolute -top-3 left-4 bg-[#111113] px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              [H] You Have
            </div>
            <div className="flex gap-2 mb-3 mt-1">
              <button 
                onClick={() => setHaveType('item')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${haveType === 'item' ? 'bg-white/10 text-white border border-white/20' : 'text-gray-500 border border-transparent hover:bg-white/5'}`}
              >
                Item
              </button>
              <button 
                onClick={() => setHaveType('cr')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${haveType === 'cr' ? 'bg-fi-accent/20 text-fi-accent border border-fi-accent/30' : 'text-gray-500 border border-transparent hover:bg-white/5'}`}
              >
                Credits (CR)
              </button>
            </div>
            <input 
              type={haveType === 'cr' ? 'number' : 'text'}
              placeholder={haveType === 'cr' ? 'Amount (e.g. 5000)' : 'Item name (e.g. Jordan 1 Retro)'}
              className="w-full bg-black/80 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-fi-accent transition-colors placeholder:text-gray-600"
            />
          </div>

          {/* Exchange Icon */}
          <div className="flex justify-center -my-3 relative z-10">
            <div className="bg-[#111113] p-2 rounded-full border border-white/5">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
            </div>
          </div>

          {/* [W] Section - What you want */}
          <div className="p-4 rounded-xl border border-white/5 bg-black/50 relative">
            <div className="absolute -top-3 left-4 bg-[#111113] px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              [W] You Want
            </div>
            <div className="flex gap-2 mb-3 mt-1">
              <button 
                onClick={() => setWantType('cr')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${wantType === 'cr' ? 'bg-fi-accent/20 text-fi-accent border border-fi-accent/30' : 'text-gray-500 border border-transparent hover:bg-white/5'}`}
              >
                Credits (CR)
              </button>
              <button 
                onClick={() => setWantType('item')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${wantType === 'item' ? 'bg-white/10 text-white border border-white/20' : 'text-gray-500 border border-transparent hover:bg-white/5'}`}
              >
                Item
              </button>
            </div>
            <input 
              type={wantType === 'cr' ? 'number' : 'text'}
              placeholder={wantType === 'cr' ? 'Amount (e.g. 5500)' : 'Item name (e.g. Yeezy Slide)'}
              className="w-full bg-black/80 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-fi-accent transition-colors placeholder:text-gray-600"
            />
          </div>

        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-white/5 bg-black/50">
          <button className="w-full py-3.5 rounded-xl bg-white text-black font-black text-sm uppercase tracking-wider hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            Upload
          </button>
        </div>

      </div>
    </div>
  );
}