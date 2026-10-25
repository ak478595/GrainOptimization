# GrainOpt 2.0 — Project Specification

## Vision
GrainOpt 2.0 is a solver-backed web optimization platform demonstrating an advanced Mixed-Integer Linear Programming model for grain production planning under seasonal demand and perishable inventory constraints.

## Scientific Basis
- Inspired by: Bayá, G., Canale, E., Nesmachnow, S., Robledo, F., & Sartor, P. (2022). *Production Optimization in a Grain Facility through Mixed-Integer Linear Programming*. Applied Sciences, 12(16), 8212.
- Core formulation: Discrete weekly planning across 19 weeks, 17 products, and 2 production lines.

## Improvements Delivered
1. **Explicit Seasonal Demand**: Normalized agricultural cycle demand scenarios that preserve product demand totals.
2. **Expiry-Aware Inventory Tracking**: Age-indexed cohort tracking ($a \in \{0, 1, 2\}$) for inoculated products with explicit shelf-life limits, inventory conservation, and waste accounting.

## Explicit Exclusions
- No cleaning time, cleaning costs, or changeover sequencing.

