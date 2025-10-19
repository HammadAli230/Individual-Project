from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from typing import List, Tuple
import osmnx as ox
import networkx as nx
from shapely.geometry import LineString, mapping

app = FastAPI(title="ADV Routing API (OSM – analysis suite)")

# OSMnx performance
ox.settings.use_cache = True
ox.settings.timeout = 180  # seconds

MODE_TO_NETWORK = {"walk": "walk", "bike": "bike", "drive": "drive"}

# Base speeds (m/s) – fallback if a segment has no travel_time
BASE_SPEED = {"walk": 1.4, "bike": 4.5, "drive": 13.9}  # ~5 km/h, 16 km/h, 50 km/h

# Very rough emissions gCO2e/km (for demo comparisons)
EMISSIONS_G_PER_KM = {"walk": 0.0, "bike": 0.0, "drive": 180.0}

def _bbox_from_points(lat1: float, lon1: float, lat2: float, lon2: float, pad=0.01):
    north = max(lat1, lat2) + pad
    south = min(lat1, lat2) - pad
    east  = max(lon1, lon2) + pad
    west  = min(lon1, lon2) - pad
    return north, south, east, west

def _graph_bbox(lat1: float, lon1: float, lat2: float, lon2: float, mode: str) -> nx.MultiDiGraph:
    """Small, fast graph around this segment to avoid timeouts."""
    net = MODE_TO_NETWORK.get(mode, "bike")
    n, s, e, w = _bbox_from_points(lat1, lon1, lat2, lon2, pad=0.01)
    G = ox.graph_from_bbox(n, s, e, w, network_type=net, simplify=True)
    G = ox.add_edge_speeds(G)          # km/h
    G = ox.add_edge_travel_times(G)    # seconds
    return G

def _nearest_node(G: nx.MultiDiGraph, lat: float, lon: float) -> int:
    return ox.distance.nearest_nodes(G, lon, lat)

def _line_from_nodes(G: nx.MultiDiGraph, nodes: List[int]) -> LineString:
    coords = [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in nodes]  # (lon, lat)
    return LineString(coords)

def _route_stats(G: nx.MultiDiGraph, nodes: List[int], mode: str) -> dict:
    """Length (m), travel time (s), emissions (g)."""
    length_attr_m = 0.0
    travel_s = 0.0
    for u, v in zip(nodes[:-1], nodes[1:]):
        # choose the shortest parallel edge
        data = min(G.get_edge_data(u, v).values(), key=lambda d: d.get("length", 0))
        length_attr_m += float(data.get("length", 0.0))
        travel_s      += float(data.get("travel_time", 0.0))
    if travel_s <= 0:
        v = BASE_SPEED.get(mode, 4.0)  # m/s
        travel_s = length_attr_m / max(v, 0.1)
    emissions_g = EMISSIONS_G_PER_KM.get(mode, 0.0) * (length_attr_m / 1000.0)
    return {
        "length_m": round(length_attr_m, 1),
        "travel_s": round(travel_s, 1),
        "emissions_g": round(emissions_g, 1),
    }

@app.get("/warm")
def warm(lat: float = 52.4862, lon: float = -1.8904, mode: str = "bike"):
    _ = _graph_bbox(lat, lon, lat + 0.002, lon + 0.002, mode)
    return {"ok": True, "mode": mode}

@app.get("/map/route")
def route(
    place: str = "Birmingham, UK",   # kept for UI, not used by bbox method
    mode: str = "bike",
    start_lat: float = Query(...),
    start_lon: float = Query(...),
    end_lat: float = Query(...),
    end_lon: float = Query(...),
):
    """Single route following roads/paths."""
    try:
        G = _graph_bbox(start_lat, start_lon, end_lat, end_lon, mode)
        u = _nearest_node(G, start_lat, start_lon)
        v = _nearest_node(G, end_lat, end_lon)
        weight = "travel_time" if mode == "drive" else "length"
        nodes = nx.shortest_path(G, u, v, weight=weight)
        line = _line_from_nodes(G, nodes)
        stats = _route_stats(G, nodes, mode)
        feature = {
            "type": "Feature",
            "properties": {"mode": mode, "strategy": weight, **stats},
            "geometry": mapping(line),
        }
        return JSONResponse({"type": "FeatureCollection", "features": [feature]})
    except nx.NetworkXNoPath:
        raise HTTPException(status_code=400, detail="No path found in bbox; move markers closer or increase padding.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/map/compare")
def compare_modes(
    start_lat: float = Query(...), start_lon: float = Query(...),
    end_lat: float = Query(...),   end_lon: float = Query(...),
    modes: str = "walk,bike,drive"
):
    """Compare walk/bike/drive for the same segment."""
    out = []
    for mode in [m.strip() for m in modes.split(",") if m.strip()]:
        try:
            G = _graph_bbox(start_lat, start_lon, end_lat, end_lon, mode)
            u = _nearest_node(G, start_lat, start_lon)
            v = _nearest_node(G, end_lat, end_lon)
            weight = "travel_time" if mode == "drive" else "length"
            nodes = nx.shortest_path(G, u, v, weight=weight)
            line = _line_from_nodes(G, nodes)
            stats = _route_stats(G, nodes, mode)
            out.append({
                "type": "Feature",
                "properties": {"mode": mode, "strategy": weight, **stats},
                "geometry": mapping(line),
            })
        except Exception as e:
            out.append({"type": "Feature", "properties": {"mode": mode, "error": str(e)}, "geometry": None})
    return JSONResponse({"type": "FeatureCollection", "features": out})

@app.get("/map/route_multi")
def route_multi(
    mode: str = "bike",
    stops: str = Query(..., description="Semicolon-separated lat,lon pairs. e.g. '52.48,-1.9;52.49,-1.88;52.50,-1.86'")
):
    """Multi-stop route using a greedy nearest-neighbour heuristic."""
    pts: List[Tuple[float, float]] = []
    for s in stops.split(";"):
        s = s.strip()
        if not s: 
            continue
        lat, lon = map(float, s.split(","))
        pts.append((lat, lon))
    if len(pts) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 stops.")

    # Build one bbox for all stops
    lats = [p[0] for p in pts]; lons = [p[1] for p in pts]
    n, s, e, w = max(lats)+0.02, min(lats)-0.02, max(lons)+0.02, min(lons)-0.02
    G = ox.graph_from_bbox(n, s, e, w, network_type=MODE_TO_NETWORK.get(mode, "bike"), simplify=True)
    G = ox.add_edge_speeds(G); G = ox.add_edge_travel_times(G)

    node_pts = [_nearest_node(G, lat, lon) for lat, lon in pts]

    # Greedy order (fast)
    order = [0]
    remaining = set(range(1, len(node_pts)))
    while remaining:
        last = node_pts[order[-1]]
        nxt = min(
            remaining, 
            key=lambda i: ox.distance.euclidean_dist_vec(
                G.nodes[last]["y"], G.nodes[last]["x"],
                G.nodes[node_pts[i]]["y"], G.nodes[node_pts[i]]["x"]
            )
        )
        order.append(nxt)
        remaining.remove(nxt)

    weight = "travel_time" if mode == "drive" else "length"
    all_nodes: List[int] = []
    totals = {"length_m": 0.0, "travel_s": 0.0, "emissions_g": 0.0}
    for i in range(len(order)-1):
        a = node_pts[order[i]]
        b = node_pts[order[i+1]]
        path = nx.shortest_path(G, a, b, weight=weight)
        if i == 0: all_nodes.extend(path)
        else:      all_nodes.extend(path[1:])
        seg = _route_stats(G, path, mode)
        for k in totals: totals[k] += seg[k]

    line = _line_from_nodes(G, all_nodes)
    feature = {
        "type": "Feature",
        "properties": {"mode": mode, "strategy": weight, **{k: round(v,1) for k,v in totals.items()}, "stops_order": order},
        "geometry": mapping(line),
    }
    return JSONResponse({"type": "FeatureCollection", "features": [feature]})

@app.post("/export/csv", response_class=PlainTextResponse)
def export_csv(mode: str, length_m: float, travel_s: float, emissions_g: float):
    """Simple one-row CSV for downloads from the UI."""
    km = length_m / 1000.0
    min_ = travel_s / 60.0
    header = "mode,length_km,travel_min,emissions_g\n"
    row = f"{mode},{km:.3f},{min_:.1f},{emissions_g:.1f}\n"
    return header + row

