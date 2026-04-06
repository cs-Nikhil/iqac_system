import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import JorvisChat from './JorvisChat';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jorvisOpen, setJorvisOpen] = useState(false);
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const isFaculty = user?.role === 'faculty';
  const isStudent = user?.role === 'student';
  const showJorvis = Boolean(user?.role);

  return (
    <div className="relative min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div
        className={[
          'flex min-h-screen flex-col transition-[padding] duration-300',
          'lg:pl-[17.5rem]',
          showJorvis && jorvisOpen ? 'lg:pr-[28.5rem]' : '',
        ].join(' ')}
      >
        <div className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div>
              <p className="text-sm font-semibold text-content-primary">
                {isStaff ? 'Staff Panel' : isFaculty ? 'Faculty Panel' : isStudent ? 'Student Panel' : 'IQAC Dashboard'}
              </p>
              <p className="text-xs text-content-muted">
                {isFaculty
                  ? 'IQAC academic workspace'
                  : isStudent
                    ? 'Semester-wise student workspace'
                    : 'Monitoring workspace'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="btn-secondary h-10 w-10 p-0"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        <main className="min-h-screen flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {showJorvis ? (
        <JorvisChat isOpen={jorvisOpen} onOpenChange={setJorvisOpen} />
      ) : null}
    </div>
  );
}
