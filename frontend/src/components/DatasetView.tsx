import React, { useState } from 'react';
import { DatasetInfo } from '../types/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Database, Filter, AlertCircle, Info } from './icons';

interface DatasetViewProps {
  dataset: DatasetInfo | null;
}

export const DatasetView: React.FC<DatasetViewProps> = ({ dataset }) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  if (!dataset) {
    return (
      <div className="p-8 text-center text-slate-400">
        Loading dataset metadata from backend...
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
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            Industrial Grain Facility Dataset
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Empirical demand, processing lines, and holding capacities from Bayá et al. (2022).
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <span className="text-slate-400">Total Horizon Demand: </span>
            <span className="font-bold text-emerald-400">{dataset.total_demand_tonnes.toLocaleString()} t</span>
          </div>
          <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <span className="text-slate-400">Active Lines: </span>
            <span className="font-bold text-emerald-400">2 Production Lines</span>
          </div>
        </div>
      </div>

      {/* Demand Bar Chart */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Aggregated Weekly Demand Profile</h3>
            <p className="text-xs text-slate-400">Treated (unlimited shelf-life) vs Inoculated (2-week perishable limit)</p>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-500 rounded-sm inline-block"></span> Inoculated
            <span className="w-3 h-3 bg-blue-500 rounded-sm inline-block ml-2"></span> Treated
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyDemandData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.5rem', color: '#f8fafc' }}
                formatter={(value: any) => [`${value} tonnes`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inoculated" fill="#10b981" name="Inoculated Demand (t)" stackId="a" />
              <Bar dataKey="treated" fill="#3b82f6" name="Treated Demand (t)" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Production Lines Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dataset.lines.map((line) => (
          <div key={line.id} className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white">{line.name}</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
                {line.hours_per_shift} hrs / shift
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs mb-4">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                <span className="text-slate-400 block">Reg. Hourly Cost</span>
                <span className="text-slate-200 font-bold">${line.regular_hourly_cost.toFixed(2)}/h</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                <span className="text-slate-400 block">OT Hourly Cost</span>
                <span className="text-slate-200 font-bold">${line.overtime_hourly_cost.toFixed(2)}/h</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                <span className="text-slate-400 block">Max Weekly Shifts</span>
                <span className="text-slate-200 font-bold">{line.max_shifts_per_week}</span>
              </div>
            </div>

            <div className="text-xs">
              <h4 className="font-semibold text-slate-300 mb-2">Throughput Capacities (Tonnes / Shift):</h4>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {Object.entries(line.rates).map(([prod, rate]) => (
                  <div key={prod} className="flex justify-between py-1 border-b border-slate-700/30 text-slate-400">
                    <span>{prod}</span>
                    <span className="font-mono text-slate-200">{rate} t/shift</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Table with Filters */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">SKU Inventory & Demand Breakdown</h3>
            <p className="text-xs text-slate-400">Total volume and holding parameters for all 17 facility products</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs"
              >
                <option value="ALL">All Types (17)</option>
                <option value="inoculated">Inoculated Only (7)</option>
                <option value="treated">Treated Only (10)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 uppercase text-[10px] text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Product Type</th>
                <th className="py-2.5 px-3">Shelf Life Rule</th>
                <th className="py-2.5 px-3 text-right">Holding Cost ($/t/wk)</th>
                <th className="py-2.5 px-3 text-right">Total Demand (t)</th>
                <th className="py-2.5 px-3 text-right">Horizon Share (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {productTotals
                .filter((p) => selectedType === 'ALL' || p.type === selectedType)
                .map((p) => (
                  <tr key={p.name} className="hover:bg-slate-700/20 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white">{p.name}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        p.type === 'inoculated' 
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800'
                          : 'bg-blue-950/70 text-blue-300 border border-blue-800'
                      }`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {p.type === 'inoculated' ? '2 Weeks Max (Age 0, 1, 2)' : 'Unlimited (Full Horizon)'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">${p.holding_cost.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-100">{p.totalDemand.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">{p.share}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
