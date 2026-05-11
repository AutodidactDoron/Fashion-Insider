import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import AddAssetModal from './AddAssetModal';

export default function MyCloset() {
  const [inventory, setInventory] = useState([]);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);

  useEffect(() => {
    fetchInventory();

    const channel = supabase
      .channel('closet_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_closet_items' }, () => {
        fetchInventory();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchInventory = async () => {
    // ⚡ CRITICAL: Identity Verification
    const activeUser = localStorage.getItem('currentUser');
    if (!activeUser) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_closet_items')
      .select(`id, purchase_price, is_verified, added_at, catalog_items (name, brand, stock_image_url, market_value)`)
      .eq('is_verified', true)
      .eq('user_name', activeUser) // The filter that was missing!
      .order('added_at', { ascending: false });

    if (error) {
      console.error("Vault Fetch Error:", error);
      setLoading(false);
      return;
    }

    if (data) {
      let calculatedWorth = 0;
      const activeAssets = data.map(item => {
        const masterData = item.catalog_items;
        if (masterData && masterData.market_value) {
          calculatedWorth += masterData.market_value;
        }
        return {
          id: item.id,
          name: masterData?.name || 'Unknown Asset',
          brand: masterData?.brand || 'N/A',
          img: masterData?.stock_image_url || 'https://placehold.co/400x300/111113/333?text=Asset+Lost',
          currentMarketValue: masterData?.market_value || 0,
          purchasePrice: item.purchase_price
        };
      });

      setInventory(activeAssets);
      setTotalNetWorth(calculatedWorth);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/10 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">My Closet</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your verified assets and track your net worth.</p>
          {inventory.length > 0 && (
            <button onClick={() => setIsAddAssetOpen(true)} className="mt-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center gap-2">
              Add Asset
            </button>
          )}
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Total Closet Value</p>
          <p className="text-3xl font-black text-fi-accent drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]">
            {totalNetWorth.toLocaleString()} CR'
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin w-8 h-8 border-2 border-fi-accent border-t-transparent rounded-full"></div></div>
      ) : inventory.length === 0 ? (
        <div className="bg-[#111113] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
          <h3 className="text-2xl font-black text-white mb-2 relative z-10 uppercase tracking-wide">Your Closet is Empty</h3>
          <button onClick={() => setIsAddAssetOpen(true)} className="px-8 py-3.5 rounded-xl bg-white text-black! font-black! text-sm uppercase tracking-widest hover:bg-gray-200 mt-4 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-105 relative z-10">
            ADD NEW ASSET
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {inventory.map(item => (
            <div key={item.id} className="bg-[#111113] border border-white/5 rounded-xl p-4 hover:border-fi-accent/30 transition-all group shadow-lg flex flex-col">
              <div className="aspect-square bg-white rounded-lg mb-4 p-4 flex items-center justify-center relative overflow-hidden">
                <img src={item.img} alt={item.name} className="absolute inset-0 w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute top-2 right-2 bg-black/90 backdrop-blur-md px-2 py-1 rounded text-[9px] font-black text-fi-accent border border-fi-accent/20 z-10">VERIFIED</div>
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{item.brand}</p>
                  <h3 className="text-white font-bold text-sm truncate mt-1" title={item.name}>{item.name}</h3>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-end">
                  <div>
                    <span className="block text-[9px] text-gray-500 uppercase tracking-widest font-bold">Est. Value</span>
                    <span className="text-white font-bold text-sm">{item.currentMarketValue.toLocaleString()} CR'</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <AddAssetModal isOpen={isAddAssetOpen} onClose={() => setIsAddAssetOpen(false)} />
    </div>
  );
}