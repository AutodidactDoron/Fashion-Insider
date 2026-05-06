import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });
  }, []);

  // בזמן שהמערכת בודקת את הסטטוס, לא מציגים כלום כדי למנוע הבהובים
  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-black" />; 
  }

  // אם אין משתמש - זרוק אותו לעמוד ההתחברות
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // אם יש משתמש - תן לו להיכנס לעמוד המבוקש
  return children;
}