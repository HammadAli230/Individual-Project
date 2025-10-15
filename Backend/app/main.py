from fastapi import FastAPI, Query
import osmnx as ox, networkx as nx

app = FastAPI()

def load_graph(place: str, mode: str):
    nt = {"drive":"drive","bike":"bike","walk":"walk"}[mode]
    G = ox.graph_from_place(place, network_type=nt, simplify=True)
    G = ox.add_edge_speeds(G, fallback= {"drive":25,"bike":15,"walk":4}[mode])
    G = ox.add_edge_travel_times(G)
    return G

@app.get("/map/route")
def route(place: str, mode: str="bike",
          start_lat: float = Query(...), start_lon: float = Query(...),
          end_lat: float = Query(...),   end_lon: float = Query(...)):
    G = load_graph(place, mode)
    u = ox.distance.nearest_nodes(G, start_lon, start_lat)
    v = ox.distance.nearest_nodes(G, end_lon, end_lat)
    path = nx.shortest_path(G, u, v, weight="travel_time")
    nodes, edges = ox.graph_to_gdfs(G)
    coords = []
    for a, b in zip(path[:-1], path[1:]):
        row = edges.xs((a,b), level=[0,1]).iloc[0] if (a,b) in edges.index else edges.loc[(a,b,0)]
        xs, ys = row.geometry.xy
        coords += list(zip(xs, ys))
    return {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"mode":mode},"geometry":{"type":"LineString","coordinates":coords}}]}
