import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { GlobalTransitionProvider, ToastProvider } from './components/ui';
import { AuthTransitionProvider } from './components/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Backtesting } from './pages/Backtesting';
import { StressTesting } from './pages/StressTesting';
import { NewsSentimentPage } from './pages/NewsSentimentPage';
import { StrategyLab } from './pages/StrategyLab';
import { FundamentalAnalysisPage } from './pages/FundamentalAnalysisPage';
import { MultiAssetHubPage } from './pages/MultiAssetHubPage';
import { ActuarialPage } from './pages/ActuarialPage';
import { AcademyPage } from './pages/AcademyPage';
import { AdminPage } from './pages/AdminPage';

export const App: React.FC = () => {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ToastProvider>
        <AuthProvider>
        <GlobalTransitionProvider>
        <AuthTransitionProvider>
        <Routes>
          {/* Routes publiques */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Routes protégées */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/markets"
            element={
              <ProtectedRoute>
                <MultiAssetHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/news"
            element={
              <ProtectedRoute>
                <NewsSentimentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/strategies"
            element={
              <ProtectedRoute>
                <StrategyLab />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/backtesting"
            element={
              <ProtectedRoute>
                <Backtesting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/stress-testing"
            element={
              <ProtectedRoute>
                <StressTesting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/fundamentals"
            element={
              <ProtectedRoute>
                <FundamentalAnalysisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/actuary"
            element={
              <ProtectedRoute>
                <ActuarialPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/academy"
            element={
              <ProtectedRoute>
                <AcademyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminPage />
              </ProtectedRoute>
            }
          />

          {/* Redirection racine vers /app */}
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
        </AuthTransitionProvider>
        </GlobalTransitionProvider>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
    </MotionConfig>
  );
};

export default App;
