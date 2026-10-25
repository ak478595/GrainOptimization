"""
Dataset Loader for GrainOpt 2.0.
Reads Demand_Wide, Product_Details, and Facility_Parameters from Excel
and validates all structural dimensions against verified project specifications.
"""

from pathlib import Path
from typing import Dict, List, Tuple
import openpyxl


class FacilityData:
    def __init__(self, excel_path: Path):
        self.excel_path = Path(excel_path)
        if not self.excel_path.exists():
            raise FileNotFoundError(f"Dataset not found at: {self.excel_path}")

        self.products: List[int] = list(range(1, 18))
        self.lines: List[int] = [1, 2]
        self.weeks: List[int] = list(range(1, 20))
        self.inoculated_products: List[int] = list(range(1, 8))
        self.treated_products: List[int] = list(range(8, 18))

        # Default facility parameters
        self.capacity: Dict[int, float] = {1: 6.175, 2: 6.650}
        self.shift_hours: float = 7.5
        self.working_days: float = 5.5
        self.hours_per_shift: float = self.shift_hours * self.working_days  # 41.25 hours
        self.max_shifts_per_line_week: int = 3
        self.storage_capacity: float = 2700.0
        self.labour_cost_per_shift: float = 1000.0
        self.production_cost_coefficient: float = 10.0
        self.shelf_life_weeks: int = 2

        self.demand: Dict[Tuple[int, int], float] = {}  # (product, week) -> demand_tonnes
        self.product_totals: Dict[int, float] = {}
        self.weekly_totals: Dict[int, float] = {}

        self._load_and_validate()

    def _load_and_validate(self):
        wb = openpyxl.load_workbook(self.excel_path, data_only=True)

        # Validate sheet existence
        required_sheets = ["Demand_Wide", "Product_Details", "Facility_Parameters"]
        for s in required_sheets:
            if s not in wb.sheetnames:
                raise ValueError(f"Missing required sheet '{s}' in dataset.")

        # 1. Load Facility_Parameters
        ws_params = wb["Facility_Parameters"]
        params_dict = {}
        for row in ws_params.iter_rows(min_row=2, values_only=True):
            if row and row[0] is not None:
                params_dict[str(row[0]).strip().lower()] = row[1]

        # Check line capacities
        if "production-line 1 capacity" in params_dict:
            self.capacity[1] = float(params_dict["production-line 1 capacity"])
        if "production-line 2 capacity" in params_dict:
            self.capacity[2] = float(params_dict["production-line 2 capacity"])
        if "total storage capacity" in params_dict:
            self.storage_capacity = float(params_dict["total storage capacity"])
        if "maximum operator shifts per week" in params_dict:
            self.max_shifts_per_line_week = int(params_dict["maximum operator shifts per week"])
        if "effective weekday shift duration" in params_dict:
            self.shift_hours = float(params_dict["effective weekday shift duration"])
            self.hours_per_shift = self.shift_hours * self.working_days

        # 2. Load Product_Details
        ws_prod = wb["Product_Details"]
        inoc_list = []
        treat_list = []
        for row in ws_prod.iter_rows(min_row=2, values_only=True):
            if row and row[0] is not None:
                p_id = int(row[0])
                p_class = str(row[1]).strip().lower()
                if p_class == "inoculated":
                    inoc_list.append(p_id)
                elif p_class == "treated":
                    treat_list.append(p_id)
        if len(inoc_list) != 7 or len(treat_list) != 10:
            raise ValueError(f"Expected 7 inoculated and 10 treated products, got {len(inoc_list)} and {len(treat_list)}")

        # 3. Load Demand_Wide
        ws_demand = wb["Demand_Wide"]
        header = [cell for cell in next(ws_demand.iter_rows(min_row=1, max_row=1, values_only=True))]
        col_to_product = {}
        for col_idx, col_name in enumerate(header):
            if col_name and str(col_name).startswith("product_"):
                p_id = int(str(col_name).replace("product_", ""))
                col_to_product[col_idx] = p_id

        for row in ws_demand.iter_rows(min_row=2, values_only=True):
            if not row or row[0] is None:
                continue
            week = int(row[0])
            for col_idx, p_id in col_to_product.items():
                val = float(row[col_idx] or 0.0)
                self.demand[(p_id, week)] = val

        # Validate total demand
        for p in self.products:
            self.product_totals[p] = sum(self.demand.get((p, w), 0.0) for w in self.weeks)
        for w in self.weeks:
            self.weekly_totals[w] = sum(self.demand.get((p, w), 0.0) for p in self.products)

        total_demand = sum(self.product_totals.values())
        if abs(total_demand - 12556.0) > 1e-4:
            raise ValueError(f"Total demand must equal 12,556.0 tonnes, got {total_demand}")

    def get_demand_copy(self) -> Dict[Tuple[int, int], float]:
        return dict(self.demand)

