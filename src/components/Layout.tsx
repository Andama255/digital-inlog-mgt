import { Outlet, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { LogOut, BookOpen, User, Calendar, ClipboardList, Settings, Bell, Menu, X, ChevronRight, AlertCircle, Users } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import NotificationCenter from './NotificationCenter';

interface LayoutProps {
  user: any;
  onLogout: () => void;
}

export default function Layout({ user, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!user) {
    return <Navigate to="/login" />;
  }

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    onLogout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: BookOpen, path: '/' },
    { label: 'Logbook', icon: ClipboardList, path: '/logbook', roles: ['student'] },
    { label: 'Reviews', icon: ClipboardList, path: '/reviews', roles: ['field_supervisor', 'academic_supervisor'] },
    { label: 'User Management', icon: Users, path: '/user-management', roles: ['admin'] },
    { label: 'Profile', icon: User, path: '/profile' },
  ];

  const filteredNav = navItems.filter(item => !item.roles || item.roles.includes(user.role));

  const NavContent = () => (
    <>
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          <BookOpen className="w-6 h-6" />
          <span>InternLog</span>
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                  : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-gray-400 group-hover:text-indigo-600")} />
                <span className="font-medium">{item.label}</span>
              </div>
              {isActive && <ChevronRight className="w-4 h-4" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-4">
        <Link
          to="/profile"
          onClick={() => setIsMobileMenuOpen(false)}
          className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl hover:bg-indigo-50 transition-all group border border-transparent hover:border-indigo-100"
        >
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold group-hover:bg-indigo-200 transition-colors overflow-hidden">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0) || '?'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{user.name}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{user.role.replace('_', ' ')}</p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold text-sm"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-200 hidden lg:flex flex-col sticky top-0 h-screen">
        <NavContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="absolute top-4 right-4 lg:hidden">
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="lg:hidden">
              <h1 className="text-xl font-bold text-indigo-600">InternLog</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationCenter userRole={user.role} />
            <Link 
              to="/profile" 
              className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 overflow-hidden"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0) || '?'
              )}
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-6">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Logout</h3>
                <p className="text-gray-500 mb-8">Are you sure you want to log out of your account?</p>
                
                <div className="flex flex-col gap-3">
                  <button
                    onClick={confirmLogout}
                    className="w-full py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                  >
                    Logout
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="w-full py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
