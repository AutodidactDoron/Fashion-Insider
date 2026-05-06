import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AdminRoute({ children }) {
  const [isAdmin, setIsAdmin] = useState(null); 

  useEffect(() => {
    const checkSecurityClearance = async () => {
      // ⚡ Dynamic Identity Extraction: Pulling the actual logged-in user
      const activeUser = localStorage.getItem('currentUser');

      // Immediate Rejection: If no one is logged in, kill the request
      if (!activeUser) {
        setIsAdmin(false);
        return;
      }

      // Zero-latency check against the Admin Ledger using the DYNAMIC user
      const { data, error } = await supabase
        .from('platform_admins')
        .select('user_name')
        .eq('user_name', activeUser) 
        .single();

      if (data) {
        setIsAdmin(true); // User is verified on the ledger
      } else {
        setIsAdmin(false); // Intruder detected
        if (error && error.code !== 'PGRST116') {
            console.error("Clearance Check Error:", error);
        }
      }
    };

    checkSecurityClearance();
  }, []);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-2 border-fi-accent border-t-transparent rounded-full"></div>
          <p className="text-fi-accent font-black uppercase tracking-widest text-xs">Verifying Clearance...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}