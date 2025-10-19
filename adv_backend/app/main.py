from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from typing import List, Tuple, Optional, Literal
import osmnx as ox
import networkx as nx
from shapely.geometry import LineString, mapping

app = FastAPI(title="ADV Routing API (OSM – analysis suite)")

# OSMnx settings
ox.settings.use_cache = True
ox.settings.timeout = 180  # seconds

MODE_TO_NETWORK = {"walk": "walk", "bike": "bike", "drive": "drive"}
BASE_SPEED = {"walk": 1.4, "bike": 4.5, "drive": 13.9}      # m/s
EMISSIONS_G_PER_KM = {"walk": 0.0, "bike": 0.0, "drive": 180.0}

def _bbox_from_points(lat1: float, lon1: float, lat2: float, lon2: float, pad=0.015):
    north = max(lat1, lat2) + pad
    south = min(lat1, lat2) - pad
    east  = max(lon1, lon2) + pad
    west  = min(lon1, lon2) - pad
    return north, south, east, west

def _graph_bbox(lat1: float, lon1: float, lat2: float, lon2: float, mode: str) -> nx.MultiDiGraph:
    """Build a small graph around the two points. OSMnx 2.x needs bbox=(w,s,e,n)."""
    net = MODE_TO_NETWORK.get(mode, "bike")
    n, s, e, w = _bbox_from_points(lat1, lon1, lat2, lon2, pad=0.015)
    bbox = (w, s, e, n)  # west, south, east, north
    G = ox.graph_from_bbox(bbox=bbox, network_type=net, simplify=True)
    G = ox.add_edge_speeds(G)
    G = ox.add_edge_travel_times(G)
    return G

def _nearest_node(G: nx.MultiDiGraph, lat: float, lon: float) -> int:
    return ox.distance.nearest_nodes(G, lon, lat)

def _line_from_nodes(G: nx.MultiDiGraph, nodes: List[int]) -> LineString:
    coords = [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in nodes]  # (lon, lat)
    return LineString(coords)

def _route_stats(G: nx.MultiDiGraph, nodes: List[int], mode: str) -> dict:
    length_m = 0.0
    travel_s = 0.0
    for u, v in zip(nodes[:-1], nodes[1:]):
        data = min(G.get_edge_data(u, v).values(), key=lambda d: d.get("length", 0))
        length_m += float(data.get("length", 0.0))
        travel_s += float(data.get("travel_time", 0.0))
    if travel_s <= 0:
        v = BASE_SPEED.get(mode, 4.0)  # m/s
        travel_s = length_m / max(v, 0.1)
    emissions_g = EMISSIONS_G_PER_KM.get(mode, 0.0) * (length_m / 1000.0)
    return {"length_m": round(length_m, 1), "travel_s": round(travel_s, 1), "emissions_g": round(emissions_g, 1)}

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/warm")
def warm(lat: float = 52.4862, lon: float = -1.8904, mode: Literal["walk","bike","drive"] = "bike"):
    _ = _graph_bbox(lat, lon, lat + 0.002, lon + 0.002, mode)
    return {"ok": True, "mode": mode}

def _parse_points(
    start: Optional[str], end: Optional[str],
    start_lat: Optional[float], start_lon: Optional[float],
    end_lat: Optional[float], end_lon: Optional[float],
):
    if start and end:
        s_lat, s_lon = map(float, start.split(","))
        e_lat, e_lon = map(float, end.split(","))
        return (s_lat, s_lon), (e_lat, e_lon)
    req = [start_lat, start_lon, end_lat, end_lon]
    if all(v is not None for v in req):
        return (float(start_lat), float(start_lon)), (float(end_lat), float(end_lon))
    raise HTTPException(status_code=400,
        detail="Provide either start/end='lat,lon' OR start_lat,start_lon,end_lat,end_lon")

@app.get("/map/route")
def route(
    place: str = "Birmingham, UK",
    mode: Literal["walk","bike","drive"] = "bike",
    start: Optional[str] = Query(None, description="'lat,lon'"),
    end:   Optional[str] = Query(None, description="'lat,lon'"),
    start_lat: Optional[float] = Query(None),
    start_lon: Optional[float] = Query(None),
    end_lat:   Optional[float] = Query(None),
    end_lon:   Optional[float] = Query(None),
):
    try:
        (s_lat, s_lon), (e_lat, e_lon) = _parse_points(start, end, start_lat, start_lon, end_lat, end_lon)
        G = _graph_bbox(s_lat, s_lon, e_lat, e_lon, mode)
        u = _nearest_node(G, s_lat, s_lon)
        v = _nearest_node(G, e_lat, e_lon)
        weight = "travel_time" if mode == "drive" else "length"
        nodes = nx.shortest_path(G, u, v, weight=weight)
        line = _line_from_nodes(G, nodes)
        stats = _route_stats(G, nodes, mode)
        feature = {
            "type": "Feature",
            "properties": {"mode": mode, "strategy": weight, **stats, "place": place},
            "geometry": mapping(line),
        }
        return JSONResponse({"type": "FeatureCollection", "features": [feature]})
    except nx.NetworkXNoPath:
        raise HTTPException(status_code=400, detail="No path found in bbox; move markers closer or increase padding.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{type(e).__name__}: {e}")

@app.post("/export/csv", response_class=PlainTextResponse)
def export_csv(mode: str, length_m: float, travel_s: float, emissions_g: float):
    km = length_m / 1000.0
    mins = travel_s / 60.0
    return "mode,length_km,travel_min,emissions_g\n" + f"{mode},{km:.3f},{mins:.1f},{emissions_g:.1f}\n"
