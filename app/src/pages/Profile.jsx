import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import TrustBadge from '../components/TrustBadge';
import ProfileEditModal from '../components/ProfileEditModal';

export default function Profile() {
  const { username } = useParams();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [currentViewer, setCurrentViewer] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchUserProfile = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_name, id_verified, is_pro, trust_score, avatar_url, city, bio')
      .eq('user_name', username)
      .single();

    if (data && !error) {
      setProfileData(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentViewer(session?.user ?? null);
    });

    if (username) {
      setLoading(true);
      fetchUserProfile();
    }
  }, [username]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#111113]"><div className="w-8 h-8 border-4 border-fi-accent border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!profileData) {
    return <div className="flex items-center justify-center min-h-screen bg-[#111113] text-white"><h2 className="text-2xl font-black tracking-widest text-white/50">USER NOT FOUND</h2></div>;
  }

  const isOwner = currentViewer && (currentViewer.user_metadata?.user_name === profileData.user_name || currentViewer.email?.split('@')[0] === profileData.user_name);
  
  // ⚡ THE AVATAR ENGINE: משיכת תמונה אישית, אחרת Felix
  const displayAvatar = profileData.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=Felix`;

  return (
    <div className="min-h-screen bg-[#111113] p-6 lg:p-12 text-white">
      <div className="max-w-4xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative">
        
        {isOwner && (
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="absolute top-6 right-6 px-4 py-2 bg-white/10 hover:bg-fi-accent hover:text-black text-white text-xs font-black tracking-widest uppercase rounded-lg border border-white/20 transition-all duration-200 shadow-md"
          >
            Edit Profile
          </button>
        )}

        <div className="flex flex-col md:flex-row items-center gap-8 mt-4 md:mt-0">
          <div className="relative">
            <img src={displayAvatar} alt="Profile Avatar" className="w-32 h-32 rounded-full object-cover bg-fi-accent shadow-[0_0_20px_rgba(255,215,0,0.15)] border-2 border-white/5" />
          </div>

          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3">
            <h1 className="text-4xl font-black tracking-tight">{profileData.user_name}</h1>
            
            {profileData.id_verified && (
              <div className="flex items-center gap-1.5 text-fi-accent text-xs uppercase font-black tracking-widest bg-fi-accent/10 px-3 py-1 rounded-full border border-fi-accent/20">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span>ID VERIFIED</span>
              </div>
            )}
            <div className="mt-2">
              <TrustBadge username={profileData.user_name} className="bg-black/60 border border-white/10 px-5 py-2 rounded-full text-sm shadow-inner" />
            </div>
          </div>
        </div>
        
        {/* ⚡ DATA INJECTION: הצגת המידע החי מהמסד */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <h3 className="text-lg font-bold mb-4 text-gray-200 tracking-wide uppercase">About</h3>
          <div className="bg-black/40 border border-white/10 rounded-xl p-6 text-gray-300 text-sm flex flex-col md:flex-row gap-8">
            <div className="md:w-1/3">
              <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">City / Base</span>
              <span className="font-medium text-white text-base">{profileData.city || 'Not specified'}</span>
            </div>
            <div className="md:w-2/3 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-8">
              <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">Bio</span>
              <p className="leading-relaxed whitespace-pre-wrap">{profileData.bio || 'This user hasn\'t added a bio yet.'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ⚡ THE UX FIX: העברת הפונקציה fetchUserProfile לפרופס כדי לרענן את הנתונים חלקה */}
      {isEditModalOpen && (
        <ProfileEditModal 
          profileData={profileData} 
          onClose={() => setIsEditModalOpen(false)} 
          onUpdate={() => fetchUserProfile()} 
        />
      )} 
    </div>
  );
}