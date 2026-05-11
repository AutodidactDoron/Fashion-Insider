import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

export default function AddAssetModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [ingestionMode, setIngestionMode] = useState('index'); 
  
  const [liveCatalog, setLiveCatalog] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  
  const [unlistedBrand, setUnlistedBrand] = useState('');
  const [unlistedName, setUnlistedName] = useState('');
  
  const [selectedSize, setSelectedSize] = useState('');
  const [proofFiles, setProofFiles] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchMasterCatalog();
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setStep(1);
    setIngestionMode('index');
    setSelectedItem(null);
    setSearchQuery('');
    setUnlistedBrand('');
    setUnlistedName('');
    setSelectedSize('');
    setProofFiles([]);
  };

  const fetchMasterCatalog = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('catalog_items')
      .select('*')
      .order('brand', { ascending: true });

    if (data) setLiveCatalog(data);
    if (error) console.error("Catalog Fetch Error:", error);
    setLoading(false);
  };

  const filteredCatalog = useMemo(() => {
    return liveCatalog.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [liveCatalog, searchQuery]);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).slice(0, 4);
      setProofFiles(filesArray);
    }
  };

  const handleSubmitForVerification = async () => {
    // ⚡ Strict Dynamic Identity Verification
    const activeUser = localStorage.getItem('currentUser');
    if (!activeUser) {
      alert("Auth Error: No active session found. Please log in.");
      return;
    }

    const isReady = ingestionMode === 'index' 
      ? (selectedItem && selectedSize && proofFiles.length > 0)
      : (unlistedBrand && unlistedName && selectedSize && proofFiles.length > 0);
      
    if (!isReady) return;
    setIsSubmitting(true);

    let uploadedImageUrls = [];

    try {
      const uploadPromises = proofFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${activeUser}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `pending/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('verification_proofs')
          .upload(filePath, file);

        if (!uploadError) {
          const { data } = supabase.storage.from('verification_proofs').getPublicUrl(filePath);
          return data.publicUrl;
        }
        return null;
      });

      uploadedImageUrls = (await Promise.all(uploadPromises)).filter(url => url !== null);

      if (uploadedImageUrls.length === 0) {
          throw new Error("Image upload failed.");
      }

      if (ingestionMode === 'index') {
        const { error } = await supabase.from('user_closet_items').insert([{
          user_name: activeUser, // Injects Doron or Builder based on Console
          catalog_item_id: selectedItem.id,
          size: selectedSize,
          condition_status: 'DS',
          proof_image_url: uploadedImageUrls[0], 
          is_verified: false,
          purchase_price: 0
        }]).select(); // <-- THE FIX: Forcing representation return to bypass 406
        if (error) throw error;
      } else {
        const { error } = await supabase.from('catalog_requests').insert([{
          user_name: activeUser, // Injects Doron or Builder based on Console
          proposed_brand: unlistedBrand,
          proposed_name: unlistedName,
          size: selectedSize,
          proof_image_urls: uploadedImageUrls,
          status: 'pending_review'
        }]).select(); // <-- THE FIX: Forcing representation return to bypass 406
        if (error) throw error;
      }

      onClose();
    } catch (error) {
      console.error("Submission Error:", error);
      alert("Submission Failed: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 relative bg-black/40">
          <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h2 className="text-xl font-black text-white uppercase tracking-widest">Asset Verification</h2>
          
          {step === 1 && (
            <div className="flex gap-4 mt-6 border-b border-white/10">
              <button 
                onClick={() => setIngestionMode('index')}
                className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all ${ingestionMode === 'index' ? 'text-fi-accent border-b-2 border-fi-accent' : 'text-gray-500 hover:text-white'}`}
              >
                Global Index
              </button>
              <button 
                onClick={() => setIngestionMode('unlisted')}
                className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all ${ingestionMode === 'unlisted' ? 'text-fi-accent border-b-2 border-fi-accent' : 'text-gray-500 hover:text-white'}`}
              >
                Submit Unlisted
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="animate-in fade-in duration-300 flex-1 flex flex-col">
              
              {ingestionMode === 'index' && (
                <>
                  <div className="relative mb-6">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Search Master Catalog..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-4 py-4 text-white text-sm focus:border-fi-accent focus:ring-1 focus:ring-fi-accent outline-none" />
                  </div>
                  {loading ? (
                    <div className="flex justify-center p-12"><div className="animate-spin w-8 h-8 border-2 border-fi-accent border-t-transparent rounded-full"></div></div>
                  ) : (
                    <div className="space-y-3 flex-1">
                      {filteredCatalog.map(item => (
                        <div key={item.id} onClick={() => setSelectedItem(item)} className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${selectedItem?.id === item.id ? 'bg-fi-accent/5 border-fi-accent' : 'bg-black/50 border-white/5 hover:border-white/20'}`}>
                          <div className="w-16 h-16 bg-white rounded-lg p-1 flex-shrink-0 flex items-center justify-center"><img src={item.stock_image_url} alt={item.name} className="max-w-full max-h-full object-contain" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-fi-accent uppercase tracking-widest">{item.brand}</p>
                            <h3 className="text-white font-bold text-sm truncate">{item.name}</h3>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {ingestionMode === 'unlisted' && (
                <div className="space-y-6 flex-1 bg-black/30 p-6 rounded-xl border border-white/5">
                  <div>
                    <h3 className="text-white font-bold mb-1">Request Catalog Expansion</h3>
                    <p className="text-xs text-gray-400">If your authentic asset is missing from the Global Index, submit it here. Once verified, it will establish a new market.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Brand</label>
                    <input type="text" value={unlistedBrand} onChange={(e) => setUnlistedBrand(e.target.value)} placeholder="e.g., Nike, Asics..." className="w-full bg-black border border-white/10 rounded-lg px-4 py-4 text-white text-sm focus:border-fi-accent outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Exact Model Name</label>
                    <input type="text" value={unlistedName} onChange={(e) => setUnlistedName(e.target.value)} placeholder="e.g., Gel-Kayano 14 JJJJound..." className="w-full bg-black border border-white/10 rounded-lg px-4 py-4 text-white text-sm focus:border-fi-accent outline-none" />
                  </div>
                </div>
              )}

              <button 
                onClick={() => setStep(2)}
                disabled={ingestionMode === 'index' ? !selectedItem : (!unlistedBrand || !unlistedName)}
                className="mt-6 w-full py-4 rounded-xl bg-white !text-black !font-black uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proceed to Authentication
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-white mb-6 flex items-center gap-1 font-bold uppercase tracking-wider">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back
              </button>
              
              <div className="bg-black border border-white/5 rounded-2xl p-6">
                
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Asset Size (US)</label>
                  <input type="text" value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} placeholder="e.g. 9.5, 10..." className="w-full bg-[#111113] border border-white/10 rounded-xl px-4 py-4 text-white font-mono focus:border-fi-accent outline-none" />
                </div>

                <div className="mb-8">
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Authentication Evidence</label>
                    <span className="text-[9px] text-fi-accent font-bold uppercase tracking-widest">Required</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <div className="bg-[#111113] border border-white/5 p-2 rounded-lg text-center">
                      <div className="h-10 mb-1 flex items-center justify-center opacity-50"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg></div>
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Box Label</p>
                    </div>
                    <div className="bg-[#111113] border border-white/5 p-2 rounded-lg text-center">
                      <div className="h-10 mb-1 flex items-center justify-center opacity-50"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></div>
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Inside Size Tag</p>
                    </div>
                    <div className="bg-[#111113] border border-white/5 p-2 rounded-lg text-center">
                      <div className="h-10 mb-1 flex items-center justify-center opacity-50"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg></div>
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Insole Stitching</p>
                    </div>
                    <div className="bg-[#111113] border border-white/5 p-2 rounded-lg text-center">
                      <div className="h-10 mb-1 flex items-center justify-center opacity-50"><svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Outer Profile</p>
                    </div>
                  </div>

                  <label className="flex flex-col items-center justify-center w-full min-h-[120px] border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 hover:border-white/30 transition-all cursor-pointer bg-[#111113]">
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <svg className="w-8 h-8 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      {proofFiles.length > 0 ? (
                        <p className="text-sm font-bold text-fi-accent">{proofFiles.length} images selected</p>
                      ) : (
                        <>
                          <p className="mb-1 text-sm text-gray-400 font-bold">Upload all 4 angles</p>
                          <p className="text-xs text-gray-500">Hold CTRL/CMD to select multiple</p>
                        </>
                      )}
                    </div>
                    <input type="file" multiple className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>

                <button 
                  onClick={handleSubmitForVerification}
                  disabled={!selectedSize || proofFiles.length === 0 || isSubmitting}
                  className="w-full py-4 rounded-xl bg-fi-accent text-black font-black uppercase tracking-widest hover:bg-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isSubmitting ? <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div> : 'Transmit to Authenticator'}
                </button>
                <p className="text-center text-[9px] text-gray-500 mt-4 uppercase tracking-widest">
                  Strict protocol active. Blurry or missing angles will result in rejection.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}