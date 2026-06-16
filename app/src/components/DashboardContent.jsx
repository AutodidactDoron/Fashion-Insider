import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabaseClient';

// ⚡ The Market Multipliers Engine
const CONDITION_MULTIPLIERS = {
  DS: 1.0,      // 100% Value (Deadstock / Brand New)
  VNDS: 0.85,   // 85% Value (Very Near Deadstock)
  USED: 0.65,   // 65% Value (Worn / Used)
};

export default function DashboardContent() {
  const [selectedShoe, setSelectedShoe] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [catalogItems, setCatalogItems] = useState([]);
  const [itemConditions, setItemConditions] = useState({});

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Data Fetch Error:', error);
        return;
      }

      if (data) {
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

    // 1. משיכה ראשונית
    fetchCatalog();

    // 2. חיבור למנוע הגלובלי - רענון אוטומטי בעת שינוי קטלוג
    window.addEventListener('refresh_catalog', fetchCatalog);

    // 3. ניקוי זיכרון
    return () => window.removeEventListener('refresh_catalog', fetchCatalog);
  }, []);

  // ⚡ Chart Generator Engine
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

  const filteredShoes = useMemo(() => {
    return catalogItems.filter(shoe => 
      shoe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shoe.brand.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [catalogItems, searchQuery]);

  const handleConditionChange = (e, shoeId, condition) => {
    e.stopPropagation(); 
    setItemConditions(prev => ({ ...prev, [shoeId]: condition }));
  };

  return (
    <section id="dashboard-section" className="space-y-6 pt-2">
      
      <div className="bg-[#111113] rounded-xl p-4 sm:p-6 border border-white/10 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-fi-accent" />
        <h2 className="text-xl font-bold text-white mb-4">Market Index</h2>
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Search items, brands, or collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg pl-12 pr-4 py-3 sm:py-4 text-white placeholder-gray-500 text-sm sm:text-base focus:outline-none focus:border-fi-accent focus:ring-1 focus:ring-fi-accent transition-all"
          />
        </div>
      </div>

      <div id="dashboard-marketplace-panel">
        <div className="flex items-center justify-between mt-2 mb-4">
          <h3 className="text-lg font-bold text-white tracking-wide">Trending Assets</h3>
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{filteredShoes.length} Items Found</span>
        </div>
        
        {filteredShoes.length === 0 ? (
          <div className="bg-[#111113] border border-white/5 rounded-xl p-10 text-center">
            <p className="text-gray-400 text-sm">No items found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredShoes.map((shoe) => {
              const currentCond = itemConditions[shoe.id] || 'DS';
              const multiplier = CONDITION_MULTIPLIERS[currentCond];
              const displayMarketValue = Math.round(shoe.rawMarketValue * multiplier);
              const displayMin = Math.round(shoe.rawMin * multiplier);
              const displayMax = Math.round(shoe.rawMax * multiplier);

              return (
                <div 
                  key={shoe.id} 
                  onClick={() => setSelectedShoe({ ...shoe, condition: currentCond })}
                  className="bg-[#111113] rounded-xl overflow-hidden border border-white/5 hover:border-fi-accent/50 transition-all duration-300 shadow-lg group flex flex-col cursor-pointer relative"
                >
                  <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-black/90 text-fi-accent border border-fi-accent/30 text-[10px] px-2 py-1 rounded font-bold flex items-center gap-1 uppercase tracking-wider">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                      View Chart
                    </span>
                  </div>

                  <div className="relative h-48 bg-black flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-transparent to-transparent z-10 opacity-80" />
                    <img
                      src={shoe.img}
                      alt={shoe.name}
                      className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 ease-out"
                      onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x300/111113/333?text=Asset+Pending'; }}
                    />
                    
                    <div className="absolute top-3 left-3 flex items-center gap-1 z-20">
                      {Object.keys(CONDITION_MULTIPLIERS).map(cond => (
                        <button
                          key={cond}
                          onClick={(e) => handleConditionChange(e, shoe.id, cond)}
                          className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest backdrop-blur-sm transition-all duration-200
                            ${currentCond === cond 
                              ? 'bg-fi-accent text-black shadow-[0_0_10px_rgba(255,215,0,0.5)] scale-105' 
                              : 'bg-black/60 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}
                        >
                          {cond}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-between bg-[#111113] relative z-20 -mt-4 rounded-t-xl">
                    <div>
                      <h3 className="font-bold text-white truncate text-sm">{shoe.name}</h3>
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">{shoe.brand}</p>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-end justify-between">
                      <div>
                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Est. Value</div>
                        <div className="text-white text-base font-bold animate-in fade-in slide-in-from-bottom-1 duration-300" key={displayMarketValue}>
                          {displayMarketValue.toLocaleString()} CR
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Range</div>
                        <div className="text-gray-400 text-xs font-mono animate-in fade-in slide-in-from-bottom-1 duration-300" key={displayMin}>
                          {displayMin.toLocaleString()} - {displayMax.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedShoe && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-white/10 rounded-xl p-6 w-full max-w-2xl relative shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
            <button onClick={() => setSelectedShoe(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="flex items-center gap-3 mb-1 pr-8">
              <h2 className="text-xl font-bold text-white">{selectedShoe.name}</h2>
              <span className="px-2 py-0.5 rounded bg-fi-accent/10 border border-fi-accent/30 text-fi-accent text-[10px] font-black uppercase tracking-widest">
                {selectedShoe.condition}
              </span>
            </div>
            
            <p className="text-sm text-gray-400 mb-6">Historical Trade Data (Based on Condition)</p>
            
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
              <div className="text-sm text-gray-400">
                Current est. <span className="text-white font-bold">
                  {Math.round(selectedShoe.rawMarketValue * CONDITION_MULTIPLIERS[selectedShoe.condition]).toLocaleString()} CR
                </span>
              </div>
              <button onClick={() => setSelectedShoe(null)} className="px-6 py-2 rounded bg-white !text-black !font-bold text-sm hover:bg-gray-200 transition-colors">CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}