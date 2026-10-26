import React, { useEffect, useState } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { DatasetView } from './components/DatasetView';
import { ScheduleView } from './components/ScheduleView';
import { InventoryView } from './components/InventoryView';
import { ComparisonView } from './components/ComparisonView';
import { FormulationView } from './components/FormulationView';
import { ValidationView } from './components/ValidationView';
import { DatasetInfo, SolveRequest, SolveResponse } from './types/api';
import { checkHealth, fetchDataset, solveModel } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [solverAvailable, setSolverAvailable] = useState<boolean | null>(null);
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [currentSolution, setCurrentSolution] = useState<SolveResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize data on mount
  useEffect(() => {
    async function init() {
      try {
        const health = await checkHealth();
        setSolverAvailable(health.solver_available);
      } catch (e: any) {
        console.warn('Health check error:', e);
        setSolverAvailable(false);
      }

      try {
        const data = await fetchDataset();
        setDataset(data);
      } catch (e: any) {
        console.warn('Dataset load error:', e);
        setError('Could not load facility dataset.');
      }
    }
    init();
  }, []);

  // Handle run solve
  const handleSolve = async (req: SolveRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await solveModel(req);
      setCurrentSolution(res);
    } catch (err: any) {
      setError(err.message || 'Failed to solve model');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-soft-base text-soft-text-primary flex flex-col selection:bg-brand-500/20 selection:text-brand-800 transition-colors">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        solverAvailable={solverAvailable} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            dataset={dataset}
            currentSolution={currentSolution}
            onSolve={handleSolve}
            isLoading={isLoading}
            error={error}
          />
        )}

        {activeTab === 'dataset' && (
          <DatasetView dataset={dataset} />
        )}

        {activeTab === 'schedule' && (
          <ScheduleView solution={currentSolution} dataset={dataset} />
        )}

        {activeTab === 'inventory' && (
          <InventoryView solution={currentSolution} dataset={dataset} />
        )}

        {activeTab === 'comparison' && (
          <ComparisonView />
        )}

        {activeTab === 'formulation' && (
          <FormulationView />
        )}

        {activeTab === 'validation' && (
          <ValidationView solution={currentSolution} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-soft-border/70 bg-soft-card/50 py-5 text-center text-xs text-soft-text-muted">
        GrainOpt 2.0 &bull; Operations Research &amp; MILP Optimization Platform &bull; HiGHS WebAssembly + React + Vite &bull; Standalone Edition
      </footer>
    </div>
  );
}

export default App;

