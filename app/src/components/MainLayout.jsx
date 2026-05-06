import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function MainLayout() {
  // המוח: שומר את המצב של התפריט (פתוח/סגור)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-[100dvh] w-full bg-black text-white overflow-hidden">
      
      {/* מסך עשן למובייל: לחיצה עליו תסגור את התפריט */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* מעבירים ל-Sidebar את המצב הנוכחי ואת היכולת להיסגר */}
      <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setIsSidebarOpen(false)} />
      
      {/* מעבירים ל-TopBar את השלט-רחוק כדי שיוכל לפתוח/לסגור */}
      <TopBar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <main className="relative pt-24 pl-0 md:pl-56 w-full h-full">
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}