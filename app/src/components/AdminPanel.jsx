import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('triage');
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); 
  const [masterCatalog, setMasterCatalog] = useState([]);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'triage') fetchTriageQueues();
    if (activeTab === 'catalog') fetchMasterCatalog();
    if (activeTab === 'community') fetchCommunityPosts();

    // LIVE ENGINE: Realtime dashboard updates without refreshing
    const adminChannel = supabase.channel('admin_live_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_closet_items' }, () => {
        if (activeTab === 'triage') fetchTriageQueues();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_requests' }, () => {
        if (activeTab === 'triage') fetchTriageQueues();
      })
      .subscribe();

    return () => supabase.removeChannel(adminChannel);
  }, [activeTab]);

  const fetchTriageQueues = async () => {
    setLoading(true);
    const { data: itemsData } = await supabase.from('user_closet_items').select(`id, user_name, size, proof_image_url, added_at, catalog_items (name, brand)`).eq('is_verified', false).order('added_at', { ascending: true });
    const { data: requestsData } = await supabase.from('catalog_requests').select('*').eq('status', 'pending_review').order('submitted_at', { ascending: true });
    if (itemsData) setPendingItems(itemsData);
    if (requestsData) setPendingRequests(requestsData);
    setLoading(false);
  };

  const fetchMasterCatalog = async () => {
    setLoading(true);
    const { data } = await supabase.from('catalog_items').select('*').order('brand', { ascending: true });
    if (data) setMasterCatalog(data);
    setLoading(false);
  };

  const fetchCommunityPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('community_posts').select('*').order('created_at', { ascending: false });
    if (data) setCommunityPosts(data);
    setLoading(false);
  };

  // --- CLIENT-SIDE PIPELINES (Bypassing SQL RPC Cache Issues) ---
  const handleApproveStandard = async (itemId) => {
    try {
      const { error } = await supabase.from('user_closet_items').update({ is_verified: true }).eq('id', itemId);
      if (error) throw new Error(error.message);
      setPendingItems(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      alert("Approval Error: " + err.message);
    }
  };

  const handleApproveExpansion = async (requestId, imageToUse) => {
    try {
      const { data: reqData, error: reqError } = await supabase.from('catalog_requests').select('*').eq('id', requestId).single();
      if (reqError) throw new Error("Failed fetching request: " + reqError.message);

      const finalImage = imageToUse || 'https://via.placeholder.com/400x400/111113/facc15?text=NO+IMAGE';

      const { data: newCatalogItem, error: catError } = await supabase.from('catalog_items').insert([{
        brand: reqData.proposed_brand,
        name: reqData.proposed_name,
        market_value: 0,
        stock_image_url: finalImage
      }]).select().single();
      if (catError) throw new Error("Catalog creation failed: " + catError.message);

      const { error: closetError } = await supabase.from('user_closet_items').insert([{
        user_name: reqData.user_name,
        catalog_item_id: newCatalogItem.id,
        size: reqData.size,
        condition_status: 'DS',
        proof_image_url: finalImage,
        is_verified: true
      }]);
      if (closetError) throw new Error("Closet insertion failed: " + closetError.message);

      await supabase.from('catalog_requests').delete().eq('id', requestId);
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      alert("PIPELINE ERROR: " + error.message);
    }
  };

  const handleRejectStandard = async (itemId) => {
    await supabase.from('user_closet_items').delete().eq('id', itemId);
    setPendingItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleRejectExpansion = async (requestId) => {
    await supabase.from('catalog_requests').delete().eq('id', requestId);
    setPendingRequests(prev => prev.filter(req => req.id !== requestId));
  };

  const handleDeleteFromCatalog = async (catalogId, itemName) => {
    const confirmed = window.confirm(`WARNING: Deleting "${itemName}" will wipe it from all closets. Proceed?`);
    if (!confirmed) return;
    const { error } = await supabase.rpc('admin_delete_catalog_item', { target_catalog_id: catalogId });
    if (!error) setMasterCatalog(prev => prev.filter(item => item.id !== catalogId));
  };

  const renderTriageTab = () => (
    <div className="space-y-12">
      <section>
        <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Market Expansion Requests <span className="text-xs bg-white/10 px-2 py-1 rounded-md ml-2">{pendingRequests.length}</span>
        </h2>
        {pendingRequests.length === 0 ? (
          <div className="bg-[#111113] p-8 text-center rounded-xl border border-white/5 text-gray-600 font-bold uppercase tracking-widest text-xs">Queue Clean</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingRequests.map(req => {
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
                      <p className="text-gray-400 font-mono text-[10px] mt-1">Size: {req.size}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                      <button onClick={() => handleApproveExpansion(req.id, coverImage)} className="flex-1 bg-yellow-500 text-black font-black uppercase text-[10px] tracking-widest py-3 rounded-lg hover:bg-yellow-400 transition-all">Establish</button>
                      <button onClick={() => handleRejectExpansion(req.id)} className="flex-1 bg-red-900/20 text-red-500 font-black uppercase text-[10px] tracking-widest py-3 rounded-lg hover:bg-red-900/40 transition-all">Reject</button>
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
          <span className="w-2 h-2 rounded-full bg-fi-accent"></span> Standard Verifications <span className="text-xs bg-white/10 px-2 py-1 rounded-md ml-2">{pendingItems.length}</span>
        </h2>
        {pendingItems.length === 0 ? (
          <div className="bg-[#111113] p-8 text-center rounded-xl border border-white/5 text-gray-600 font-bold uppercase tracking-widest text-xs">Queue Clean</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingItems.map(item => (
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
                    <button onClick={() => handleApproveStandard(item.id)} className="flex-1 bg-fi-accent text-black font-black uppercase text-[10px] tracking-widest py-3 rounded-lg hover:bg-white transition-all">Approve</button>
                    <button onClick={() => handleRejectStandard(item.id)} className="flex-1 bg-red-900/20 text-red-500 font-black uppercase text-[10px] tracking-widest py-3 rounded-lg hover:bg-red-900/40 transition-all">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const renderCatalogTab = () => (
    <div className="bg-[#111113] border border-white/10 rounded-xl overflow-hidden">
      <div className="p-6 border-b border-white/5 flex justify-between items-center">
        <h2 className="text-lg font-bold text-white uppercase tracking-widest">Master Catalog Control</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/50 text-[10px] text-gray-500 uppercase tracking-widest"><th className="p-4">Brand</th><th className="p-4">Model Name</th><th className="p-4 text-right">Actions</th></tr>
          </thead>
          <tbody className="text-sm text-gray-300">
            {masterCatalog.map(item => (
              <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02]"><td className="p-4 font-bold uppercase text-[10px] text-white">{item.brand}</td><td className="p-4">{item.name}</td><td className="p-4 text-right"><button onClick={() => handleDeleteFromCatalog(item.id, item.name)} className="text-red-500 hover:text-red-400 font-black uppercase text-[10px]">Delete</button></td></tr>
            ))}
          </tbody>
        </table>
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
        </nav>
      </aside>
      <main className="flex-1 p-8 h-screen overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {loading ? <div className="animate-spin w-8 h-8 border-2 border-fi-accent border-t-transparent rounded-full mx-auto mt-20"></div> : (
            <>
              {activeTab === 'triage' && renderTriageTab()}
              {activeTab === 'catalog' && renderCatalogTab()}
            </>
          )}
        </div>
      </main>
    </div>
  );
}