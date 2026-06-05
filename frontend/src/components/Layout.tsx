import { Outlet, Link, useLocation } from 'react-router-dom';
import { Calendar, Library, Settings, Menu, X, User, LogOut, Shield, BarChart3, ClipboardList, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const location = useLocation();
  const isMobileView = location.pathname.startsWith('/practice/');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  // Don't show nav on mobile practice view
  if (isMobileView) {
    return <Outlet />;
  }

  const isActive = (path: string) => location.pathname === path;
  const isActivePrefix = (prefix: string) => location.pathname.startsWith(prefix);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Desktop Navigation */}
      <nav className="bg-derby-black shadow-track border-b-4 border-primary-600">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="derby-star text-primary-500 text-4xl">★</div>
              <h1 className="text-3xl font-display font-bold text-white tracking-wider">
                CO-TRAINER
              </h1>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center space-x-2">
              <Link
                to="/planner"
                className={`flex items-center gap-2 px-5 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
                  isActive('/planner')
                    ? 'bg-primary-600 text-white shadow-derby'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Practice Planner
              </Link>
              <Link
                to="/library"
                className={`flex items-center gap-2 px-5 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
                  isActive('/library')
                    ? 'bg-primary-600 text-white shadow-derby'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Library className="w-5 h-5" />
                Plan Library
              </Link>
              <Link
                to="/drills"
                className={`flex items-center gap-2 px-5 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
                  isActive('/drills')
                    ? 'bg-primary-600 text-white shadow-derby'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                Drill Manager
              </Link>
              <Link
                to="/statistics"
                className={`flex items-center gap-2 px-5 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
                  isActive('/statistics')
                    ? 'bg-primary-600 text-white shadow-derby'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                Statistics
              </Link>
              <Link
                to="/experimental"
                className={`flex items-center gap-2 px-5 py-3 rounded-lg text-base font-semibold transition-all duration-200 ${
                  isActivePrefix('/experimental')
                    ? 'bg-primary-600 text-white shadow-derby'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                <FlaskConical className="w-5 h-5" />
                Experimental
              </Link>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all duration-200"
                >
                  <User className="w-5 h-5" />
                  <span className="font-semibold">
                    {user?.derby_name || user?.email}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user?.derby_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                    </div>
                    {user?.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Shield className="w-4 h-4" />
                        Admin Panel
                      </Link>
                    )}
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-gray-900 border-t border-gray-800">
            <div className="px-4 py-3 space-y-2">
              <Link
                to="/planner"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all ${
                  isActive('/planner')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Practice Planner
              </Link>
              <Link
                to="/library"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all ${
                  isActive('/library')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <Library className="w-5 h-5" />
                Plan Library
              </Link>
              <Link
                to="/drills"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all ${
                  isActive('/drills')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                Drill Manager
              </Link>
              <Link
                to="/statistics"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all ${
                  isActive('/statistics')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                Statistics
              </Link>
              <Link
                to="/experimental"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all ${
                  isActivePrefix('/experimental')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <FlaskConical className="w-5 h-5" />
                Experimental
              </Link>
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all ${
                  isActive('/settings')
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <Settings className="w-5 h-5" />
                Settings
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="min-h-[calc(100vh-5rem)]">
        <Outlet />
      </main>
    </div>
  );
}
