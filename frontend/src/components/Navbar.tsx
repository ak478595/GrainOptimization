import React from 'react';
import { 
  Activity, 
  Database, 
  Calendar, 
  Package, 
  Layers, 
  GitCompare, 
  BookOpen, 
  CheckCircle2,
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
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-xl font-bold text-white tracking-wider">G2</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white">GrainOpt 2.0</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">
                  MILP Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">Seasonal-Demand & Perishable-Ageing Optimization</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">CBC Solver Status:</span>
              {solverAvailable === true ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                  Ready (Win64)
                </span>
              ) : solverAvailable === false ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-900/50 text-rose-300 border border-rose-700/50">
                  <AlertTriangle className="w-3 h-3 mr-1 text-rose-400" />
                  Unavailable
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400">
                  Connecting...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as NavTab)}
                className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
