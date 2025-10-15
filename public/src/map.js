import L from "leaflet";


// Basic map
const map = L.map("map").setView([52.4862, -1.8904], 12); // Birmingham
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);


// Demo markers (you can drag to pick coordinates later)
const start = L.marker([52.488, -1.9], { draggable: true }).addTo(map);
start.bindPopup("Start");
const end = L.marker([52.48, -1.88], { draggable: true }).addTo(map);
end.bindPopup("End");


let routeLayer = null;


async function fetchRoute() {
const city = document.getElementById("city").textContent;
const mode = document.getElementById("mode").value; // walk|bike|drive
const s = start.getLatLng();
const e = end.getLatLng();


// TEMP: no backend yet — draw a straight line as a placeholder
const gj = {
type: "FeatureCollection",
features: [
{ type: "Feature", properties: { mode }, geometry: { type: "LineString", coordinates: [ [s.lng, s.lat], [e.lng, e.lat] ] } }
]
};


if (routeLayer) map.removeLayer(routeLayer);
routeLayer = L.geoJSON(gj).addTo(map);
}


document.getElementById("routeBtn").addEventListener("click", fetchRoute);