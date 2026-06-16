import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import MainLayout from './components/MainLayout';
import CommunityContent from './components/CommunityContent';
import ProtectedRoute from './components/ProtectedRoute'; 
import MyCloset from './components/MyCloset';
import MyPostsContent from './components/MyPostsContent';
import MyTradesContent from './components/MyTradesContent';
import AdminPanel from './components/AdminPanel';
import AdminRoute from './components/AdminRoute'; 

// ⚡ הייבוא החסר: קוראים למנוע ה-V2 מהקובץ הנפרד שיצרת
import GlobalRealtimeEngine from './components/GlobalRealtimeEngine';

function ComingSoonPage({ title }) {
  return (
    <div className="bg-[#111113] rounded-xl p-6 border border-white/10">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <p className="text-gray-400 mt-2">This page route is live. Content will be migrated next.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* ⚡ V2 Master Engine 
        כאן המנוע מוזרק לשורש המערכת. 
        שיים לב שבעתיד נצטרך להעביר לו את ה-currentUserId, 
        אבל המנוע בנוי לא לקרוס גם אם הוא ריק כרגע.
      */}
      <GlobalRealtimeEngine currentUserId={null} />
      
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* === המעטפת הכללית (Layout) - כולם רואים את התפריטים === */}
        <Route element={<MainLayout />}>
          
          {/* 🟢 הגישה החופשית (Top of Funnel - Freemium) 🟢 */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/community" element={<CommunityContent />} />
          <Route path="/my-posts" element={<MyPostsContent/>} />

          {/* 🔴 הכספת הסגורה (The Vault - Traders Only) 🔴 */}
          <Route 
            path="/closet" 
            element={<ProtectedRoute><MyCloset /></ProtectedRoute>} 
          />
          <Route 
            path="/trades" 
            element={<ProtectedRoute><MyTradesContent /></ProtectedRoute>} 
          />
          <Route 
            path="/messages" 
            element={<ProtectedRoute><ComingSoonPage title="Messages" /></ProtectedRoute>} 
          />
          <Route 
            path="/settings" 
            element={<ProtectedRoute><ComingSoonPage title="Settings" /></ProtectedRoute>} 
          />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* ⚡ The Admin Route - Isolated and Secured ⚡ */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminPanel />
            </AdminRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}