
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from typing import Optional
import orjson
import geopandas as gpd

from services.data import zones_gdf
from services.demand import get_demand_index
from services.depots import solve_p_median
from services.chargers import greedy_max_coverage
from services.routing import solve_cvrp
from models.types import DepotSolveRequest, ChargerSolveRequest, RouteSolveRequest

class ORJSONResponse(JSONResponse):
    media_type = "application/json"
    def render(self, content) -> bytes:
        return orjson.dumps(content)

app = FastAPI(title="ADV UK Planning API", default_response_class=ORJSONResponse)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/zones")
def zones(region: Optional[str] = Query(default=None)):
    Z = zones_gdf()
    if region:
        Z = Z[
            Z['lad_name'].astype(str).str.contains(region, case=False, na=False) |
            Z['lad_code'].astype(str).str.contains(region, case=False, na=False)
        ]
    return orjson.loads(Z.to_json())

@app.get("/demand")
def demand(region: Optional[str] = Query(default=None)):
    D = get_demand_index()
    Z = zones_gdf()[['zone_id','geometry']]
    G = Z.merge(D, on='zone_id', how='left')
    if region and 'name' in G.columns:
        G = G[
            G['name'].astype(str).str.contains(region, case=False, na=False) |
            G['zone_id'].astype(str).str.contains(region, case=False, na=False)
        ]
    return orjson.loads(gpd.GeoDataFrame(G, geometry='geometry', crs=4326).to_json())

@app.post("/depots")
def depots(req: DepotSolveRequest):
    G = solve_p_median(p=req.p, region=req.region, max_cands_per_region=req.max_candidates_per_region)
    return orjson.loads(gpd.GeoDataFrame(G, geometry='geometry', crs=4326).to_json())

@app.post("/chargers")
def chargers(req: ChargerSolveRequest):
    G = greedy_max_coverage(M=req.M, R_km=req.R_km, region=req.region)
    return orjson.loads(gpd.GeoDataFrame(G, geometry='geometry', crs=4326).to_json())

@app.post("/routes")
def routes(req: RouteSolveRequest):
    return solve_cvrp(region=req.region, n_orders=req.n_orders, n_vehicles=req.n_vehicles,
                      vehicle_capacity=req.vehicle_capacity, max_route_minutes=req.max_route_minutes)
