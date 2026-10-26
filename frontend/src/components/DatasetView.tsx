import React, { useState } from 'react';
import { DatasetInfo } from '../types/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Database, Filter } from './icons';

interface DatasetViewProps {
  dataset: DatasetInfo | null;
}

export const DatasetView: React.FC<DatasetViewProps> = ({ dataset }) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  if (!dataset) {
    return (
      <div className="soft-card p-12 text-center text-slate-600 font-semibold text-base">
        Loading dataset metadata from browser storage...
      </div>
    );
  }

  // Filter products
  const filteredProducts = dataset.products.filter((p) => {
    if (selectedType !== 'ALL' && p.type !== selectedType) return false;
    if (selectedProduct !== 'ALL' && p.name !== selectedProduct) return false;
    return true;
  });

  // Demand distribution by week
  const weeklyDemandData = dataset.weeks.map((w) => {
    let inoculatedDemand = 0;
    let treatedDemand = 0;

    dataset.products.forEach((p) => {
      const val = dataset.demands[p.name]?.[String(w)] || 0;
      if (p.type === 'inoculated') inoculatedDemand += val;
      else treatedDemand += val;
    });

    return {
      week: `W${w}`,
      inoculated: Math.round(inoculatedDemand * 10) / 10,
      treated: Math.round(treatedDemand * 10) / 10,
      total: Math.round((inoculatedDemand + treatedDemand) * 10) / 10,
    };
  });

  // Calculate totals per product
  const productTotals = dataset.products.map((p) => {
    const total = dataset.weeks.reduce((sum, w) => sum + (dataset.demands[p.name]?.[String(w)] || 0), 0);
    return {
      name: p.name,
      type: p.type,
      holding_cost: p.holding_cost,
      totalDemand: Math.round(total * 10) / 10,
      share: ((total / dataset.total_demand_tonnes) * 100).toFixed(1),
    };
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="soft-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 shadow-soft-xs">
              <Database className="w-5 h-5" />
            </span>
            Industrial Grain Facility Dataset
          </h2>
          <p className="text-sm text-slate-600 mt-1.5 ml-1">
            Empirical demand, dual processing lines, and holding capacities from Bayá et al. (2022).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="soft-well px-4 py-2 rounded-xl border border-slate-200">
            <span className="text-slate-600 font-semibold">Horizon Demand: </span>
            <span className="font-bold text-teal-800 tabular-nums">{dataset.total_demand_tonnes.toLocaleString()} t</span>
          </div>
          <div className="soft-well px-4 py-2 rounded-xl border border-slate-200">
            <span className="text-slate-600 font-semibold">Active Processing: </span>
            <span className="font-bold text-slate-800">2 Dual Lines</span>
          </div>
        </div>
      </div>

      {/* Demand Bar Chart */}
      <div className="soft-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Aggregated Weekly Demand Profile</h3>
            <p className="text-sm text-slate-600 mt-0.5">Treated (unlimited shelf-life) vs Inoculated (2-week perishable limit)</p>
          </div>
          <div className="text-xs sm:text-sm text-slate-700 flex items-center gap-4 bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-200">
            <span className="flex items-center gap-2 font-semibold">
              <span className="w-3 h-3 bg-teal-700 rounded-sm inline-block shadow-soft-xs"></span> Inoculated
            </span>
            <span className="flex items-center gap-2 font-semibold">
              <span className="w-3 h-3 bg-sky-700 rounded-sm inline-block shadow-soft-xs"></span> Treated
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyDemandData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                formatter={(value: any) => [`${value} tonnes`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
              <Bar dataKey="inoculated" fill="#0D9488" name="Inoculated Demand (t)" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="treated" fill="#0284C7" name="Treated Demand (t)" stackId="a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Production Lines Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dataset.lines.map((line) => (
          <div key={line.id} className="soft-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">{line.name}</h3>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 shadow-soft-xs">
                  {line.hours_per_shift} hrs / shift
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs sm:text-sm mb-4">
                <div className="soft-well p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Reg. Hourly</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">${line.regular_hourly_cost.toFixed(2)}/h</span>
                </div>
                <div className="soft-well p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-0.5">OT Hourly</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">${line.overtime_hourly_cost.toFixed(2)}/h</span>
                </div>
                <div className="soft-well p-3 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-0.5">Max Weekly</span>
                  <span className="text-sm font-bold text-teal-800 tabular-nums">{line.max_shifts_per_week} shifts</span>
                </div>
              </div>

              <div className="text-sm">
                <h4 className="font-bold text-slate-800 mb-2 tracking-tight">Throughput Capacities (Tonnes / Shift):</h4>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 soft-well p-3 rounded-xl border border-slate-200">
                  {Object.entries(line.rates).map(([prod, rate]) => (
                    <div key={prod} className="flex justify-between items-center py-1 border-b border-slate-200 last:border-0 text-slate-700">
                      <span className="font-semibold text-slate-800">{prod}</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">{rate} t/shift</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Table with Filters */}
      <div className="soft-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">SKU Inventory & Demand Breakdown</h3>
            <p className="text-sm text-slate-600 mt-0.5">Total volume and holding parameters for all 17 facility products</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Filter className="w-4 h-4 text-slate-600" />
              <label htmlFor="sku-type-filter" className="sr-only">Filter SKU Type</label>
              <select
                id="sku-type-filter"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="soft-well border border-slate-200 rounded-xl px-3.5 py-1.5 text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
              >
                <option value="ALL">All Types (17)</option>
                <option value="inoculated">Inoculated Only (7)</option>
                <option value="treated">Treated Only (10)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-soft-xs">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 uppercase text-xs font-bold text-slate-700 border-b border-slate-200 tracking-wider">
              <tr>
                <th scope="col" className="py-3.5 px-4 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0]">Product Name</th>
                <th scope="col" className="py-3.5 px-4">Product Type</th>
                <th scope="col" className="py-3.5 px-4">Shelf Life Rule</th>
                <th scope="col" className="py-3.5 px-4 text-right">Holding Cost ($/t/wk)</th>
                <th scope="col" className="py-3.5 px-4 text-right">Total Demand (t)</th>
                <th scope="col" className="py-3.5 px-4 text-right">Horizon Share (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {productTotals
                .filter((p) => selectedType === 'ALL' || p.type === selectedType)
                .map((p) => (
                  <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 sticky left-0 bg-white hover:bg-slate-50 z-10 shadow-[1px_0_0_0_#E2E8F0]">
                      {p.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        p.type === 'inoculated' 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-sky-50 text-sky-800 border border-sky-200'
                      }`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {p.type === 'inoculated' ? '2 Weeks Max (Age 0, 1, 2)' : 'Unlimited (Full Horizon)'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800 tabular-nums">${p.holding_cost.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">{p.totalDemand.toFixed(1)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600 font-medium tabular-nums">{p.share}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
