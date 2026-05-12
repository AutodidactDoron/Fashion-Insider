import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AdminRoute({ children }) {
  const [isAdmin, setIsAdmin] = useState(null); 

  // ⚡ THE VAULT KEY: Hardcoded Master Admin Clearance
  const MASTER_ADMIN_EMAIL = "dddd4444hhhh@gmail.com"; 

  useEffect(() => {
    const checkSecurityClearance = async () => {
      // 1. Fetch the cryptographically secure session from Supabase
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      // Immediate Rejection: No valid token, kill the request
      if (authError || !session) {
        setIsAdmin(false);
        return;
      }

      // 2. Zero-Latency Memory Check (Bypassing DB query overhead)
      if (session.user.email === MASTER_ADMIN_EMAIL) {
        setIsAdmin(true); 
      } else {
        setIsAdmin(false); // Intruder detected
      }
    };

    checkSecurityClearance();

    // 3. Real-time lockdown listener (If admin logs out, boot them out immediately)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user.email === MASTER_ADMIN_EMAIL) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
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