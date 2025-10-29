import os, math, requests
from typing import Dict, Tuple, List

TOMTOM_KEY = os.environ.get("TOMTOM_KEY", "").strip()

def _emissions_g(mode: str, km: float) -> float:
    if mode == "drive": return km * 170.0
    if mode == "bike":  return 0.0
    if mode == "walk":  return 0.0
    return 0.0

def _haversine_km(a: Tuple[float,float], b: Tuple[float,float]) -> float:
    (lat1, lon1), (lat2, lon2) = a, b
    R = 6371.0088
    dphi = math.radians(lat2-lat1)
    dl   = math.radians(lon2-lon1)
    phi1 = math.radians(lat1); phi2 = math.radians(lat2)
    t = (math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dl/2)**2)
    return 2*R*math.asin(math.sqrt(t))

def _route_osrm(mode: str, a: Tuple[float,float], b: Tuple[float,float]) -> Dict:
    profile = {"drive":"driving","bike":"cycling","walk":"walking"}.get(mode, "driving")
    url = f"https://router.project-osrm.org/route/v1/{profile}/{a[1]},{a[0]};{b[1]},{b[0]}?overview=full&geometries=geojson"
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    j = r.json()
    route = j["routes"][0]
    dist_m = float(route["distance"])
    dur_s  = float(route["duration"])
    km = dist_m/1000.0
    return {
        "distance_m": dist_m,
        "travel_s": dur_s,
        "emissions_g": _emissions_g(mode, km),
        "geometry": route["geometry"]["coordinates"],
    }

def _route_tomtom(mode: str, a: Tuple[float,float], b: Tuple[float,float], traffic: bool) -> Dict:
    mm = {"drive":"car","bike":"bicycle","walk":"pedestrian"}.get(mode, "car")
    start = f"{a[0]},{a[1]}"
    end   = f"{b[0]},{b[1]}"
    params = {
        "key": TOMTOM_KEY,
        "traffic": "true" if traffic and mm=="car" else "false",
        "routeType": "fastest",
        "travelMode": mm,
    }
    url = f"https://api.tomtom.com/routing/1/calculateRoute/{start}:{end}/json"
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    j = r.json()
    s = j["routes"][0]["summary"]
    dist_m = float(s["lengthInMeters"])
    dur_s  = float(s["travelTimeInSeconds"])
    points = j["routes"][0]["legs"][0]["points"]
    coords = [[p["longitude"], p["latitude"]] for p in points]
    km = dist_m/1000.0
    return {
        "distance_m": dist_m,
        "travel_s": dur_s,
        "emissions_g": _emissions_g(mode, km),
        "geometry": coords,
    }

def route(mode: str, start: Tuple[float,float], end: Tuple[float,float], traffic: bool) -> Dict:
    try:
        if TOMTOM_KEY:
            return _route_tomtom(mode, start, end, traffic)
        else:
            return _route_osrm(mode, start, end)
    except Exception:
        km = _haversine_km(start, end)
        mins = (km / 30.0) * 60.0
        return {
            "distance_m": km*1000.0,
            "travel_s": mins*60.0,
            "emissions_g": _emissions_g(mode, km),
            "geometry": [[start[1], start[0]], [end[1], end[0]]],
        }

def compare(start: Tuple[float,float], end: Tuple[float,float]) -> List[Dict]:
    feats = []
    for m in ["walk","bike","drive"]:
        r = route(m, start, end, traffic=True if m=="drive" else False)
        feats.append({"mode": m, **r})
    return feats
