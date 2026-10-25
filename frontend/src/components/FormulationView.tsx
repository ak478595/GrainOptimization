import React from 'react';
import { MathFormula } from './MathFormula';
import { BookOpen, AlertOctagon, CheckCircle2, ShieldCheck, HelpCircle } from './icons';

export const FormulationView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-400" />
          Mathematical Formulation Explorer
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Detailed algebraic specification of sets, parameters, decision variables, and constraints for Baseline vs Expiry-Aware models.
        </p>
      </div>

      {/* Exclusions Box */}
      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <span className="font-semibold text-white">Deliberate Scope Boundaries:</span> In accordance with the project requirements, cleaning time, cleaning costs, sequence-dependent changeovers, and setup penalties are <strong className="text-emerald-400">explicitly excluded</strong> from this formulation. Production capacity is strictly bounded by per-line weekly shift limitations.
        </div>
      </div>

      {/* Sets and Indices */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
        <h3 className="text-base font-semibold text-white border-b border-slate-700/50 pb-2">1. Sets and Indices</h3>
        <ul className="text-xs text-slate-300 space-y-2">
          <li><MathFormula math="S = \{1, 2, \dots, 19\}" />: Planning weeks in horizon.</li>
          <li><MathFormula math="L = \{1, 2\}" />: Production lines (Line 1, Line 2).</li>
          <li><MathFormula math="V" />: Set of all 17 grain products.</li>
          <li><MathFormula math="V_{\text{inoc}} \subset V" />: Subset of 7 inoculated products subject to 2-week shelf life.</li>
          <li><MathFormula math="V_{\text{treat}} \subset V" />: Subset of 10 treated products with non-perishable horizon storage.</li>
          <li><MathFormula math="A = \{0, 1, 2\}" />: Age cohorts for inoculated inventory (weeks elapsed since production).</li>
        </ul>
      </div>

      {/* Decision Variables */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
        <h3 className="text-base font-semibold text-white border-b border-slate-700/50 pb-2">2. Decision Variables</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div>
            <span className="font-semibold text-emerald-400">Continuous Production & Inventory:</span>
            <ul className="mt-1 space-y-1.5">
              <li><MathFormula math="x_{v,l,s} \ge 0" />: Tonnes of product <MathFormula math="v" /> produced on line <MathFormula math="l" /> in week <MathFormula math="s" />.</li>
              <li><MathFormula math="I_{v,s} \ge 0" />: Closing inventory of product <MathFormula math="v" /> at end of week <MathFormula math="s" />.</li>
              <li><MathFormula math="I_{v,s,a} \ge 0" />: Closing inventory of inoculated product <MathFormula math="v" /> at age cohort <MathFormula math="a \in \{0, 1, 2\}" />.</li>
              <li><MathFormula math="u_{v,s,a} \ge 0" />: Demand consumed in week <MathFormula math="s" /> from cohort age <MathFormula math="a" />.</li>
              <li><MathFormula math="W_{v,s} \ge 0" />: Spoiled / expired stock of product <MathFormula math="v" /> discarded at end of week <MathFormula math="s" />.</li>
            </ul>
          </div>
          <div>
            <span className="font-semibold text-blue-400">Integer Shift Allocations:</span>
            <ul className="mt-1 space-y-1.5">
              <li><MathFormula math="y_{l,s}^{\text{reg}} \in \{0, 1, 2\}" />: Regular integer shifts scheduled on line <MathFormula math="l" /> in week <MathFormula math="s" />.</li>
              <li><MathFormula math="y_{l,s}^{\text{ot}} \in \{0, 1\}" />: Overtime integer shifts scheduled on line <MathFormula math="l" /> in week <MathFormula math="s" />.</li>
              <li><MathFormula math="y_{l,s} = y_{l,s}^{\text{reg}} + y_{l,s}^{\text{ot}}" />: Total shifts scheduled on line <MathFormula math="l" /> in week <MathFormula math="s" />.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Objective Function */}
      <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
        <h3 className="text-base font-semibold text-white border-b border-slate-700/50 pb-2">3. Objective Function</h3>
        <p className="text-xs text-slate-300">
          Minimize total facility operational cost, encompassing regular shifts, overtime shifts, weekly holding costs, and a high penalty on wasted stock:
        </p>
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50 text-center">
          <MathFormula
            block
            math="\min Z = \sum_{s \in S} \sum_{l \in L} \left( c_l^{\text{reg}} H_l y_{l,s}^{\text{reg}} + c_l^{\text{ot}} H_l y_{l,s}^{\text{ot}} \right) + \sum_{s \in S} \sum_{v \in V} h_v I_{v,s} + \sum_{s \in S} \sum_{v \in V_{\text{inoc}}} p_{\text{waste}} W_{v,s}"
          />
        </div>
        <p className="text-[11px] text-slate-400">
          Where <MathFormula math="c_l^{\text{reg}} = 38.64" />, <MathFormula math="c_l^{\text{ot}} = 66.82" />, <MathFormula math="H_l = 8" /> hours/shift, and <MathFormula math="p_{\text{waste}} = 1000" /> $/tonne.
        </p>
      </div>

      {/* Core Improvements Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baseline Formulation */}
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
            <h4 className="font-bold text-white text-sm">Baseline Model (Rigid JIT)</h4>
          </div>
          <p className="text-xs text-slate-400">
            Enforces strict instantaneous weekly demand satisfaction with zero inventory carryover permitted for inoculated products:
          </p>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/50">
            <MathFormula block math="\sum_{l \in L} x_{v,l,s} \ge d_{v,s}, \quad \forall v \in V_{\text{inoc}}, s \in S" />
            <MathFormula block math="I_{v,s} = 0, \quad \forall v \in V_{\text{inoc}}, s \in S" />
          </div>
          <p className="text-[11px] text-slate-400">
            <strong>Limitation:</strong> Inoculated production cannot be pre-built in slack weeks, forcing expensive overtime shifts during demand spikes.
          </p>
        </div>

        {/* Expiry-Aware Formulation */}
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <h4 className="font-bold text-white text-sm">GrainOpt 2.0 (Expiry-Aware Cohorts)</h4>
          </div>
          <p className="text-xs text-slate-400">
            Tracks age transitions across cohorts <MathFormula math="a \in \{0, 1, 2\}" /> ensuring perishable grain expires strictly after 2 weeks:
          </p>
          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700/50">
            <MathFormula block math="I_{v,s,0} = \sum_{l \in L} x_{v,l,s} - u_{v,s,0}" />
            <MathFormula block math="I_{v,s,1} = I_{v,s-1,0} - u_{v,s,1}" />
            <MathFormula block math="u_{v,s,2} + W_{v,s} = I_{v,s-1,1}" />
            <MathFormula block math="I_{v,s,2} = 0" />
            <MathFormula block math="\sum_{a \in \{0,1,2\}} u_{v,s,a} = d_{v,s}" />
          </div>
          <p className="text-[11px] text-slate-400">
            <strong>Benefit:</strong> Allows pre-building up to 2 weeks in advance while guaranteeing no expired stock satisfies customer demand.
          </p>
        </div>
      </div>
    </div>
  );
};
