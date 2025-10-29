from pydantic import BaseModel
from typing import Optional

class DepotSolveRequest(BaseModel):
    p: int
    region: Optional[str] = None
    max_candidates_per_region: int = 50

class ChargerSolveRequest(BaseModel):
    M: int
    R_km: float = 5.0
    region: Optional[str] = None

class RouteSolveRequest(BaseModel):
    region: str
    n_orders: int = 150
    n_vehicles: int = 10
    vehicle_capacity: int = 25
    max_route_minutes: int = 240
