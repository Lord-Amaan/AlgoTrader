import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';
import Dashboard from './pages/Dashboard';
import StrategyBuilder from './pages/StrategyBuilder';
import Strategies from './pages/Strategies';
import Backtesting from './pages/Backtesting';
import LiveTrading from './pages/LiveTrading';
import LiveCharts from './pages/LiveCharts';
import Login from './pages/Login';
import Register from './pages/Register';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import { useClerkAxios } from './context/AuthContext';
import api from './services/api';

function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row">
      <Sidebar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  return (
    <>
      <SignedIn>
        <AppLayout>{children}</AppLayout>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

export default function App() {
  // Keeps API calls authenticated across the app.
  useClerkAxios();
  const { isSignedIn, userId } = useAuth();
  const syncedForUser = useRef(null);

  useEffect(() => {
    // Sync signed-in Clerk user to Mongo once per user session.
    if (!isSignedIn || !userId || syncedForUser.current === userId) {
      return;
    }

    api.get('/auth/me')
      .then(() => {
        syncedForUser.current = userId;
      })
      .catch(() => {
        // Keep app usable even if sync fails; next API calls can retry.
      });
  }, [isSignedIn, userId]);

  return (
    <Routes>
      <Route path="/sign-in/*" element={<Login />} />
      <Route path="/sign-up/*" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/strategy-builder"
        element={
          <ProtectedRoute>
            <StrategyBuilder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/strategies"
        element={
          <ProtectedRoute>
            <Strategies />
          </ProtectedRoute>
        }
      />
      <Route
        path="/backtest"
        element={
          <ProtectedRoute>
            <Backtesting />
          </ProtectedRoute>
        }
      />
      <Route
        path="/live-charts"
        element={
          <ProtectedRoute>
            <LiveCharts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/live"
        element={
          <ProtectedRoute>
            <LiveTrading />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
