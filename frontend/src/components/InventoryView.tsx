import React, { useState } from 'react';
import { SolveResponse, DatasetInfo } from '../types/api';
import { Package, ShieldAlert, CheckCircle2, Clock, Info } from './icons';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface InventoryViewProps {
  solution: SolveResponse | null;
  dataset: DatasetInfo | null;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ solution, dataset }) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('P1');

  if (!solution || !dataset) {
    return (
      <div className="soft-card p-12 text-center text-slate-600 font-semibold text-base">
        Run the optimization from the Overview tab to view inventory ageing and expiry metrics.
      </div>
    );
  }

  const weeks = Array.from({ length: 19 }, (_, i) => i + 1);
  const inoculatedProducts = dataset.products.filter((p) => p.type === 'inoculated');

  // Chart data for selected inoculated product cohort evolution
  const cohortChartData = weeks.map((w) => {
    const age0 = solution.cohort_inventory?.[selectedProduct]?.[String(w)]?.['0'] || 0;
    const age1 = solution.cohort_inventory?.[selectedProduct]?.[String(w)]?.['1'] || 0;
    const age2 = solution.cohort_inventory?.[selectedProduct]?.[String(w)]?.['2'] || 0; // always 0 by conservation
    const waste = solution.waste_by_week?.[selectedProduct]?.[String(w)] || 0;

    return {
      week: `W${w}`,
      'Age 0 (Fresh)': Math.round(age0 * 10) / 10,
      'Age 1 (1 Wk Old)': Math.round(age1 * 10) / 10,
      'Age 2 (Terminal)': Math.round(age2 * 10) / 10,
      'Waste Expired': Math.round(waste * 10) / 10,
      total: Math.round((age0 + age1) * 10) / 10,
    };
  });

  // Calculate total end-of-horizon metrics
  const totalWaste = solution.expiry_waste_total;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="soft-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 shadow-soft-xs">
              <Package className="w-5 h-5" />
            </span>
            Inventory Ageing & Expiry Waste Tracking
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 ml-1">
            Explicit tracking of perishable inoculated cohorts across allowed 2-week shelf life (ages 0, 1, 2) with zero unrecorded spoilage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="soft-well px-4 py-2.5 rounded-xl border border-slate-200 text-sm flex items-center gap-2.5">
            {totalWaste === null ? (
              <>
                <Info className="w-4 h-4 text-slate-500" />
                <span className="text-slate-700 font-semibold">Total Horizon Waste:</span>
                <span className="font-bold text-slate-700 italic">Not modelled (Baseline JIT)</span>
              </>
            ) : (
              <>
                <CheckCircle2 className={`w-4 h-4 ${totalWaste === 0 ? 'text-emerald-700' : 'text-rose-700'}`} />
                <span className="text-slate-700 font-semibold">Total Horizon Waste:</span>
                <span className={`font-bold font-mono tabular-nums ${totalWaste === 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {totalWaste.toFixed(3)} t
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cohort Ageing Rules Infobox */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="soft-card p-5 border-l-4 border-l-emerald-600">
          <div className="font-bold text-emerald-900 flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-emerald-700" />
            Age 0: Fresh Production
          </div>
          <p className="text-slate-700 leading-relaxed">
            Stock produced in week <span className="font-mono font-bold text-slate-900">s</span>. Can satisfy current week demand immediately. Any unconsumed stock transitions to Age 1 at week <span className="font-mono font-bold text-slate-900">s+1</span>.
          </p>
        </div>

        <div className="soft-card p-5 border-l-4 border-l-amber-500">
          <div className="font-bold text-amber-900 flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-700" />
            Age 1: Intermediate Carryover
          </div>
          <p className="text-slate-700 leading-relaxed">
            Stock held for 1 week. Can satisfy week <span className="font-mono font-bold text-slate-900">s</span> demand. Any unconsumed carryover transitions to Age 2 for its final eligible week.
          </p>
        </div>

        <div className="soft-card p-5 border-l-4 border-l-rose-500">
          <div className="font-bold text-rose-900 flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-rose-700" />
            Age 2: Terminal Eligibility & Waste
          </div>
          <p className="text-slate-700 leading-relaxed">
            Final eligible week <span className="font-mono font-bold text-slate-900">s+2</span>. Must satisfy demand or be explicitly discarded as waste <span className="font-mono font-bold text-slate-900">W(v,s)</span>. End-of-week <span className="font-mono font-bold text-slate-900">I(v,s,2) = 0</span>.
          </p>
        </div>
      </div>

      {/* Cohort Visualizer */}
      <div className="soft-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Cohort Ageing Evolution: {selectedProduct}</h3>
            <p className="text-sm text-slate-600 mt-0.5">Inventory volume held in storage categorized by age cohort</p>
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <span className="text-slate-700 font-semibold">Select Inoculated SKU:</span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="soft-well border border-slate-200 rounded-xl px-3.5 py-1.5 text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
            >
              {inoculatedProducts.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cohortChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAge0" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#0D9488" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorAge1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" opacity={0.6} />
              <XAxis dataKey="week" stroke="#475569" fontSize={12} tickLine={false} />
              <YAxis stroke="#475569" fontSize={12} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  borderColor: '#CBD5E1', 
                  borderRadius: '0.75rem', 
                  boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.1)',
                  color: '#0F172A',
                  fontSize: '12px',
                  fontWeight: 600
                }}
                formatter={(val: any) => [`${val} tonnes`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
              <Area type="monotone" dataKey="Age 0 (Fresh)" stroke="#0D9488" fillOpacity={1} fill="url(#colorAge0)" stackId="1" />
              <Area type="monotone" dataKey="Age 1 (1 Wk Old)" stroke="#F59E0B" fillOpacity={1} fill="url(#colorAge1)" stackId="1" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full Inventory Table */}
      <div className="soft-card p-6">
        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Weekly Closing Inventory Matrix (All SKUs)</h3>
          <p className="text-sm text-slate-600 mt-0.5">Total physical stock carried into next week (Tonnes). Treated grain has full horizon eligibility; inoculated grain obeys 2-week cohort bounds.</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-soft-xs">
          <table className="w-full text-right text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-700 border-b border-slate-200 tracking-wider">
              <tr>
                <th scope="col" className="py-3.5 px-4 text-left sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0]">Product</th>
                <th scope="col" className="py-3.5 px-3 text-left">Type</th>
                {weeks.map((w) => (
                  <th key={w} scope="col" className="py-3.5 px-2.5">W{w}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {dataset.products.map((prod) => (
                <tr key={prod.name} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-left font-bold text-slate-900 whitespace-nowrap sticky left-0 bg-white hover:bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0]">
                    {prod.name}
                  </td>
                  <td className="py-3 px-3 text-left">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      prod.type === 'inoculated' 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                        : 'bg-sky-50 text-sky-800 border border-sky-200'
                    }`}>
                      {prod.type}
                    </span>
                  </td>
                  {weeks.map((w) => {
                    const inv = solution.inventory[prod.name]?.[String(w)] || 0;
                    return (
                      <td key={w} className={`py-2.5 px-2.5 font-mono tabular-nums ${inv > 0.1 ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                        {inv > 0.1 ? inv.toFixed(1) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
