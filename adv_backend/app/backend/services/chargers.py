import geopandas as gpd
from typing import Optional, Set, List
from .data import zones_gdf, candidates_chargers, demand_df, haversine_km

def greedy_max_coverage(M: int, R_km: float, region: Optional[str]=None) -> gpd.GeoDataFrame:
    Z = zones_gdf().merge(demand_df()[['zone_id','demand_idx']], on='zone_id', how='left').fillna({'demand_idx':0})
    C = candidates_chargers()

    if region:
        Z = Z[Z['lad_name'].astype(str).str.contains(region, case=False, na=False) | Z['lad_code'].astype(str).str.contains(region, case=False, na=False)]
        C = C[C['lad_name'].astype(str).str.contains(region, case=False, na=False) | C['lad_code'].astype(str).str.contains(region, case=False, na=False)]

    Z = Z.reset_index(drop=True)
    C = C.reset_index(drop=True)

    covered_by_c: List[set] = []
    Zc = Z.geometry.centroid.to_list()
    Cg = C.geometry.to_list()
    for cg in Cg:
        S = {i for i, zg in enumerate(Zc) if haversine_km(zg, cg) <= R_km}
        covered_by_c.append(S)

    chosen, covered = [], set()
    for _ in range(min(M, len(C))):
        best_j, best_gain = None, -1.0
        for j in range(len(C)):
            if j in chosen: 
                continue
            newly = [i for i in covered_by_c[j] if i not in covered]
            gain = float(Z.loc[newly, 'demand_idx'].sum())
            if gain > best_gain:
                best_gain, best_j = gain, j
        if best_j is None:
            break
        chosen.append(best_j)
        covered.update(covered_by_c[best_j])

    C['chosen'] = False
    C.loc[chosen, 'chosen'] = True
    return C[['site_id','lad_code','lad_name','geometry','chosen']]
