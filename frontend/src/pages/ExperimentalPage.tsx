import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { GitMerge } from 'lucide-react';
import ProgressionsPage from './ProgressionsPage';

const subTabs = [
  { to: 'progressions', label: 'Progressions', icon: GitMerge },
];

export default function ExperimentalPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Sub-nav bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6">
        <div className="flex items-center gap-1 h-12">
          {subTabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}

          <div className="ml-4 flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 tracking-wide uppercase">
              Experimental
            </span>
          </div>
        </div>
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route index element={<Navigate to="progressions" replace />} />
          <Route path="progressions" element={<ProgressionsPage />} />
        </Routes>
      </div>
    </div>
  );
}
