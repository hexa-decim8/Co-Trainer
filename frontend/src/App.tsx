import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SearchProvider } from './contexts/SearchContext';
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
import DrillManagerPage from './pages/DrillManagerPage';
import ExperimentalPage from './pages/ExperimentalPage';
import Layout from './components/Layout';
import { createQueryClient } from './config/queryConfig';

const queryClient = createQueryClient();

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <SearchProvider>
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
                
                {/* Protected routes - ErrorBoundary wraps Layout for all child routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <Layout />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/planner" replace />} />
                  <Route path="planner" element={<PlannerPage />} />
                  <Route path="library" element={<LibraryPage />} />
                  <Route path="drills" element={<DrillManagerPage />} />
                  <Route path="statistics" element={<StatisticsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="admin" element={<AdminPage />} />
                  <Route path="experimental/*" element={<ExperimentalPage />} />
                  <Route path="practice/:id" element={<MobileViewPage />} />
                  <Route path="*" element={<Navigate to="/planner" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
            </SearchProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
