import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PlannerPage from './pages/PlannerPage';
import LibraryPage from './pages/LibraryPage';
import MobileViewPage from './pages/MobileViewPage';
import Layout from './components/Layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/planner" replace />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="practice/:id" element={<MobileViewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
