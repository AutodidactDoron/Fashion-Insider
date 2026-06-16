import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// ⚡ THE SANITIZATION ENGINE: Dictionaries
const BRAND_DICTIONARY = {
  "Nike": ["Air Force 1", "Dunk Low", "Dunk High", "Air Max 1", "Air Max 95", "Vomero 5", "SB Dunk Low"],
  "Jordan": ["Air Jordan 1 High", "Air Jordan 1 Low", "Air Jordan 3", "Air Jordan 4", "Air Jordan 11"],
  "Adidas": ["Samba", "Gazelle", "Campus", "Yeezy Boost 350", "Yeezy Slide"],
  "New Balance": ["990v3", "990v4", "990v6", "2002R", "1906R", "550"],
  "Asics": ["Gel-Kayano 14", "Gel-NYC", "GT-2160"],
  "Salomon": ["XT-6", "XT-4", "ACS Pro"],
  "Converse": ["Chuck 70", "Run Star Hike"]
};

const COMMON_COLORS = [
  "Black", "White", "Grey", "Red", "Blue", "Green", "Brown", "Yellow", "Pink", "Purple", "Multi-Color"
];

// ⚡ STANDARD SIZE DICTIONARY
const STANDARD_SIZES = [
  "US 3.5", "US 4", "US 4.5", "US 5", "US 5.5", "US 6", "US 6.5", "US 7", "US 7.5", 
  "US 8", "US 8.5", "US 9", "US 9.5", "US 10", "US 10.5", "US 11", "US 11.5", 
  "US 12", "US 12.5", "US 13", "US 14", "US 15", "US 16", "OS (One Size)"
];

// ⚡ CONDITION DICTIONARY
const CONDITIONS = [
  { id: 'DS', label: 'Deadstock (Brand New)' },
  { id: 'VNDS', label: 'Very Near Deadstock (Worn 1-2 times)' },
  { id: 'USED', label: 'Used (Shows signs of wear)' }
];

export default function AddAssetModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [ingestionMode, setIngestionMode] = useState('index'); 
  
  const [liveCatalog, setLiveCatalog] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Hierarchical State Management
  const [selectedBrand, setSelectedBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  
  const [selectedModel, setSelectedModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  
  const [selectedColor, setSelectedColor] = useState('');
  const [customColor, setCustomColor] = useState('');
  
  // Authentication Step State
  const [selectedSize, setSelectedSize] = useState('');
  const [customSize, setCustomSize] = useState('');
  const [selectedCondition, setSelectedCondition] = useState(''); // ⚡ NEW STATE
  const [proofFiles, setProofFiles] = useState([]); 

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchMasterCatalog();
      resetState();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedBrand) {
      setSelectedModel('');
      setCustomModel('');
      setSelectedColor('');
      setCustomColor('');
      
      if (selectedBrand === 'OTHER') {
        setSelectedModel('OTHER');
        setSelectedColor('OTHER');
      }
    }
  }, [selectedBrand]);

  const resetState = () => {
    setStep(1);
    setIngestionMode('index');
    setSelectedItem(null);
    setSearchQuery('');
    setSelectedBrand('');
    setCustomBrand('');
    setSelectedModel('');
    setCustomModel('');
    setSelectedColor('');
    setCustomColor('');
    setSelectedSize('');
    setCustomSize('');
    setSelectedCondition(''); // ⚡ RESET
    setProofFiles([]);
  };

  const fetchMasterCatalog = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('catalog_items').select('*').order('brand', { ascending: true });
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

  // Logic Gate Validation
  const isBrandReady = selectedBrand === 'OTHER' ? customBrand.trim() !== '' : selectedBrand !== '';
  const isModelReady = selectedModel === 'OTHER' ? customModel.trim() !== '' : selectedModel !== '';
  const isColorReady = selectedColor === 'OTHER' ? customColor.trim() !== '' : selectedColor !== '';
  const isUnlistedValid = isBrandReady && isModelReady && isColorReady;
  
  const isSizeReady = selectedSize === 'OTHER' ? customSize.trim() !== '' : selectedSize !== '';
  const isConditionReady = ingestionMode === 'index' ? selectedCondition !== '' : true; // ⚡ Require condition for index items

  const handleSubmitForVerification = async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      alert("Auth Error: Session expired or invalid. Please log in again.");
      return;
    }

    const isReady = ingestionMode === 'index' 
      ? (selectedItem && isSizeReady && isConditionReady && proofFiles.length > 0)
      : (isUnlistedValid && isSizeReady && proofFiles.length > 0);
      
    if (!isReady) return;
    setIsSubmitting(true);

    let uploadedImageUrls = [];

    try {
      const uploadPromises = proofFiles.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `pending/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('verification_proofs').upload(filePath, file);

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

      const finalSize = selectedSize === 'OTHER' ? customSize.trim() : selectedSize;

      if (ingestionMode === 'index') {
        const { error } = await supabase.from('user_closet_items').insert([{
          user_name: user.id, 
          catalog_item_id: selectedItem.id,
          size: finalSize,
          condition_status: selectedCondition, // ⚡ Injects user's selection
          proof_image_url: uploadedImageUrls[0], 
          is_verified: false
        }]); 
        
        if (error) throw error;
        
        window.dispatchEvent(new Event('refresh_closet'));
        window.dispatchEvent(new Event('refresh_admin_queues'));
        
      } else {
        const finalBrand = selectedBrand === 'OTHER' ? customBrand.trim() : selectedBrand;
        const finalModel = selectedModel === 'OTHER' ? customModel.trim() : selectedModel;
        const finalColor = selectedColor === 'OTHER' ? customColor.trim() : selectedColor;
        const finalName = `${finalModel} - ${finalColor}`;

        const { error } = await supabase.from('catalog_requests').insert([{
          user_name: user.id, 
          proposed_brand: finalBrand,
          proposed_name: finalName,
          size: finalSize,
          proof_image_urls: uploadedImageUrls,
          status: 'pending_review'
        }]); 
        
        if (error) throw error;
        
        window.dispatchEvent(new Event('refresh_admin_queues'));
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
        
        <div className="p-6 border-b border-white/5 relative bg-black/40 shrink-0">
          <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h2 className="text-xl font-black text-white uppercase tracking-widest">Asset Verification</h2>
          
          {step === 1 && (
            <div className="flex gap-4 mt-6 border-b border-white/10">
              <button onClick={() => setIngestionMode('index')} className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all ${ingestionMode === 'index' ? 'text-fi-accent border-b-2 border-fi-accent' : 'text-gray-500 hover:text-white'}`}>Global Index</button>
              <button onClick={() => setIngestionMode('unlisted')} className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all ${ingestionMode === 'unlisted' ? 'text-fi-accent border-b-2 border-fi-accent' : 'text-gray-500 hover:text-white'}`}>Submit Unlisted</button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col min-h-0">
          
          {step === 1 && (
            <div className="animate-in fade-in duration-300 flex-1 flex flex-col">
              {ingestionMode === 'index' && (
                <>
                  <div className="relative mb-6 shrink-0">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="Search Master Catalog..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-4 py-4 text-white text-sm focus:border-fi-accent focus:ring-1 focus:ring-fi-accent outline-none" />
                  </div>
                  {loading ? (
                    <div className="flex justify-center p-12"><div className="animate-spin w-8 h-8 border-2 border-fi-accent border-t-transparent rounded-full"></div></div>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
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
                <div className="space-y-5 flex-1 bg-black/30 p-5 rounded-xl border border-white/5">
                  <div className="mb-2">
                    <h3 className="text-white font-bold text-sm mb-1">Request Catalog Expansion</h3>
                    <p className="text-[11px] text-gray-400">Assemble the asset profile. Fields are strictly enforced.</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">1. Select Brand</label>
                    <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3.5 text-white text-sm focus:border-fi-accent outline-none appearance-none cursor-pointer">
                      <option value="" disabled>Choose a brand...</option>
                      {Object.keys(BRAND_DICTIONARY).map(brand => (<option key={brand} value={brand}>{brand}</option>))}
                      <option value="OTHER">OTHER (Manual Entry)</option>
                    </select>
                  </div>
                  {selectedBrand === 'OTHER' && (
                    <div className="animate-in slide-in-from-top-2">
                      <input type="text" value={customBrand} onChange={(e) => setCustomBrand(e.target.value)} placeholder="Type custom brand..." className="w-full bg-black border border-fi-accent/30 rounded-lg p-3 text-white text-sm focus:border-fi-accent outline-none" required />
                    </div>
                  )}

                  <div className={`transition-opacity duration-300 ${!isBrandReady ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">2. Select Model</label>
                    <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3.5 text-white text-sm focus:border-fi-accent outline-none appearance-none cursor-pointer">
                      <option value="" disabled>Choose a model...</option>
                      {selectedBrand && selectedBrand !== 'OTHER' && BRAND_DICTIONARY[selectedBrand].map(model => (<option key={model} value={model}>{model}</option>))}
                      <option value="OTHER">OTHER (Manual Entry)</option>
                    </select>
                  </div>
                  {selectedModel === 'OTHER' && (
                    <div className="animate-in slide-in-from-top-2">
                      <input type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="Type exact model name (e.g., Gel-Kayano 14)" className="w-full bg-black border border-fi-accent/30 rounded-lg p-3 text-white text-sm focus:border-fi-accent outline-none" required />
                    </div>
                  )}

                  <div className={`transition-opacity duration-300 ${!isModelReady ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">3. Primary Colorway</label>
                    <select value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-3.5 text-white text-sm focus:border-fi-accent outline-none appearance-none cursor-pointer">
                      <option value="" disabled>Choose primary color...</option>
                      {COMMON_COLORS.map(color => (<option key={color} value={color}>{color}</option>))}
                      <option value="OTHER">OTHER (Specific Colorway Name)</option>
                    </select>
                  </div>
                  {selectedColor === 'OTHER' && (
                    <div className="animate-in slide-in-from-top-2">
                      <input type="text" value={customColor} onChange={(e) => setCustomColor(e.target.value)} placeholder="Type exact colorway (e.g., Chicago, UNC, JJJJound)" className="w-full bg-black border border-fi-accent/30 rounded-lg p-3 text-white text-sm focus:border-fi-accent outline-none" required />
                    </div>
                  )}

                </div>
              )}

              <button onClick={() => setStep(2)} disabled={ingestionMode === 'index' ? !selectedItem : !isUnlistedValid} className="mt-6 w-full py-4 rounded-xl bg-white !text-black !font-black uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                Proceed to Authentication
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in slide-in-from-right-4 duration-300 flex-1 flex flex-col">
              <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-white mb-6 flex items-center gap-1 font-bold uppercase tracking-wider shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Back
              </button>
              
              <div className="bg-black border border-white/5 rounded-2xl p-6 flex-1 flex flex-col">
                
                {/* ⚡ THE SANITIZED SIZE & CONDITION GRID */}
                <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Asset Size (US)</label>
                    <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} className="w-full bg-[#111113] border border-white/10 rounded-xl px-4 py-3.5 text-white font-mono text-sm focus:border-fi-accent outline-none appearance-none cursor-pointer">
                      <option value="" disabled>Select size...</option>
                      {STANDARD_SIZES.map(s => (<option key={s} value={s}>{s}</option>))}
                      <option value="OTHER">OTHER (Apparel/Custom)</option>
                    </select>
                    {selectedSize === 'OTHER' && (
                      <div className="mt-2 animate-in slide-in-from-top-2">
                        <input type="text" value={customSize} onChange={(e) => setCustomSize(e.target.value)} placeholder="e.g. Apparel M" className="w-full bg-[#111113] border border-fi-accent/30 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-fi-accent outline-none" required />
                      </div>
                    )}
                  </div>

                  {ingestionMode === 'index' && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Condition</label>
                      <select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value)} className="w-full bg-[#111113] border border-white/10 rounded-xl px-4 py-3.5 text-white font-mono text-sm focus:border-fi-accent outline-none appearance-none cursor-pointer">
                        <option value="" disabled>Select condition...</option>
                        {CONDITIONS.map(c => (<option key={c.id} value={c.id}>{c.label}</option>))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex justify-between items-end mb-3 shrink-0">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Authentication Evidence</label>
                    <span className="text-[9px] text-fi-accent font-bold uppercase tracking-widest">Required</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 shrink-0">
                    {['Box Label', 'Inside Size Tag', 'Insole Stitching', 'Outer Profile'].map((label, i) => (
                      <div key={i} className="bg-[#111113] border border-white/5 p-2 rounded-lg text-center">
                        <div className="h-8 mb-1 flex items-center justify-center opacity-50"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                      </div>
                    ))}
                  </div>

                  <label className="flex flex-col items-center justify-center w-full flex-1 border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 hover:border-white/30 transition-all cursor-pointer bg-[#111113] min-h-[100px]">
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <svg className="w-8 h-8 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      {proofFiles.length > 0 ? (
                        <p className="text-sm font-bold text-fi-accent">{proofFiles.length} images selected</p>
                      ) : (
                        <><p className="mb-1 text-sm text-gray-400 font-bold">Upload all 4 angles</p><p className="text-[10px] text-gray-500">Hold CTRL/CMD to select multiple</p></>
                      )}
                    </div>
                    <input type="file" multiple className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>

                <button 
                  onClick={handleSubmitForVerification}
                  disabled={!isSizeReady || (ingestionMode === 'index' && !isConditionReady) || proofFiles.length === 0 || isSubmitting}
                  className="w-full mt-6 py-4 rounded-xl bg-fi-accent text-black font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shrink-0 shadow-[0_0_15px_rgba(255,215,0,0.2)]"
                >
                  {isSubmitting ? <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div> : 'Transmit to Authenticator'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}