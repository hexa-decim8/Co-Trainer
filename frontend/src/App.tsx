import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import PlannerPage from './pages/PlannerPage';
import LibraryPage from './pages/LibraryPage';
import MobileViewPage from './pages/MobileViewPage';
import SettingsPage from './pages/SettingsPage';
import StatisticsPage from './pages/StatisticsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';
import Layout from './components/Layout';
import { createQueryClient } from './config/queryConfig';

const queryClient = createQueryClient();

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={
                  <ErrorBoundary>
                    <LoginPage />
                  </ErrorBoundary>
                } />
                <Route path="/register" element={
                  <ErrorBoundary>
                    <RegisterPage />
                  </ErrorBoundary>
                } />
                
                {/* Protected routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/planner" replace />} />
                  <Route path="planner" element={
                    <ErrorBoundary>
                      <PlannerPage />
                    </ErrorBoundary>
                  } />
                  <Route path="library" element={
                    <ErrorBoundary>
                      <LibraryPage />
                    </ErrorBoundary>
                  } />
                  <Route path="statistics" element={
                    <ErrorBoundary>
                      <StatisticsPage />
                    </ErrorBoundary>
                  } />
                  <Route path="settings" element={
                    <ErrorBoundary>
                      <SettingsPage />
                    </ErrorBoundary>
                  } />
                  <Route path="admin" element={
                    <ErrorBoundary>
                      <AdminPage />
                    </ErrorBoundary>
                  } />
                  <Route path="practice/:id" element={
                    <ErrorBoundary>
                      <MobileViewPage />
                    </ErrorBoundary>
                  } />
                </Route>
              </Routes>
            </BrowserRouter>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
