import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const ISRAEL_CITIES = [
  'Tel Aviv', 'Jerusalem', 'Haifa', 'Rishon LeZion', 'Petah Tikva', 
  'Ashdod', 'Netanya', 'Beer Sheva', 'Bnei Brak', 'Holon', 
  'Rehovot', 'Ashkelon', 'Bat Yam', 'Ramat Gan', 'Herzliya', 
  'Kfar Saba', 'Hadera', 'Modiin', 'Raanana', 'Eilat'
];

const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Nala",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Ryker"
];

export default function ProfileEditModal({ profileData, onClose, onUpdate }) {
  const [avatarUrl, setAvatarUrl] = useState(profileData.avatar_url || '');
  const [localFile, setLocalFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(profileData.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileData.user_name}`);
  
  const [city, setCity] = useState(profileData.city || '');
  const [bio, setBio] = useState(profileData.bio || '');
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  // ⚡ BILLING STATE
  const [billingData, setBillingData] = useState(null);
  const [isBillingLoading, setIsBillingLoading] = useState(true);

  // חילוץ נתוני סליקה מדויקים בזמן אמת מהשרת כדי למנוע חוסר סנכרון ב-UI
  useEffect(() => {
    const fetchBilling = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('is_pro, plan_type, auto_renew, pro_expires_at')
        .eq('user_name', profileData.user_name)
        .single();
      
      setBillingData(data);
      setIsBillingLoading(false);
    };
    fetchBilling();
  }, [profileData.user_name]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setLocalFile(file);
    setAvatarUrl(''); 
  };

  const handlePresetClick = (presetUrl) => {
    setAvatarUrl(presetUrl);
    setPreviewUrl(presetUrl);
    setLocalFile(null); 
  };

  const checkImageSafety = async (file) => {
    const apiUser = import.meta.env.VITE_SIGHTENGINE_USER;
    const apiSecret = import.meta.env.VITE_SIGHTENGINE_SECRET;

    if (!apiUser || !apiSecret) {
      console.warn("Dev Mode: Moderation API keys are missing. Bypassing check.");
      return true;
    }

    try {
        const formData = new FormData();
        formData.append('media', file);
        formData.append('models', 'nudity-2.0,offensive,gore');
        formData.append('api_user', apiUser);
        formData.append('api_secret', apiSecret);
  
        const res = await fetch('https://api.sightengine.com/1.0/check.json', {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) throw new Error(`API returned status: ${res.status}`);
        
        const json = await res.json();
  
        const isNudity = json.nudity && (json.nudity.sexual_activity > 0.5 || json.nudity.suggestive > 0.5);
        const isOffensive = json.offensive && json.offensive.prob > 0.5;
        const isGore = json.gore && json.gore.prob > 0.5;
  
        if (isNudity || isOffensive || isGore) {
          console.warn("Moderation triggered:", { isNudity, isOffensive, isGore });
          return false;
        }
        
        return true;
      } catch (err) {
        console.warn("Moderation API failed (Network/Limit). Bypassing for development:", err);
        return true; 
      }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    let finalAvatarUrl = avatarUrl;

    if (localFile) {
      const isSafe = await checkImageSafety(localFile);
      
      if (!isSafe) {
        alert("System Block: Content verification failed. Image violates community guidelines.");
        setIsSaving(false);
        return;
      }

      const fileExt = localFile.name.split('.').pop();
      const fileName = `${profileData.user_name}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, localFile, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        console.error("Upload failed:", uploadError);
        alert("Failed to upload image. Please try again.");
        setIsSaving(false);
        return;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      finalAvatarUrl = data.publicUrl;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({
        avatar_url: finalAvatarUrl.trim() === '' ? null : finalAvatarUrl,
        city: city.trim() === '' ? null : city,
        bio: bio.trim() === '' ? null : bio
      })
      .eq('user_name', profileData.user_name);

    setIsSaving(false);

    if (!error) {
      onUpdate(); 
      onClose();
    } else {
      console.error("Update failed:", error);
      alert("Failed to update profile.");
    }
  };

  // ⚡ BILLING ACTIONS
  const handleToggleAutoRenew = async (e) => {
    e.preventDefault();
    const newStatus = !billingData.auto_renew;
    const { error } = await supabase
      .from('user_profiles')
      .update({ auto_renew: newStatus })
      .eq('user_name', profileData.user_name);
    
    if (!error) {
      setBillingData(prev => ({ ...prev, auto_renew: newStatus }));
    } else {
      alert("Error updating subscription settings.");
    }
  };

  const handleUpgradeToYearly = async (e) => {
    e.preventDefault();
    if (!window.confirm("Switching to Yearly will charge 10,000 CR instantly and extend your plan by 365 days. Continue?")) return;
    
    setIsSaving(true);
    const { data, error } = await supabase.rpc('subscribe_to_pro', {
      p_user_name: profileData.user_name,
      p_plan_type: 'yearly'
    });

    if (error) {
      alert(error.message.includes('INSUFFICIENT_FUNDS') ? "Insufficient Credits for Yearly upgrade." : error.message);
    } else {
      // רענון מידע הסליקה ב-UI
      const { data: updatedBilling } = await supabase
        .from('user_profiles')
        .select('is_pro, plan_type, auto_renew, pro_expires_at')
        .eq('user_name', profileData.user_name)
        .single();
      setBillingData(updatedBilling);
      alert("Successfully upgraded to Yearly PRO! Lock in your dominance.");
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6">Edit Profile</h2>

        <form onSubmit={handleSave} className="space-y-6">
          
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Avatar Selection</label>
            
            <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2 custom-scrollbar">
              {AVATAR_PRESETS.map((preset, idx) => (
                <img
                  key={idx}
                  src={preset}
                  alt={`Preset ${idx}`}
                  onClick={() => handlePresetClick(preset)}
                  className={`w-12 h-12 rounded-full object-cover cursor-pointer transition-all duration-200 border-2 shrink-0 ${
                    avatarUrl === preset 
                      ? 'border-fi-accent shadow-[0_0_15px_rgba(255,215,0,0.3)] scale-110' 
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-4 border-t border-white/5 pt-4">
              <img 
                src={previewUrl} 
                alt="Live Preview" 
                className="w-12 h-12 rounded-full object-cover border border-fi-accent/50 shadow-[0_0_10px_rgba(255,215,0,0.1)] shrink-0"
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-widest rounded-lg border border-white/10 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload Custom
              </button>
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
              />
              
              {localFile && (
                <span className="text-[10px] text-fi-accent font-bold uppercase tracking-widest">Ready to upload</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">City</label>
            <input
              list="israel-cities"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Start typing to search..."
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-fi-accent outline-none transition-colors"
            />
            <datalist id="israel-cities">
              {ISRAEL_CITIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the community about your collection..."
              rows="3"
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-fi-accent outline-none transition-colors resize-none custom-scrollbar"
            />
          </div>

          {/* ⚡ BILLING DASHBOARD INJECTION */}
          {!isBillingLoading && billingData?.is_pro && (
            <div className="border border-amber-500/30 bg-amber-950/10 rounded-xl p-5 mb-6">
              <h3 className="text-amber-500 font-black tracking-widest text-sm uppercase mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                Subscription Management
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-black/50 p-3 rounded-lg border border-white/5">
                  <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Current Plan</span>
                  <span className="text-white font-black text-sm uppercase">{billingData.plan_type}</span>
                </div>
                <div className="bg-black/50 p-3 rounded-lg border border-white/5">
                  <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Renews On</span>
                  <span className="text-white font-black text-sm">{new Date(billingData.pro_expires_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div>
                  <span className="block text-white font-bold text-xs">Auto-Renew</span>
                  <span className="text-[10px] text-zinc-400">Cancel anytime. Retain access until end of billing cycle.</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoRenew}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${billingData.auto_renew ? 'bg-amber-500' : 'bg-zinc-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${billingData.auto_renew ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* UPSELL: Monthly to Yearly */}
              {billingData.plan_type === 'monthly' && (
                <div className="mt-4 p-4 border border-fi-accent/40 bg-fi-accent/5 rounded-lg">
                  <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                    Paying monthly costs <strong className="text-white">12,000 CR/year</strong>. Upgrade to the Yearly plan for <strong className="text-white">10,000 CR</strong> and save <strong className="text-amber-500 font-black tracking-wider">2,000 CR</strong>.
                  </p>
                  <button 
                    type="button"
                    onClick={handleUpgradeToYearly}
                    className="w-full py-2 bg-fi-accent hover:opacity-90 text-black font-black text-[10px] uppercase tracking-widest rounded transition-opacity shadow-lg shadow-amber-500/20"
                  >
                    Upgrade to Yearly
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg font-bold text-xs bg-white/5 text-white hover:bg-white/10 transition-colors uppercase tracking-widest">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="flex-1 py-3 rounded-lg font-black text-xs text-black bg-fi-accent hover:opacity-90 transition-opacity uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2">
              {isSaving && <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />}
              {isSaving ? 'Processing...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}