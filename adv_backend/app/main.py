from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
import osmnx as ox
import networkx as nx
from shapely.geometry import LineString, mapping

app = FastAPI(title="ADV Routing API (OSM)")

# Cache graphs per (place, mode) so repeated calls are fast
_graph_cache: dict[tuple[str, str], nx.MultiDiGraph] = {}

MODE_TO_NETWORK = {
    "walk":  "walk",   # pedestrian network
    "bike":  "bike",   # cycle-friendly network
    "drive": "drive",  # driving network
}

def get_graph(place: str, mode: str) -> nx.MultiDiGraph:
    key = (place, mode)
    if key not in _graph_cache:
        net = MODE_TO_NETWORK.get(mode, "bike")
        # download + simplify; add speeds and travel time attributes
        G = ox.graph_from_place(place, network_type=net, simplify=True)
        G = ox.add_edge_speeds(G)          # km/h
        G = ox.add_edge_travel_times(G)    # seconds
        _graph_cache[key] = G
    return _graph_cache[key]

def nearest_nodes(G: nx.MultiDiGraph, lat1: float, lon1: float, lat2: float, lon2: float):
    u = ox.distance.nearest_nodes(G, lon1, lat1)
    v = ox.distance.nearest_nodes(G, lon2, lat2)
    return u, v

def path_to_linestring(G: nx.MultiDiGraph, nodes: list[int]) -> LineString:
    coords = [(G.nodes[n]["x"], G.nodes[n]["y"]) for n in nodes]  # (lon, lat)
    return LineString(coords)

@app.get("/map/route")
def route(
    place: str = "Birmingham, UK",
    mode: str = "bike",
    start_lat: float = Query(...),
    start_lon: float = Query(...),
    end_lat: float = Query(...),
    end_lon: float = Query(...),
):
    """
    Return an OSM-based route (GeoJSON LineString) that follows roads/paths.
    drive -> shortest by travel_time; walk/bike -> shortest by length.
    """
    try:
        G = get_graph(place, mode)
        u, v = nearest_nodes(G, start_lat, start_lon, end_lat, end_lon)
        weight = "travel_time" if mode == "drive" else "length"
        route_nodes = nx.shortest_path(G, u, v, weight=weight)
        line = path_to_linestring(G, route_nodes)

        feature = {
            "type": "Feature",
            "properties": {
                "mode": mode,
                "strategy": weight,
                "length_m": round(line.length, 2),
            },
            "geometry": mapping(line),  # {"type":"LineString","coordinates":[(lon,lat),...]}
        }
        return JSONResponse({"type": "FeatureCollection", "features": [feature]})
    except Exception as e:
        # Surface a readable error in the PHP proxy / browser
        raise HTTPException(status_code=400, detail=str(e))
