import React from 'react';
import { 
  Activity, 
  Database, 
  Calendar, 
  Package, 
  Layers, 
  GitCompare, 
  BookOpen, 
  AlertTriangle
} from './icons';

export type NavTab = 
  | 'dashboard' 
  | 'dataset' 
  | 'schedule' 
  | 'inventory' 
  | 'comparison' 
  | 'formulation' 
  | 'validation';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  solverAvailable: boolean | null;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, solverAvailable }) => {
  const tabs = [
    { id: 'dashboard', label: 'Overview & Solver', icon: Activity },
    { id: 'comparison', label: '4-Way Scenario Lab', icon: GitCompare },
    { id: 'schedule', label: 'Production Schedule', icon: Calendar },
    { id: 'inventory', label: 'Inventory & Ageing', icon: Package },
    { id: 'dataset', label: 'Dataset & Demand', icon: Database },
    { id: 'formulation', label: 'MILP Explorer', icon: BookOpen },
    { id: 'validation', label: 'Audit & Methodology', icon: Layers },
  ];

  return (
    <header className="bg-soft-base/90 backdrop-blur-md border-b border-soft-border/80 sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-soft-lg bg-gradient-to-tr from-brand-700 via-brand-600 to-teal-400 flex items-center justify-center shadow-soft-sm border border-white/60 flex-shrink-0">
              <span className="text-xl font-extrabold text-white tracking-wider">G2</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">GrainOpt 2.0</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80 font-mono shadow-sm">
                  HiGHS Wasm
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 font-medium hidden sm:block">
                Seasonal-Demand &amp; Perishable-Ageing Mixed-Integer Optimization
              </p>
            </div>
          </div>

          {/* Engine Status Chip */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-slate-600 font-semibold hidden md:inline">Solver:</span>
              {solverAvailable === true ? (
                <div 
                  className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-soft-sm"
                  title="HiGHS WebAssembly client-side optimization engine is initialized and ready"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mr-2 flex-shrink-0" />
                  <span className="tabular-nums">WASM Ready (Offline)</span>
                </div>
              ) : solverAvailable === false ? (
                <div className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-rose-50 text-rose-800 border border-rose-200 shadow-soft-sm">
                  <AlertTriangle className="w-4 h-4 mr-1.5 text-rose-600" />
                  <span>Unavailable</span>
                </div>
              ) : (
                <div className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-soft-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 animate-ping mr-2" />
                  <span>Loading...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation Scrub Bar */}
        <nav 
          className="flex space-x-2 overflow-x-auto pb-3 pt-1 scrollbar-none"
          aria-label="Navigation Tabs"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as NavTab)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center space-x-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-soft whitespace-nowrap transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-soft-card text-teal-800 shadow-soft-md border border-teal-500/40 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-soft-card/80 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
