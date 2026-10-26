import React from 'react';
import { MathFormula } from './MathFormula';
import { BookOpen, ShieldCheck, Layers, Cpu, CheckCircle2 } from './icons';

export const FormulationView: React.FC = () => {
  return (
    <div className="space-y-8 w-full max-w-full">
      {/* 1. Header Banner */}
      <div className="soft-card p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 shadow-soft-xs">
                <BookOpen className="w-6 h-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                MILP Mathematical Formulation Explorer
              </h1>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80 font-mono shadow-sm">
                Exact Mixed-Integer LP
              </span>
            </div>
            <p className="text-sm sm:text-base text-slate-600 mt-2.5 leading-relaxed max-w-4xl">
              Authoritative mathematical specification of indices, decision variables, domains, objective terms, and constraints.
              Direct algebraic equivalence to the HiGHS WebAssembly solver engine and the authoritative Python models.
            </p>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0 text-sm">
            <div className="soft-well px-4 py-2.5 rounded-xl border border-slate-200">
              <span className="text-slate-600 font-medium">Planning Horizon: </span>
              <span className="font-bold text-slate-900">19 Discrete Weeks</span>
            </div>
            <div className="soft-well px-4 py-2.5 rounded-xl border border-slate-200">
              <span className="text-slate-600 font-medium">SKUs Managed: </span>
              <span className="font-bold text-teal-800">17 Products</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Deliberate Scope Boundaries Callout */}
      <div className="soft-card p-6 border-l-4 border-l-teal-600 bg-teal-50/40 flex items-start gap-4">
        <span className="p-2 rounded-xl bg-teal-100 text-teal-800 mt-0.5 flex-shrink-0 shadow-soft-xs">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div className="text-sm sm:text-base text-slate-700 leading-relaxed">
          <span className="font-bold text-slate-900">Deliberate Scope Boundaries:</span> In accordance with the project requirements, cleaning times, cleaning costs, sequence-dependent changeovers, and setup penalties are <strong className="text-teal-900 font-bold">explicitly excluded</strong> from both models. Production line capacities are strictly governed by per-line weekly shift allocations and nominal continuous processing rates.
        </div>
      </div>

      {/* 3. Sets and Indices */}
      <div className="soft-card p-6 sm:p-8 space-y-5">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-teal-600"></span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              1. Sets and Indices
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Problem Geometry</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="soft-well p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block mb-1">Planning Horizon Weeks</span>
            <div className="my-2">
              <MathFormula math="s \in S = \{1, 2, \dots, 19\}" />
            </div>
            <p className="text-xs text-slate-600">19 discrete weekly production periods across the operational horizon.</p>
          </div>

          <div className="soft-well p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block mb-1">Processing Lines</span>
            <div className="my-2">
              <MathFormula math="l \in L = \{1, 2\}" />
            </div>
            <p className="text-xs text-slate-600">Two parallel lines with nominal throughput rates <MathFormula math="r_1 = 6.175" /> and <MathFormula math="r_2 = 6.650\text{ t/h}" />.</p>
          </div>

          <div className="soft-well p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block mb-1">Total Grain SKUs</span>
            <div className="my-2">
              <MathFormula math="v \in V = \{1, 2, \dots, 17\}" />
            </div>
            <p className="text-xs text-slate-600">Complete set of all 17 distinct facility products with total demand of 12,556.0 t.</p>
          </div>

          <div className="soft-well p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block mb-1">Perishable Inoculated Subset</span>
            <div className="my-2">
              <MathFormula math="V_{\text{inoc}} = \{1, \dots, 7\} \subset V" />
            </div>
            <p className="text-xs text-slate-600">7 perishable products strictly limited to a maximum 2-week shelf life.</p>
          </div>

          <div className="soft-well p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block mb-1">Non-Perishable Treated Subset</span>
            <div className="my-2">
              <MathFormula math="V_{\text{treat}} = \{8, \dots, 17\} \subset V" />
            </div>
            <p className="text-xs text-slate-600">10 stable products eligible for full-horizon warehouse storage.</p>
          </div>

          <div className="soft-well p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block mb-1">Cohort Age Index</span>
            <div className="my-2">
              <MathFormula math="a \in A = \{0, 1, 2\}" />
            </div>
            <p className="text-xs text-slate-600">Elapsed weeks since production: fresh (0), 1-week carryover (1), terminal expiry (2).</p>
          </div>
        </div>
      </div>

      {/* 4. Decision Variables & Domains */}
      <div className="soft-card p-6 sm:p-8 space-y-6">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-teal-600"></span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              2. Decision Variables and Mathematical Domains
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Continuity & Integrality</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* x_{v,l,s} */}
          <div className="soft-well p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Production Quantity</span>
                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">Continuous</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Product Batch Allocation</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Tonnes of product <MathFormula math="v" /> produced on line <MathFormula math="l" /> in week <MathFormula math="s" />.
              </p>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200 text-center">
              <MathFormula block math="x_{v,l,s} \ge 0 \quad (\text{tonnes})" />
              <span className="text-[11px] text-slate-500 block mt-1"><MathFormula math="\forall v \in V, l \in L, s \in S" /></span>
            </div>
          </div>

          {/* s_{l,s} */}
          <div className="soft-well p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Shift Allocation</span>
                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">Integer</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Crew Operating Shifts</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Total operating shifts scheduled on line <MathFormula math="l" /> during week <MathFormula math="s" />.
              </p>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200 text-center">
              <MathFormula block math="s_{l,s} \in \{0, 1, 2, 3\} \quad (\text{shifts})" />
              <span className="text-[11px] text-slate-500 block mt-1"><MathFormula math="\forall l \in L, s \in S" /></span>
            </div>
          </div>

          {/* I_{v,s,0} */}
          <div className="soft-well p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Fresh Inventory</span>
                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">Continuous</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Age 0 Closing Stock</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Closing inventory of inoculated product <MathFormula math="v" /> produced in week <MathFormula math="s" /> carried over to week <MathFormula math="s+1" />.
              </p>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200 text-center">
              <MathFormula block math="I_{v,s,0} \ge 0 \quad (\text{tonnes})" />
              <span className="text-[11px] text-slate-500 block mt-1"><MathFormula math="\forall v \in V_{\text{inoc}}, s \in S" /></span>
            </div>
          </div>

          {/* I_{v,s,1} */}
          <div className="soft-well p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Intermediate Stock</span>
                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">Continuous</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Age 1 Closing Stock</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Inventory held for exactly 1 week at the end of week <MathFormula math="s" />, eligible only in week <MathFormula math="s+1" /> before expiry.
              </p>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200 text-center">
              <MathFormula block math="I_{v,s,1} \ge 0 \quad (\text{tonnes})" />
              <span className="text-[11px] text-slate-500 block mt-1"><MathFormula math="\forall v \in V_{\text{inoc}}, s \in S" /></span>
            </div>
          </div>

          {/* u_{v,s,a} */}
          <div className="soft-well p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Cohort Consumption</span>
                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">Continuous</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Demand Withdrawal by Age</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Quantity of inoculated product <MathFormula math="v" /> of cohort age <MathFormula math="a" /> consumed to fulfill week <MathFormula math="s" /> demand.
              </p>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200 text-center">
              <MathFormula block math="u_{v,s,a} \ge 0 \quad (\text{tonnes})" />
              <span className="text-[11px] text-slate-500 block mt-1"><MathFormula math="\forall v \in V_{\text{inoc}}, s \in S, a \in \{0, 1, 2\}" /></span>
            </div>
          </div>

          {/* W_{v,s} */}
          <div className="soft-well p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Expired Spoilage</span>
                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">Continuous</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Terminal Waste Disposal</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Expired stock of product <MathFormula math="v" /> discarded at the end of week <MathFormula math="s" /> exceeding the 2-week shelf life limit.
              </p>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200 text-center">
              <MathFormula block math="W_{v,s} \ge 0 \quad (\text{tonnes})" />
              <span className="text-[11px] text-slate-500 block mt-1"><MathFormula math="\forall v \in V_{\text{inoc}}, s \in S" /></span>
            </div>
          </div>

          {/* I_{v,s}^{treat} */}
          <div className="soft-well p-5 rounded-2xl border border-slate-200 flex flex-col justify-between md:col-span-2 lg:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider block">Treated Non-Perishable Inventory</span>
                <h4 className="text-sm font-semibold text-slate-800 mt-0.5">Full-Horizon Warehouse Stock Balance</h4>
              </div>
              <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 self-start sm:self-auto">Continuous</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Closing inventory of treated product <MathFormula math="v \in V_{\text{treat}}" /> stored in silos at the end of week <MathFormula math="s" />. Non-perishable grain has unlimited shelf life across the 19-week horizon.
            </p>
            <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200 text-center">
              <MathFormula block math="I_{v,s}^{\text{treat}} \ge 0 \quad (\text{tonnes}) \qquad \forall v \in V_{\text{treat}}, s \in S" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Objective Function */}
      <div className="soft-card p-6 sm:p-8 space-y-6">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-teal-600"></span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              3. Total Facility Operating Cost Objective Function
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Exact HiGHS Objective</span>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed max-w-4xl">
          The optimization seeks to minimize total facility operational cost over the 19-week planning horizon. The objective function balances shift labour wages, throughput processing energy, and an explicit disposal penalty on expired perishable stock:
        </p>

        {/* Master Formula Card */}
        <div className="soft-well p-6 sm:p-8 rounded-2xl border border-slate-300 text-center overflow-x-auto shadow-soft-inner">
          <div className="text-xs font-bold uppercase tracking-wider text-teal-800 mb-3">Total Operational Cost Formula</div>
          <MathFormula
            block
            math="\min Z = \sum_{s \in S} \sum_{l \in L} c^{\text{labour}} s_{l,s} + \sum_{s \in S} \sum_{l \in L} \sum_{v \in V} \left( \frac{\kappa}{r_l} \right) x_{v,l,s} + \sum_{s \in S} \sum_{v \in V_{\text{inoc}}} p_{\text{waste}} W_{v,s}"
          />
        </div>

        {/* Parameter Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="soft-card p-5 border-l-4 border-l-teal-600 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Crew Labour Wage</span>
              <h4 className="text-base font-bold text-slate-900 mb-1.5"><MathFormula math="c^{\text{labour}} = \$1,000.00" /> / shift</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct labour cost allocated per operational crew shift on Line 1 and Line 2.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-mono text-slate-700">
              Term: <MathFormula math="\sum c^{\text{labour}} s_{l,s}" />
            </div>
          </div>

          <div className="soft-card p-5 border-l-4 border-l-sky-600 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Production Cost Coefficient</span>
              <h4 className="text-base font-bold text-slate-900 mb-1.5"><MathFormula math="\kappa = \$10.00" /> / tonne-hour</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Operating cost rate divided by nominal throughput rate: <MathFormula math="10.0 / 6.175 = \$1.6194\text{/t}" /> (Line 1) and <MathFormula math="10.0 / 6.650 = \$1.5038\text{/t}" /> (Line 2).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-mono text-slate-700">
              Term: <MathFormula math="\sum (\kappa / r_l) x_{v,l,s}" />
            </div>
          </div>

          <div className="soft-card p-5 border-l-4 border-l-rose-600 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Spoilage Disposal Penalty</span>
              <h4 className="text-base font-bold text-slate-900 mb-1.5"><MathFormula math="p_{\text{waste}} = \$10,000.00" /> / tonne</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Prohibitive disposal penalty on expired stock exceeding the 2-week shelf life limit to prevent silent stock degradation.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-mono text-slate-700">
              Term: <MathFormula math="\sum p_{\text{waste}} W_{v,s}" />
            </div>
          </div>
        </div>
      </div>

      {/* 6. Production Capacity Constraints Verification Card */}
      <div className="soft-card p-6 sm:p-8 space-y-5">
        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-teal-600"></span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              4. Facility Production Lines & Shift Throughput Limits
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Capacity Verification</span>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">
          Production capacity is bounded by available machine operating hours per shift (<MathFormula math="H = 41.25\text{ h/shift}" />, derived from <MathFormula math="7.5\text{ h/day} \times 5.5\text{ days/wk}" />) and scheduled integer shifts (<MathFormula math="s_{l,s} \in \{0, 1, 2, 3\}" />):
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line 1 Card */}
          <div className="soft-well p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-teal-900">Line 1 Capacity Formula</h3>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                Nominal Rate: 6.175 t/h
              </span>
            </div>
            <div className="bg-white/90 p-4 rounded-xl border border-slate-200 text-center overflow-x-auto">
              <MathFormula block math="\sum_{v \in V} x_{v,1,s} \le 254.72 \cdot s_{1,s} \qquad \forall s \in S" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Single Shift Throughput:</span>
                <span className="font-bold text-slate-900"><MathFormula math="6.175 \times 41.25 = 254.72\text{ t}" /></span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Max Weekly (3 Shifts):</span>
                <span className="font-bold text-slate-900"><MathFormula math="3 \times 254.71875 = 764.16\text{ t}" /></span>
              </div>
            </div>
          </div>

          {/* Line 2 Card */}
          <div className="soft-well p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-sky-900">Line 2 Capacity Formula</h3>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                Nominal Rate: 6.650 t/h
              </span>
            </div>
            <div className="bg-white/90 p-4 rounded-xl border border-slate-200 text-center overflow-x-auto">
              <MathFormula block math="\sum_{v \in V} x_{v,2,s} \le 274.31 \cdot s_{2,s} \qquad \forall s \in S" />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Single Shift Throughput:</span>
                <span className="font-bold text-slate-900"><MathFormula math="6.650 \times 41.25 = 274.31\text{ t}" /></span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Max Weekly (3 Shifts):</span>
                <span className="font-bold text-slate-900"><MathFormula math="3 \times 274.3125 = 822.94\text{ t}" /></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Comprehensive Model Constraints Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Baseline Formulation Column */}
        <div className="space-y-6">
          <div className="soft-card p-6 border-t-4 border-t-sky-600 space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-sky-600 shadow-soft-xs"></span>
              <h3 className="font-bold text-slate-900 text-xl tracking-tight">Baseline Model Formulation</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Faithful reproduction of Bayá et al. (2022). Employs rigid weekly Just-In-Time production for perishable items with zero allowable inventory carryover.
            </p>
          </div>

          {/* Baseline Card 1: Inoculated JIT Demand */}
          <div className="soft-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                1. Inoculated JIT Demand Constraint
              </h4>
              <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Weekly Strict JIT
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Inoculated demand in each week <MathFormula math="s" /> must be satisfied strictly from current-week production across both lines. Zero inventory carryover is permitted (<MathFormula math="I_{v,s} = 0" />).
            </p>
            <div className="soft-well p-4 rounded-xl border border-slate-200 text-center overflow-x-auto">
              <MathFormula block math="\sum_{l \in L} x_{v,l,s} \ge d_{v,s} \qquad \forall v \in V_{\text{inoc}}, s \in S" />
            </div>
          </div>

          {/* Baseline Card 2: Treated Cumulative Demand */}
          <div className="soft-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                2. Treated Cumulative Demand Satisfaction
              </h4>
              <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Non-Perishable
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Treated products have unlimited shelf life across the horizon. Cumulative production up to week <MathFormula math="s" /> must meet or exceed cumulative customer demand.
            </p>
            <div className="soft-well p-4 rounded-xl border border-slate-200 text-center overflow-x-auto">
              <MathFormula block math="\sum_{t=1}^{s} \sum_{l \in L} x_{v,l,t} \ge \sum_{t=1}^{s} d_{v,t} \qquad \forall v \in V_{\text{treat}}, s \in S" />
            </div>
          </div>

          {/* Baseline Card 3: Line Shift Capacity Limits */}
          <div className="soft-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                3. Production Line Shift Capacity Limits
              </h4>
              <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Throughput Bounds
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Total tonnage produced on line <MathFormula math="l" /> in week <MathFormula math="s" /> cannot exceed nominal rate multiplied by total shift hours.
            </p>
            <div className="soft-well p-4 rounded-xl border border-slate-200 text-center overflow-x-auto">
              <MathFormula block math="\sum_{v \in V} x_{v,l,s} \le r_l \cdot H \cdot s_{l,s} \qquad \forall l \in L, s \in S" />
            </div>
          </div>

          {/* Baseline Card 4: Facility Storage Capacity */}
          <div className="soft-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                4. Facility Storage Capacity Limit
              </h4>
              <span className="text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Warehouse Bounds
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Net accumulated physical inventory (total production minus total demand) across all products at the end of week <MathFormula math="s" /> cannot exceed total silo capacity (2,700 t).
            </p>
            <div className="soft-well p-4 rounded-xl border border-slate-200 text-center overflow-x-auto">
              <MathFormula block math="\sum_{t=1}^{s} \sum_{v \in V} \sum_{l \in L} x_{v,l,t} - \sum_{t=1}^{s} \sum_{v \in V} d_{v,t} \le 2,700\text{ t} \qquad \forall s \in S" />
            </div>
          </div>
        </div>

        {/* Expiry-Aware Formulation Column */}
        <div className="space-y-6">
          <div className="soft-card p-6 border-t-4 border-t-teal-600 space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-teal-600 shadow-soft-xs"></span>
              <h3 className="font-bold text-slate-900 text-xl tracking-tight">GrainOpt 2.0 (Expiry-Aware Cohorts)</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Enhanced cohort formulation enabling 2-week pre-building. Tracks perishable grain across discrete age cohorts with mathematical conservation and zero silent spoilage.
            </p>
          </div>

          {/* Expiry Card 1: Inoculated Cohort Conservation */}
          <div className="soft-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                1. Inoculated Cohort Flow & Inventory Balances
              </h4>
              <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Age Transitions
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Perishable inventory transitions week-by-week through age 0 (fresh), age 1 (1-week carryover), and terminal age 2 (demand or waste):
            </p>
            <div className="soft-well p-4 rounded-xl border border-slate-200 text-center overflow-x-auto space-y-2">
              <MathFormula block math="I_{v,s,0} = \sum_{l \in L} x_{v,l,s} - u_{v,s,0} \qquad (\text{Age 0 Flow})" />
              <MathFormula block math="I_{v,s,1} = I_{v,s-1,0} - u_{v,s,1} \quad (s \ge 2) \qquad (\text{Age 1 Flow})" />
              <MathFormula block math="u_{v,s,2} + W_{v,s} = I_{v,s-1,1} \quad (s \ge 3) \qquad (\text{Age 2 Expiry / Waste})" />
              <MathFormula block math="I_{v,s,2} = 0 \qquad (\text{Strict 2-Week Terminal Lifetime})" />
            </div>
          </div>

          {/* Expiry Card 2: Inoculated Demand Satisfaction */}
          <div className="soft-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                2. Inoculated Demand Satisfaction
              </h4>
              <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Unexpired Cohorts
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Weekly customer demand for perishable products is fulfilled from the sum of unexpired available cohorts (ages 0, 1, and 2):
            </p>
            <div className="soft-well p-4 rounded-xl border border-slate-200 text-center overflow-x-auto">
              <MathFormula block math="\sum_{a=0}^{2} u_{v,s,a} \ge d_{v,s} \qquad \forall v \in V_{\text{inoc}}, s \in S" />
            </div>
          </div>

          {/* Expiry Card 3: Treated Inventory Balance */}
          <div className="soft-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                3. Treated Inventory Balance
              </h4>
              <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Stable Stock
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Treated grain inventory carries over from week <MathFormula math="s-1" /> plus current production minus weekly shipments:
            </p>
            <div className="soft-well p-4 rounded-xl border border-slate-200 text-center overflow-x-auto">
              <MathFormula block math="I_{v,s}^{\text{treat}} = I_{v,s-1}^{\text{treat}} + \sum_{l \in L} x_{v,l,s} - d_{v,s} \qquad \forall v \in V_{\text{treat}}, s \in S" />
            </div>
          </div>

          {/* Expiry Card 4: End-of-Week Physical Warehouse Storage */}
          <div className="soft-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                4. End-of-Week Warehouse Storage Bounds
              </h4>
              <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Physical Silos
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Total physical inventory remaining in silos at the end of week <MathFormula math="s" /> (unexpired inoculated stock plus treated stock) cannot exceed 2,700 t:
            </p>
            <div className="soft-well p-4 rounded-xl border border-slate-200 text-center overflow-x-auto">
              <MathFormula block math="\sum_{v \in V_{\text{inoc}}} \left( I_{v,s,0} + I_{v,s,1} \right) + \sum_{v \in V_{\text{treat}}} I_{v,s}^{\text{treat}} \le 2,700\text{ t} \qquad \forall s \in S" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
