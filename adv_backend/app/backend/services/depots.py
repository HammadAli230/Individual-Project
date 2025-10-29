import numpy as np
import geopandas as gpd
from typing import Optional
from ortools.linear_solver import pywraplp
from .data import zones_gdf, candidates_depots, demand_df, haversine_km

def solve_p_median(p: int, region: Optional[str]=None, max_cands_per_region: int=50) -> gpd.GeoDataFrame:
    Z = zones_gdf().copy()
    D = demand_df()
    Z = Z.merge(D[['zone_id','demand_idx']], on='zone_id', how='left').fillna({'demand_idx':0})
    C = candidates_depots().copy()

    if region:
        cond_z = Z['lad_name'].astype(str).str.contains(region, case=False, na=False) | Z['lad_code'].astype(str).str.contains(region, case=False, na=False)
        cond_c = C['lad_name'].astype(str).str.contains(region, case=False, na=False) | C['lad_code'].astype(str).str.contains(region, case=False, na=False)
        Z = Z[cond_z]
        C = C[cond_c]

    if 'lad_code' in C.columns:
        C = (C.groupby('lad_code', group_keys=False).head(max_cands_per_region).reset_index(drop=True))

    n, m = len(Z), len(C)
    if m == 0 or n == 0:
        return C.assign(chosen=False)
    if p > m:
        p = m

    road_factor = 1.35
    Zi = Z.geometry.centroid.to_list()
    Cj = C.geometry.to_list()
    cost = np.zeros((n, m), dtype=float)
    for i, gi in enumerate(Zi):
        for j, gj in enumerate(Cj):
            cost[i, j] = road_factor * haversine_km(gi, gj)

    w = Z['demand_idx'].to_numpy() + 1e-6

    solver = pywraplp.Solver.CreateSolver("CBC")
    x = {(i,j): solver.BoolVar(f"x_{i}_{j}") for i in range(n) for j in range(m)}
    y = {j: solver.BoolVar(f"y_{j}") for j in range(m)}

    solver.Minimize(solver.Sum(w[i]*cost[i,j]*x[(i,j)] for i in range(n) for j in range(m)))

    for i in range(n):
        solver.Add(solver.Sum(x[(i,j)] for j in range(m)) == 1)
        for j in range(m):
            solver.Add(x[(i,j)] <= y[j])

    solver.Add(solver.Sum(y[j] for j in range(m)) == p)

    status = solver.Solve()
    if status != pywraplp.Solver.OPTIMAL:
        return C.assign(chosen=False)

    chosen = [j for j in range(m) if y[j].solution_value() > 0.5]
    C['chosen'] = False
    C.loc[chosen, 'chosen'] = True
    return C[['site_id','lad_code','lad_name','geometry','chosen']]