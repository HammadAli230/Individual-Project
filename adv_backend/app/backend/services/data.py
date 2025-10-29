import os
import pandas as pd
import geopandas as gpd

DATA_ROOT = os.environ.get(
    "ADV_DATA_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/uk"))
)

def zones_gdf() -> gpd.GeoDataFrame:
    path = os.path.join(DATA_ROOT, "zones_uk.parquet")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing {path}. Run data_pipeline scripts first.")
    gdf = gpd.read_parquet(path)
    return gdf.set_crs(4326)

def demand_df() -> pd.DataFrame:
    path = os.path.join(DATA_ROOT, "demand_uk.parquet")
    if not os.path.exists(path):
        from .demand import get_demand_index
        df = get_demand_index()
        df.to_parquet(path, index=False)
        return df
    return pd.read_parquet(path)

def features_df() -> pd.DataFrame:
    path = os.path.join(DATA_ROOT, "features_uk.parquet")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing {path}. Run data_pipeline scripts first.")
    return pd.read_parquet(path)

def candidates_depots():
    import geopandas as gpd
    path = os.path.join(DATA_ROOT, "candidates_depots_uk.geojson")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing {path}. Run 04_generate_candidates.py first.")
    return gpd.read_file(path).set_crs(4326)

def candidates_chargers():
    import geopandas as gpd
    path = os.path.join(DATA_ROOT, "candidates_chargers_uk.geojson")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing {path}. Run 04_generate_candidates.py first.")
    return gpd.read_file(path).set_crs(4326)

def haversine_km(a, b) -> float:
    import math
    lat1, lon1 = a.y, a.x
    lat2, lon2 = b.y, b.x
    R = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dl = math.radians(lon2 - lon1)
    t = (math.sin(dphi/2)**2 +
         math.cos(phi1)*math.cos(phi2)*math.sin(dl/2)**2)
    return 2*R*math.asin(math.sqrt(t))
