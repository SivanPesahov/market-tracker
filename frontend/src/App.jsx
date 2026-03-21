import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import TradeEntry from './pages/TradeEntry';
import AICoach from './pages/AICoach';
import TradeHistory from './pages/TradeHistory';
import Login from './pages/Login';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
  
  return user ? children : <Navigate to="/login" />;
};

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex overflow-x-hidden">
      {user && <Navbar />}
      <main className={`flex-1 ${user ? 'lg:pl-[240px] pt-16 lg:pt-0' : ''}`}>
        <div className="min-h-screen">
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/add-trade" element={<PrivateRoute><TradeEntry /></PrivateRoute>} />
            <Route path="/ai-coach" element={<PrivateRoute><AICoach /></PrivateRoute>} />
            <Route path="/trades" element={<PrivateRoute><TradeHistory /></PrivateRoute>} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
