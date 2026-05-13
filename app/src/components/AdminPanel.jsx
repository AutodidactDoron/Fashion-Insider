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
    
    // 1. Fetching raw items without the native SQL join to avoid Foreign Key crashes
    const { data: itemsData, error: itemsError } = await supabase
      .from('user_closet_items')
      .select(`id, user_name, size, proof_image_url, added_at, catalog_items (name, brand)`)
      .eq('is_verified', false)
      .order('added_at', { ascending: true });

    if (itemsError) console.error("Items Fetch Error:", itemsError);

    const { data: requestsData, error: reqError } = await supabase
      .from('catalog_requests')
      .select('*')
      .eq('status', 'pending_review')
      .order('submitted_at', { ascending: true });

    if (reqError) console.error("Requests Fetch Error:", reqError);

    // 2. Client-Side Join: Extract all unique UUIDs and fetch their display names
    const uniqueUUIDs = new Set();
    if (itemsData) itemsData.forEach(i => uniqueUUIDs.add(i.user_name));
    if (requestsData) requestsData.forEach(r => uniqueUUIDs.add(r.user_name));

    const uuidArray = Array.from(uniqueUUIDs);
    const profilesMap = {};

    if (uuidArray.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, user_name')
        .in('id', uuidArray);
        
      if (profilesData) {
        profilesData.forEach(profile => {
          profilesMap[profile.id] = profile.user_name;
        });
      }
    }

    // 3. Injecting the readable names back into the payload
    const enrichedItems = itemsData ? itemsData.map(item => ({
      ...item,
      display_name: profilesMap[item.user_name] || item.user_name.substring(0, 8)
    })) : [];

    const enrichedRequests = requestsData ? requestsData.map(req => ({
      ...req,
      display_name: profilesMap[req.user_name] || req.user_name.substring(0, 8)
    })) : [];

    setPendingItems(enrichedItems);
    setPendingRequests(enrichedRequests);
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

  // ⚡ THE FIX: Standard Approval with Notification Payload
  const handleApproveStandard = async (item) => {
    try {
      const { error } = await supabase.from('user_closet_items').update({ is_verified: true }).eq('id', item.id);
      if (error) throw new Error(error.message);

      // ⚡ Dispatching the notification to the exact UUID
      await supabase.from('notifications').insert([{
        user_name: item.user_name, // This is the user's UUID
        title: 'ASSET VERIFIED ✅',
        message: `Your ${item.catalog_items?.brand || 'asset'} ${item.catalog_items?.name || ''} was verified by authentication and is now live in your closet.`,
      }]);

      setPendingItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      alert("Approval Error: " + err.message);
    }
  };

  // ⚡ THE FIX: Expansion Approval with Notification Payload
  const handleApproveExpansion = async (req, imageToUse) => {
    try {
      const { data: reqData, error: reqError } = await supabase.from('catalog_requests').select('*').eq('id', req.id).single();
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
        user_name: reqData.user_name, // This is the user's UUID
        catalog_item_id: newCatalogItem.id,
        size: reqData.size,
        condition_status: 'DS',
        proof_image_url: finalImage,
        is_verified: true
      }]);
      if (closetError) throw new Error("Closet insertion failed: " + closetError.message);

      // ⚡ Dispatching the notification to the exact UUID
      await supabase.from('notifications').insert([{
        user_name: reqData.user_name, 
        title: 'MARKET EXPANDED 🌍',
        message: `Your catalog request for the ${reqData.proposed_brand} ${reqData.proposed_name} was approved! The asset is now verified in your closet.`,
      }]);

      await supabase.from('catalog_requests').delete().eq('id', req.id);
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (error) {
      alert("PIPELINE ERROR: " + error.message);
    }
  };

  const handleRejectStandard = async (item) => {
    await supabase.from('user_closet_items').delete().eq('id', item.id);
    
    // Optional: Sending a rejection notification
    await supabase.from('notifications').insert([{
      user_name: item.user_name, 
      title: 'VERIFICATION FAILED ❌',
      message: `Your asset verification for ${item.catalog_items?.brand} ${item.catalog_items?.name} was rejected. Please ensure images are clear and meet the protocol.`
    }]);

    setPendingItems(prev => prev.filter(i => i.id !== item.id));
  };

  const handleRejectExpansion = async (req) => {
    await supabase.from('catalog_requests').delete().eq('id', req.id);

    // Optional: Sending a rejection notification
    await supabase.from('notifications').insert([{
      user_name: req.user_name, 
      title: 'REQUEST REJECTED ❌',
      message: `Your catalog expansion request for ${req.proposed_brand} ${req.proposed_name} was rejected by the authentication team.`
    }]);

    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
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
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-black text-white uppercase">{req.display_name}</div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest">{req.proposed_brand}</p>
                      <h3 className="text-white font-bold text-sm truncate">{req.proposed_name}</h3>
                      <p className="text-gray-400 font-mono text-[10px] mt-1">Size: {req.size}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                      {/* ⚡ Passed the full 'req' object instead of just req.id */}
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
                  <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] font-black text-white uppercase">{item.display_name}</div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{item.catalog_items?.brand}</p>
                    <h3 className="text-white font-bold text-sm truncate">{item.catalog_items?.name}</h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                    {/* ⚡ Passed the full 'item' object instead of just item.id */}
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