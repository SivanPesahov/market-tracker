import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Menu,
  X,
  TrendingUp,
  Activity,
  LogOut,
  User,
  ListFilter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/add-trade", icon: PlusCircle, label: "Log Trade" },
    { to: "/trades", icon: ListFilter, label: "Trade History" },
    { to: "/ai-coach", icon: Activity, label: "AI Coach" },
  ];

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 z-[60] flex items-center justify-between px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <TrendingUp className="text-white h-5 w-5" />
          </div>
          <span className="font-bold text-lg text-white tracking-tighter uppercase font-black">MARKET TRACKER</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar - Desktop & Mobile */}
      <AnimatePresence>
        {(isOpen || window.innerWidth >= 1024) && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-0 left-0 bottom-0 w-[240px] bg-slate-900 border-r border-slate-800 z-[70] lg:z-50 flex flex-col pt-20 lg:pt-0 ${isOpen ? 'block' : 'hidden lg:flex'}`}
          >
            {/* Logo Section */}
            <div className="hidden lg:flex items-center gap-3 px-6 h-20 border-b border-slate-800 mb-8">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
                <TrendingUp className="text-white h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-xl text-white tracking-tighter leading-none uppercase">MARKET TRACKER</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Terminal</span>
              </div>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 px-3 space-y-1">
              <div className="px-4 mb-4">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4">Main Menu</p>
              </div>
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200
                    ${isActive 
                      ? 'bg-slate-800 text-white border-r-2 border-blue-500' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-500'} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Bottom Section - User Info & Logout */}
            <div className="p-4 border-t border-slate-800 mt-auto">
              <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-slate-950/50 border border-slate-800/50">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-blue-400">
                  <User size={16} />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-white truncate">{user?.username}</span>
                  <span className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Authorized</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>

          </motion.aside>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[65] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;
