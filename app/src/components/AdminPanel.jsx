import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('triage');
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); 
  const [masterCatalog, setMasterCatalog] = useState([]);
  const [verifiedClosetItems, setVerifiedClosetItems] = useState([]);
  const [recycleItems, setRecycleItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [triageSearch, setTriageSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [closetSearch, setClosetSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'triage') fetchTriageQueues();
    if (activeTab === 'catalog') fetchMasterCatalog();
    if (activeTab === 'closets') fetchVerifiedClosets(); 
    if (activeTab === 'recycle') fetchRecycleBin();

    console.log("[ADMIN RADAR] 📡 Deploying live cross-session listeners...");

    const adminSubscription = supabase
      .channel('admin_global_triage')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_requests' }, (payload) => {
          fetchTriageQueues();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_closet_items' }, (payload) => {
          fetchTriageQueues();
          if (activeTab === 'closets') fetchVerifiedClosets();
      })
      .subscribe();

    const handleLiveUpdate = () => {
      if (activeTab === 'triage') fetchTriageQueues();
      if (activeTab === 'catalog') fetchMasterCatalog();
      if (activeTab === 'closets') fetchVerifiedClosets();
      if (activeTab === 'recycle') fetchRecycleBin();
    };

    window.addEventListener('refresh_closet', handleLiveUpdate);
    window.addEventListener('refresh_catalog', handleLiveUpdate);
    window.addEventListener('refresh_admin_queues', handleLiveUpdate);

    return () => {
      supabase.removeChannel(adminSubscription);
      window.removeEventListener('refresh_closet', handleLiveUpdate);
      window.removeEventListener('refresh_catalog', handleLiveUpdate);
      window.removeEventListener('refresh_admin_queues', handleLiveUpdate);
    };
  }, [activeTab]);

  const fetchTriageQueues = async () => {
    setLoading(true);
    const { data: itemsData } = await supabase
      .from('user_closet_items')
      .select(`id, user_name, size, proof_image_url, added_at, catalog_items (name, brand)`)
      .eq('is_verified', false)
      .order('added_at', { ascending: true });

    const { data: requestsData } = await supabase
      .from('catalog_requests')
      .select('*')
      .eq('status', 'pending_review')
      .order('submitted_at', { ascending: true });

    setPendingItems(itemsData || []);
    setPendingRequests(requestsData || []);
    setLoading(false);
  };

  const fetchMasterCatalog = async () => {
    setLoading(true);
    const { data } = await supabase.from('catalog_items').select('*').order('brand', { ascending: true });
    if (data) setMasterCatalog(data);
    setLoading(false);
  };

  const fetchVerifiedClosets = async () => {
    setLoading(true);
    const { data: itemsData } = await supabase
      .from('user_closet_items')
      .select(`id, user_name, size, condition_status, is_verified, proof_image_url, catalog_items (name, brand)`)
      .eq('is_verified', true)
      .order('id', { ascending: false });

    setVerifiedClosetItems(itemsData || []);
    setLoading(false);
  };

  const fetchRecycleBin = async () => {
    setLoading(true);
    await supabase.rpc('clean_recycle_bin');
    const { data } = await supabase
      .from('admin_recycle_bin')
      .select('*')
      .order('deleted_at', { ascending: false });

    setRecycleItems(data || []);
    setLoading(false);
  };

  const handleApproveStandard = async (item) => {
    try {
      const { error } = await supabase.from('user_closet_items').update({ is_verified: true }).eq('id', item.id);
      if (error) throw new Error(error.message);

      await supabase.from('notifications').insert([{
        user_name: item.user_name,
        title: 'ASSET VERIFIED ✅',
        message: `Your ${item.catalog_items?.brand || 'asset'} ${item.catalog_items?.name || ''} was verified by authentication and is now live in your closet.`,
      }]);

      setPendingItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) { alert("Approval Error: " + err.message); }
  };

  const handleApproveExpansion = async (req, imageToUse) => {
    const ipoPriceInput = prompt(`Enter the Global Market Value (IPO Price) for:\n${req.proposed_brand} ${req.proposed_name}`, "200");
    if (ipoPriceInput === null) return;
    const baselinePrice = parseInt(ipoPriceInput, 10) || 0;

    const conditionInput = prompt(`Enter Condition (DS, VNDS, USED) for this asset:`, "DS");
    if (conditionInput === null) return;
    const finalCondition = conditionInput.toUpperCase();

    try {
      const finalImage = imageToUse || 'https://via.placeholder.com/400x400/111113/facc15?text=NO+IMAGE';

      const { error: rpcError } = await supabase.rpc('admin_approve_catalog_request', {
        target_request_id: req.id,
        cover_image_url: finalImage,
        baseline_price: baselinePrice,
        asset_condition: finalCondition
      });

      if (rpcError) throw new Error("Catalog expansion failed at DB level: " + rpcError.message);

      await supabase.from('notifications').insert([{
        user_name: req.user_name, 
        title: 'CATALOG EXPANDED 🌍',
        message: `Your request for ${req.proposed_brand} ${req.proposed_name} was approved! The asset is now in the global catalog. Your specific item is currently pending Check Check verification before entering your closet.`,
      }]);

      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
      fetchTriageQueues(); 
      
    } catch (error) { alert("PIPELINE ERROR: " + error.message); }
  };

  const handleRejectStandard = async (item) => {
    await supabase.from('user_closet_items').delete().eq('id', item.id);
    await supabase.from('notifications').insert([{
      user_name: item.user_name, 
      title: 'VERIFICATION FAILED ❌',
      message: `Your asset verification for ${item.catalog_items?.brand} ${item.catalog_items?.name} was rejected.`
    }]);
    setPendingItems(prev => prev.filter(i => i.id !== item.id));
  };

  const handleRejectExpansion = async (req) => {
    await supabase.from('catalog_requests').delete().eq('id', req.id);
    await supabase.from('notifications').insert([{
      user_name: req.user_name, 
      title: 'REQUEST REJECTED ❌',
      message: `Your catalog expansion request for ${req.proposed_brand} ${req.proposed_name} was rejected.`
    }]);
    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const handleDeleteFromCatalog = async (catalogId, itemName) => {
    const confirmed = window.confirm(`WARNING: Deleting "${itemName}" will wipe it from all closets. Proceed?`);
    if (!confirmed) return;
    const { error } = await supabase.rpc('admin_delete_catalog_item', { target_catalog_id: catalogId });
    if (!error) setMasterCatalog(prev => prev.filter(item => item.id !== catalogId));
  };

  const handleWipeUserAsset = async (item) => {
    const isConfirmed = window.confirm(`☢️ CRITICAL WARNING: Proceed with WIPE?`);
    if (!isConfirmed) return;

    try {
      const { error } = await supabase.from('user_closet_items').delete().eq('id', item.id);
      if (error) throw new Error(error.message);

      await supabase.from('notifications').insert([{
        user_name: item.user_name,
        title: 'ASSET CONFISCATED ⛔',
        message: `ADMIN ACTION: Your ${item.catalog_items?.name} has been removed.`,
      }]);

      setVerifiedClosetItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) { alert("WIPE FAILED: " + err.message); }
  };

  const handleRestoreFromBin = async (binItem) => {
    try {
      // ⚡ THE FIX: קילוף שדות ההעשרה הווירטואליים לפני שמחזירים לברזל האמיתי
      const cleanPayload = { ...binItem.payload };
      delete cleanPayload.catalog_brand;
      delete cleanPayload.catalog_name;
      delete cleanPayload.catalog_image;

      const { error: insertError } = await supabase.from(binItem.original_table).insert([cleanPayload]);
      if (insertError) throw new Error(insertError.message);

      await supabase.from('admin_recycle_bin').delete().eq('id', binItem.id);
      setRecycleItems(prev => prev.filter(i => i.id !== binItem.id));
      alert(`Asset restored successfully.`);
    } catch (error) { alert("RESTORE ERROR: " + error.message); }
  };

  const handlePermanentDelete = async (binItemId) => {
    const confirmed = window.confirm("This will permanently destroy the record. Proceed?");
    if (!confirmed) return;
    await supabase.from('admin_recycle_bin').delete().eq('id', binItemId);
    setRecycleItems(prev => prev.filter(i => i.id !== binItemId));
  };

  const filteredRequests = pendingRequests.filter(req => 
    req.user_name?.toLowerCase().includes(triageSearch.toLowerCase()) ||
    req.proposed_brand?.toLowerCase().includes(triageSearch.toLowerCase()) ||
    req.proposed_name?.toLowerCase().includes(triageSearch.toLowerCase())
  );

  const filteredStandard = pendingItems.filter(item => 
    item.user_name?.toLowerCase().includes(triageSearch.toLowerCase()) ||
    item.catalog_items?.brand?.toLowerCase().includes(triageSearch.toLowerCase()) ||
    item.catalog_items?.name?.toLowerCase().includes(triageSearch.toLowerCase())
  );

  const renderTriageTab = () => (
    <div className="space-y-12">
      <div className="flex items-center gap-4 bg-[#111113] p-4 rounded-xl border border-white/5">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input 
          type="text" 
          placeholder="Search by User, Brand, or Model..." 
          value={triageSearch}
          onChange={(e) => setTriageSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-white w-full text-sm placeholder-gray-600"
        />
      </div>

      <section>
        <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Market Expansion Requests <span className="text-xs bg-white/10 px-2 py-1 rounded-md ml-2">{filteredRequests.length}</span>
        </h2>
        {filteredRequests.length === 0 ? (
          <div className="bg-[#111113] p-8 text-center rounded-xl border border-white/5 text-gray-600 font-bold uppercase tracking-widest text-xs">No matching requests</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRequests.map(req => {
              const coverImage = Array.isArray(req.proof_image_urls) && req.proof_image_urls.length > 0 ? req.proof_image_urls[0] : null;
              return (
                <div key={req.id} className="bg-[#111113] border border-yellow-500/20 rounded-xl overflow-hidden shadow-2xl flex flex-col">
                  <div className="h-48 bg-white relative">
                    {coverImage ? <img src={coverImage} alt="Proof" className="w-full h-full object-contain p-2" /> : <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500 text-xs font-mono uppercase tracking-widest">No Image</div>}
                    <div className="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded text-[10px] font-black text-yellow-500 uppercase">New Asset</div>
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-black text-white uppercase">{req.user_name}</div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest">{req.proposed_brand}</p>
                      <h3 className="text-white font-bold text-sm truncate">{req.proposed_name}</h3>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                      <button onClick={() => handleApproveExpansion(req, coverImage)} className="flex-1 bg-yellow-500 text-black font-black uppercase text-[10px] tracking-widest py-3 rounded-lg hover:bg-yellow-400 transition-all">Establish</button>
                      <button onClick={() => handleRejectExpansion(req)} className="flex-1 bg-red-900/20 text-red-500 font-black uppercase text-[10px] tracking-widest py-3 rounded-lg hover:bg-red-900/40 transition-all">Reject</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-fi-accent"></span> Standard Verifications <span className="text-xs bg-white/10 px-2 py-1 rounded-md ml-2">{filteredStandard.length}</span>
        </h2>
        {filteredStandard.length === 0 ? (
          <div className="bg-[#111113] p-8 text-center rounded-xl border border-white/5 text-gray-600 font-bold uppercase tracking-widest text-xs">No matching items</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStandard.map(item => (
              <div key={item.id} className="bg-[#111113] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col">
                <div className="h-48 bg-white relative">
                  <img src={item.proof_image_url} alt="Proof" className="w-full h-full object-contain p-2" />
                  <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-black text-white uppercase">{item.user_name}</div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{item.catalog_items?.brand}</p>
                    <h3 className="text-white font-bold text-sm truncate">{item.catalog_items?.name}</h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                    <button onClick={() => handleApproveStandard(item)} className="flex-1 bg-fi-accent text-black font-black uppercase text-[10px] tracking-widest py-3 rounded-lg hover:bg-white transition-all">Approve</button>
                    <button onClick={() => handleRejectStandard(item)} className="flex-1 bg-red-900/20 text-red-500 font-black uppercase text-[10px] tracking-widest py-3 rounded-lg hover:bg-red-900/40 transition-all">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const filteredCatalog = masterCatalog.filter(item => 
    item.brand.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    item.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const renderCatalogTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-[#111113] p-4 rounded-xl border border-white/5">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input 
          type="text" 
          placeholder="Search Catalog by Brand or Model..." 
          value={catalogSearch}
          onChange={(e) => setCatalogSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-white w-full text-sm placeholder-gray-600"
        />
      </div>

      <div className="bg-[#111113] border border-white/10 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white uppercase tracking-widest">Master Catalog Control <span className="text-xs bg-white/10 px-2 py-1 rounded-md ml-2">{filteredCatalog.length}</span></h2>
        </div>
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#0a0a0c] z-10">
              <tr className="text-[10px] text-gray-500 uppercase tracking-widest">
                <th className="p-4 border-b border-white/5">Brand</th>
                <th className="p-4 border-b border-white/5">Model Name</th>
                <th className="p-4 text-right border-b border-white/5">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-300">
              {filteredCatalog.map(item => (
                <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 font-bold uppercase text-[10px] text-white">{item.brand}</td>
                  <td className="p-4">{item.name}</td>
                  <td className="p-4 text-right"><button onClick={() => handleDeleteFromCatalog(item.id, item.name)} className="text-red-500 hover:text-red-400 font-black uppercase text-[10px]">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const filteredClosets = verifiedClosetItems.filter(item => 
    item.user_name?.toLowerCase().includes(closetSearch.toLowerCase()) ||
    item.catalog_items?.brand?.toLowerCase().includes(closetSearch.toLowerCase()) ||
    item.catalog_items?.name?.toLowerCase().includes(closetSearch.toLowerCase())
  );

  const groupedClosets = filteredClosets.reduce((acc, item) => {
    const user = item.user_name || 'UNKNOWN';
    if (!acc[user]) acc[user] = [];
    acc[user].push(item);
    return acc;
  }, {});

  const renderClosetsTab = () => (
    <div className="space-y-8">
      <div className="flex items-center gap-4 bg-[#111113] p-4 rounded-xl border border-white/5">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input 
          type="text" 
          placeholder="Search by Username, Brand, or Model..." 
          value={closetSearch}
          onChange={(e) => setClosetSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-white w-full text-sm placeholder-gray-600"
        />
      </div>

      {Object.keys(groupedClosets).length === 0 ? (
        <div className="bg-[#111113] p-8 text-center rounded-xl border border-white/5 text-gray-600 font-bold uppercase tracking-widest text-xs">No assets found</div>
      ) : (
        Object.entries(groupedClosets).map(([username, items]) => (
          <div key={username} className="bg-[#0a0a0c] border border-white/5 rounded-xl p-6">
            <h2 className="text-sm font-black text-fi-accent uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-white/10 pb-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              {username}'S VAULT <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded ml-auto">{items.length} ASSETS</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(item => (
                <div key={item.id} className="bg-[#111113] border border-white/5 hover:border-red-500/30 transition-colors rounded-xl overflow-hidden shadow-lg flex flex-col group relative">
                  <div className="h-32 bg-white relative">
                    <img src={item.proof_image_url} alt="Proof" className="w-full h-full object-contain p-2 opacity-90 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 right-2 bg-fi-success/90 px-2 py-1 rounded text-[9px] font-black text-white uppercase tracking-wider backdrop-blur-sm shadow-sm">Verified</div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{item.catalog_items?.brand}</p>
                      <h3 className="text-white font-bold text-xs truncate mt-1">{item.catalog_items?.name}</h3>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <button 
                        onClick={() => handleWipeUserAsset(item)} 
                        className="w-full bg-red-950/30 text-red-500 border border-red-500/20 font-black uppercase text-[9px] tracking-widest py-2 rounded hover:bg-red-900 hover:text-white hover:border-red-500 transition-all"
                      >
                        WIPE ASSET
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ⚡ The Visual Recycle Bin
  const renderRecycleBinTab = () => (
    <div className="space-y-6">
      <div className="bg-[#111113] border border-orange-500/30 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(249,115,22,0.05)]">
        <div className="p-6 border-b border-orange-500/20 flex justify-between items-center bg-orange-950/20">
          <h2 className="text-lg font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            System Recycle Bin
          </h2>
          <span className="text-[10px] text-orange-400/80 font-mono tracking-widest uppercase bg-orange-500/10 px-3 py-1 rounded border border-orange-500/20">Auto-purge after 30 days</span>
        </div>
        
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          {recycleItems.length === 0 ? (
            <div className="p-12 text-center text-gray-600 font-bold uppercase tracking-widest text-xs">Bin is empty</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0a0a0c] z-10 shadow-md">
                <tr className="text-[10px] text-gray-500 uppercase tracking-widest">
                  <th className="p-4 border-b border-white/5">Source</th>
                  <th className="p-4 border-b border-white/5">Entity Visual</th>
                  <th className="p-4 border-b border-white/5">Details</th>
                  <th className="p-4 border-b border-white/5">Time Left</th>
                  <th className="p-4 text-right border-b border-white/5">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-300">
                {recycleItems.map(item => {
                  const daysLeft = Math.ceil((new Date(item.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                  const isCloset = item.original_table === 'user_closet_items';
                  
                  // ⚡ Fallback Logic for Enriched Payloads
                  const imgUrl = item.payload.stock_image_url || item.payload.catalog_image || item.payload.proof_image_url || 'https://placehold.co/100x100/111113/333?text=NO+IMG';
                  const assetBrand = item.payload.brand || item.payload.catalog_brand || 'UNKNOWN BRAND';
                  const assetName = item.payload.name || item.payload.catalog_name || item.payload.proposed_name || item.payload.id;
                  const condition = item.payload.condition_status || item.payload.condition_tag;
                  const owner = isCloset ? item.payload.user_name : 'MASTER CATALOG';

                  return (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] group transition-colors">
                      <td className="p-4 font-bold uppercase text-[10px] text-gray-400">
                        {isCloset ? 'User Closet' : 'Catalog'}
                      </td>
                      <td className="p-4">
                        <div className="w-16 h-12 bg-white rounded flex items-center justify-center p-1 border border-white/10 opacity-70 group-hover:opacity-100 transition-opacity">
                          <img src={imgUrl} alt={assetName} className="w-full h-full object-contain" />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] text-fi-accent font-bold uppercase tracking-widest">{assetBrand}</span>
                          {condition && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20">
                              {condition}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-white text-xs truncate max-w-[200px]" title={assetName}>{assetName}</div>
                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">Owner: <span className="text-gray-300">{owner}</span></div>
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${daysLeft < 3 ? 'bg-red-500/20 text-red-500 animate-pulse border border-red-500/30' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                          {daysLeft} Days
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleRestoreFromBin(item)} className="text-fi-accent hover:text-white font-black uppercase text-[10px] transition-colors bg-fi-accent/10 hover:bg-fi-accent/20 px-3 py-1.5 rounded">Restore</button>
                          <button onClick={() => handlePermanentDelete(item.id)} className="text-red-500 hover:text-white font-black uppercase text-[10px] transition-colors bg-red-500/10 hover:bg-red-500/30 px-3 py-1.5 rounded">Destroy</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-black">
      <aside className="w-64 bg-[#0a0a0c] border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-black text-fi-accent uppercase tracking-widest">Admin</h1>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <button onClick={() => setActiveTab('triage')} className={`text-left px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'triage' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Triage Queues</button>
          <button onClick={() => setActiveTab('catalog')} className={`text-left px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'catalog' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Master Catalog</button>
          <button onClick={() => setActiveTab('closets')} className={`text-left px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'closets' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>User Closets</button>
          <div className="h-px bg-white/10 my-2"></div>
          <button onClick={() => setActiveTab('recycle')} className={`text-left px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex justify-between items-center ${activeTab === 'recycle' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 'text-orange-900/60 hover:text-orange-500/80'}`}>
            Recycle Bin
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </nav>
      </aside>
      <main className="flex-1 p-8 h-screen overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto">
          {loading ? <div className="animate-spin w-8 h-8 border-2 border-fi-accent border-t-transparent rounded-full mx-auto mt-20"></div> : (
            <>
              {activeTab === 'triage' && renderTriageTab()}
              {activeTab === 'catalog' && renderCatalogTab()}
              {activeTab === 'closets' && renderClosetsTab()}
              {activeTab === 'recycle' && renderRecycleBinTab()}
            </>
          )}
        </div>
      </main>
    </div>
  );
}