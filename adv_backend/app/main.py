from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from typing import List, Tuple, Optional, Literal, Dict
import os, requests
import osmnx as ox
import networkx as nx
from shapely.geometry import LineString, mapping

app = FastAPI(title="ADV Routing API (Traffic + OSM)")

ox.settings.use_cache = True
ox.settings.timeout = 300
MODE_TO_NETWORK = {"walk": "walk", "bike": "bike", "drive": "drive"}
BASE_SPEED = {"walk": 1.4, "bike": 4.5, "drive": 13.9}
EMISSIONS_G_PER_KM = {"walk": 0.0, "bike": 0.0, "drive": 180.0}
TOMTOM_KEY = os.getenv("TOMTOM_API_KEY", "")

def _bbox_from_points(lat1: float, lon1: float, lat2: float, lon2: float, pad=0.015):
    north = max(lat1, lat2) + pad
    south = min(lat1, lat2) - pad
    east  = max(lon1, lon2) + pad
    west  = min(lon1, lon2) - pad
    return north, south, east, west

def _graph_bbox(lat1: float, lon1: float, lat2: float, lon2: float, mode: str) -> nx.MultiDiGraph:
    net = MODE_TO_NETWORK.get(mode, "bike")
    n, s, e, w = _bbox_from_points(lat1, lon1, lat2, lon2, pad=0.020)
    bbox = (w, s, e, n)
    G = ox.graph_from_bbox(bbox=bbox, network_type=net, simplify=True)
    G = ox.add_edge_speeds(G)
    G = ox.add_edge_travel_times(G)
    return G

def _nearest_node(G: nx.MultiDiGraph, lat: float, lon: float) -> int:
    return ox.distance.nearest_nodes(G, lon, lat)

def _line_from_nodes(G: nx.MultiDiGraph, nodes: List[int]) -> LineString:
    coords = []
    for u, v in zip(nodes[:-1], nodes[1:]):
        data_dict = G.get_edge_data(u, v)
        if not data_dict:
            seg = [(G.nodes[u]["x"], G.nodes[u]["y"]), (G.nodes[v]["x"], G.nodes[v]["y"])]
            coords += seg if not coords or coords[-1] != seg[0] else seg[1:]
            continue
        data = min(data_dict.values(), key=lambda d: d.get("length", 0) or 0)
        geom = data.get("geometry")
        if geom is not None:
            seg = list(geom.coords)
        else:
            seg = [(G.nodes[u]["x"], G.nodes[u]["y"]), (G.nodes[v]["x"], G.nodes[v]["y"])]
        coords += seg if not coords or coords[-1] != seg[0] else seg[1:]
    return LineString(coords)

def _route_stats(G: nx.MultiDiGraph, nodes: List[int], mode: str) -> dict:
    length_m = 0.0
    travel_s = 0.0
    for u, v in zip(nodes[:-1], nodes[1:]):
        data = min(G.get_edge_data(u, v).values(), key=lambda d: d.get("length", 0))
        length_m += float(data.get("length", 0.0))
        travel_s += float(data.get("travel_time", 0.0))
    if travel_s <= 0:
        v = BASE_SPEED.get(mode, 4.0)
        travel_s = length_m / max(v, 0.1)
    emissions_g = EMISSIONS_G_PER_KM.get(mode, 0.0) * (length_m / 1000.0)
    return {"length_m": round(length_m, 1), "travel_s": round(travel_s, 1), "emissions_g": round(emissions_g, 1)}

def _parse_points(start: Optional[str], end: Optional[str],
                  start_lat: Optional[float], start_lon: Optional[float],
                  end_lat: Optional[float], end_lon: Optional[float]) -> Tuple[Tuple[float,float], Tuple[float,float]]:
    def parse_pair(s: str) -> Tuple[float,float]:
        a, b = s.split(","); return float(a.strip()), float(b.strip())
    if start and end:
        s_lat, s_lon = parse_pair(start); e_lat, e_lon = parse_pair(end)
    elif None not in (start_lat, start_lon, end_lat, end_lon):
        s_lat, s_lon = float(start_lat), float(start_lon); e_lat, e_lon = float(end_lat), float(end_lon)
    else:
        raise HTTPException(status_code=400, detail="Provide start/end as 'lat,lon' or separate *_lat/_lon.")
    return (s_lat, s_lon), (e_lat, e_lon)

def _route_tomtom(start_lat: float, start_lon: float, end_lat: float, end_lon: float) -> Dict:
    if not TOMTOM_KEY:
        raise HTTPException(status_code=400, detail="TOMTOM_API_KEY not set in environment.")
    base = "https://api.tomtom.com/routing/1/calculateRoute"
    path = f"{start_lat},{start_lon}:{end_lat},{end_lon}/json"
    params = {
        "key": TOMTOM_KEY,
        "traffic": "true",
        "computeBestOrder": "false",
        "routeType": "fastest",
        "travelMode": "car",
        "sectionType": "traffic",
        "computeTravelTimeFor": "all",
        "geometries": "geoJson",
    }
    url = f"{base}/{path}"
    r = requests.get(url, params=params, timeout=25)
    if r.status_code != 200:
        raise HTTPException(status_code=400, detail=f"TomTom error {r.status_code}: {r.text[:200]}")
    data = r.json()
    try:
        route = data["routes"][0]
        summary = route["summary"]
        travel_s = float(summary.get("travelTimeInSeconds", summary.get("travelTime", 0)))
        length_m = float(summary.get("lengthInMeters", 0))
        coords = []
        geom_top = route.get("geometry")
        if isinstance(geom_top, dict) and geom_top.get("type") == "LineString":
            coords = geom_top.get("coordinates") or []
        if not coords:
            for leg in route.get("legs", []):
                geo = leg.get("points", {}).get("geoJson") if isinstance(leg.get("points"), dict) else None
                if isinstance(geo, dict) and geo.get("type") == "LineString":
                    coords = geo.get("coordinates") or []
                    break
            if not coords:
                for leg in route.get("legs", []):
                    pts = leg.get("points", [])
                    if isinstance(pts, list) and pts and isinstance(pts[0], dict):
                        coords += [[p.get("longitude"), p.get("latitude")] for p in pts if "longitude" in p and "latitude" in p]
        if not coords:
            raise KeyError("No coordinates from TomTom geometry")
        line = {"type":"LineString", "coordinates": coords}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"TomTom parse error: {type(e).__name__}: {e}")
    emissions_g = EMISSIONS_G_PER_KM["drive"] * (length_m/1000.0)
    props = {"mode":"drive","source":"tomtom","strategy":"traffic_fastest","length_m":round(length_m,1),"travel_s":round(travel_s,1),"emissions_g":round(emissions_g,1)}
    feat = {"type":"Feature","properties":props,"geometry":line}
    return {"type":"FeatureCollection","features":[feat]}

@app.get("/")
def root():
    return {"ok": True, "msg": "FastAPI up"}

@app.get("/health")
def health():
    return {"ok": True}

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
    traffic: bool = Query(False, description="Use live traffic (TomTom) when mode=drive"),
):
    try:
        (s_lat, s_lon), (e_lat, e_lon) = _parse_points(start, end, start_lat, start_lon, end_lat, end_lon)
        if mode == "drive" and traffic:
            return JSONResponse(_route_tomtom(s_lat, s_lon, e_lat, e_lon))
        G = _graph_bbox(s_lat, s_lon, e_lat, e_lon, mode)
        u = _nearest_node(G, s_lat, s_lon); v = _nearest_node(G, e_lat, e_lon)
        weight = "travel_time" if mode == "drive" else "length"
        nodes = nx.shortest_path(G, u, v, weight=weight)
        line = _line_from_nodes(G, nodes)
        stats = _route_stats(G, nodes, mode)
        feature = {"type": "Feature","properties": {"mode": mode, "strategy": weight, **stats, "place": place},"geometry": mapping(line)}
        return JSONResponse({"type": "FeatureCollection", "features": [feature]})
    except nx.NetworkXNoPath:
        raise HTTPException(status_code=400, detail="No path found in bbox; move markers closer or increase padding.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"{type(e).__name__}: {e}")

@app.get("/map/compare")
def compare_modes(place: str = "Birmingham, UK", start: str = Query(...), end: str = Query(...)):
    (s_lat, s_lon), (e_lat, e_lon) = _parse_points(start, end, None, None, None, None)
    features = []
    for mode in ["walk", "bike", "drive"]:
        try:
            G = _graph_bbox(s_lat, s_lon, e_lat, e_lon, mode)
            u = _nearest_node(G, s_lat, s_lon); v = _nearest_node(G, e_lat, e_lon)
            weight = "travel_time" if mode == "drive" else "length"
            nodes = nx.shortest_path(G, u, v, weight=weight)
            line = _line_from_nodes(G, nodes)
            stats = _route_stats(G, nodes, mode)
            features.append({"type":"Feature","properties":{"mode": mode, "strategy": weight, **stats, "place": place},"geometry": mapping(line)})
        except Exception:
            continue
    if not features:
        raise HTTPException(status_code=400, detail="No routes for any mode.")
    return JSONResponse({"type": "FeatureCollection", "features": features})

@app.post("/export/csv", response_class=PlainTextResponse)
def export_csv(mode: str, length_m: float, travel_s: float, emissions_g: float):
    km = length_m / 1000.0; mins = travel_s / 60.0
    return "mode,length_km,travel_min,emissions_g\n" + f"{mode},{km:.3f},{mins:.1f},{emissions_g:.1f}\n"

@app.post("/traffic/route-color")
def route_color(payload: dict):
    if not TOMTOM_KEY:
        raise HTTPException(status_code=400, detail="TOMTOM_API_KEY not set in environment.")
    coords = payload.get("coords")
    if not coords or not isinstance(coords, list) or len(coords) < 2:
        raise HTTPException(status_code=400, detail="coords must be an array of [lon,lat] length>=2.")
    colors = []
    for i in range(len(coords)-1):
        x1, y1 = coords[i]; x2, y2 = coords[i+1]
        mid_lat = (y1 + y2) / 2.0; mid_lon = (x1 + x2) / 2.0
        try:
            url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json"
            params = {"key": TOMTOM_KEY, "point": f"{mid_lat},{mid_lon}"}
            r = requests.get(url, params=params, timeout=8)
            if r.status_code != 200: colors.append("gray"); continue
            data = r.json(); fs = data.get("flowSegmentData", {})
            ratio = None
            if fs.get("freeFlowSpeed"):
                ratio = float(fs.get("currentSpeed", 0.0)) / float(fs.get("freeFlowSpeed", 1.0))
            elif "relativeSpeed" in fs:
                ratio = float(fs["relativeSpeed"])
            elif fs.get("currentTravelTime") and fs.get("freeFlowTravelTime"):
                ratio = float(fs["freeFlowTravelTime"]) / float(fs["currentTravelTime"])
            if ratio is None: colors.append("gray"); continue
            if ratio >= 0.85: colors.append("green")
            elif ratio >= 0.6: colors.append("yellow")
            else: colors.append("red")
        except Exception:
            colors.append("gray")
    return {"colors": colors}
