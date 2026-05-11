import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function VaultSelectorModal({ isOpen, onClose, onAssetsSelected, excludedIds = [] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [vaultItems, setVaultItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]); // הזיכרון המקומי של המודל

  // שאיבת הנתונים (כרגע מ-master_catalog, בעתיד ישאב רק מהארון הספציפי של המשתמש)
  useEffect(() => {
    async function fetchVault() {
      if (!isOpen) return;
      const { data } = await supabase.from('master_catalog').select('*');
      setVaultItems(data || []);
      setSelectedItems([]); // איפוס בחירות בכל פעם שפותחים את החלון
      setSearchQuery('');
    }
    fetchVault();
  }, [isOpen]);

  if (!isOpen) return null;

  // מנוע חיפוש פנימי
  const filteredItems = vaultItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // לוגיקת הבחירה (Multi-select Toggle)
  const toggleSelection = (item) => {
    // מניעת בחירה של פריט שכבר נמצא בפוסט (הגנה אקטיבית)
    if (excludedIds.includes(item.id)) return;

    setSelectedItems(prev => {
      const isAlreadySelected = prev.some(i => i.id === item.id);
      if (isAlreadySelected) {
        return prev.filter(i => i.id !== item.id); // הסרה אם כבר נבחר
      } else {
        return [...prev, item]; // הוספה אם טרם נבחר
      }
    });
  };

  // שיגור הנתונים לאב (CommunityContent)
  const handleConfirm = () => {
    onAssetsSelected(selectedItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#111113] border border-white/10 rounded-3xl w-full max-w-xl max-h-[85vh] shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01] shrink-0">
          <div>
            <h2 className="text-xl !font-black text-white uppercase tracking-tighter">Select Assets</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">From Your Closet</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Search & List */}
        <div className="p-8 flex-1 flex flex-col min-h-0">
          <div className="relative mb-6 shrink-0">
            <input 
              type="text" 
              placeholder="Search your authenticated items..." 
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white font-medium focus:outline-none focus:border-fi-accent/50 transition-all placeholder:text-gray-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {filteredItems.map(item => {
              const isExcluded = excludedIds.includes(item.id);
              const isSelected = selectedItems.some(i => i.id === item.id);

              return (
                <button 
                  key={item.id}
                  onClick={() => toggleSelection(item)}
                  disabled={isExcluded}
                  className={`w-full flex items-center gap-5 p-4 rounded-2xl border transition-all duration-200 text-left
                    ${isExcluded ? 'opacity-30 cursor-not-allowed border-white/5 bg-transparent' : 
                      isSelected ? 'border-fi-accent bg-fi-accent/5 shadow-[0_0_20px_rgba(255,215,0,0.05)]' : 
                      'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'}`}
                >
                  <div className="w-20 h-14 bg-white rounded-lg flex items-center justify-center p-2 shrink-0 relative">
                    <img src={item.stock_image_url} alt={item.name} className="max-w-full max-h-full object-contain" />
                    {/* Checkmark overlay for selected items */}
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-fi-accent rounded-full border-2 border-[#111113] flex items-center justify-center">
                        <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-fi-accent uppercase tracking-widest">{item.brand}</p>
                    <p className="text-sm font-bold text-white truncate">{item.name}</p>
                  </div>
                  {isExcluded && <span className="text-[10px] text-gray-500 font-bold uppercase">Attached</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-8 pt-4 border-t border-white/5 shrink-0">
          <button 
            disabled={selectedItems.length === 0}
            onClick={handleConfirm}
            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl disabled:opacity-20 hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {selectedItems.length > 0 ? `ATTACH ${selectedItems.length} ASSET${selectedItems.length > 1 ? 'S' : ''}` : 'SELECT ASSETS'}
          </button>
        </div>

      </div>
    </div>
  );
}