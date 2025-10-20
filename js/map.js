/* global L */
const api = (path, params={}) => {
  const url = new URL(`./api/proxy.php`, location.href);
  url.searchParams.set("path", path.replace(/^\//,""));
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
};

const statDistance= document.getElementById("statDistance");
const statEta     = document.getElementById("statEta");
const statCo2     = document.getElementById("statCo2");
function renderStats(props) {
  if (!props) { statDistance.textContent = statEta.textContent = statCo2.textContent = "—"; return; }
  statDistance.textContent = (props.length_m/1000).toFixed(2);
  statEta.textContent      = Math.ceil(props.travel_s/60);
  statCo2.textContent      = (props.emissions_g||0).toFixed(0);
}

const map = L.map("map").setView([52.4862, -1.8904], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);

let start = L.marker([52.488, -1.9], { draggable: true }).addTo(map).bindPopup("Start");
let end   = L.marker([52.48,  -1.88], { draggable: true }).addTo(map).bindPopup("End");
let routeLayer = null;
let routeSegments = [];
let trafficLayer = null;
let trafficTimer = null;

function ensureTrafficLayer() {
  if (!window.TOMTOM_KEY) return null;
  if (!trafficLayer) {
    const url = "https://{s}.traffic.tile.tomtom.com/trafficFlow/flowTile/relative0/{z}/{x}/{y}.png?key=" + window.TOMTOM_KEY;
    trafficLayer = L.tileLayer(url, { subdomains: ["a","b","c"], opacity: 0.85, attribution: "&copy; TomTom" });
  }
  return trafficLayer;
}

const trafficToggle = document.getElementById("trafficToggle");
if (trafficToggle) {
  trafficToggle.addEventListener("change", () => {
    const layer = ensureTrafficLayer();
    if (!layer) { alert("No TOMTOM_API_KEY set in includes/config.php"); trafficToggle.checked = false; return; }
    if (trafficToggle.checked) layer.addTo(map);
    else { map.removeLayer(layer); stopTrafficRefresh(); }
  });
}

function clearRoute() {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  routeSegments.forEach(seg => map.removeLayer(seg));
  routeSegments = [];
  renderStats(null);
}

async function colorRouteWithTraffic(fc) {
  if (!window.TOMTOM_KEY || !(trafficToggle?.checked)) return false;
  try {
    const feat = fc.features.find(f => f.geometry && f.geometry.type === "LineString");
    if (!feat) return false;
    const coords = feat.geometry.coordinates;
    const url = new URL("./api/proxy.php", location.href);
    url.searchParams.set("path", "traffic/route-color");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coords }) });
    const data = await res.json();
    if (!data || !Array.isArray(data.colors)) return false;

    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    routeSegments.forEach(seg => map.removeLayer(seg));
    routeSegments = [];

    for (let i=0; i<data.colors.length; i++) {
      const a = coords[i], b = coords[i+1];
      if (!a || !b) continue;
      const seg = L.polyline([[a[1], a[0]], [b[1], b[0]]], { weight: 6, color: data.colors[i] });
      seg.addTo(map);
      routeSegments.push(seg);
    }
    return true;
  } catch (e) {
    console.warn("Traffic color failed:", e);
    return false;
  }
}

function drawFeatureCollection(fc) {
  const lines = fc.features.filter(f => f.geometry && f.geometry.type === "LineString");
  const latlngs = lines.map(f => f.geometry.coordinates.map(([x,y]) => [y,x])).flat();
  const last = fc.features.find(f => f.properties && f.properties.length_m);
  renderStats(last ? last.properties : null);
  if (latlngs.length) map.fitBounds(L.latLngBounds(latlngs), { padding:[30,30] });
  colorRouteWithTraffic(fc).then(success => {
    if (!success) {
      if (routeLayer) map.removeLayer(routeLayer);
      routeLayer = L.polyline(latlngs, { weight: 5 }).addTo(map);
    }
  });
}

function startTrafficRefresh(currentFcProvider) {
  stopTrafficRefresh();
  trafficTimer = setInterval(async () => {
    if (!trafficToggle?.checked) return;
    if (typeof currentFcProvider === "function") {
      const fc = await currentFcProvider();
      if (fc) await colorRouteWithTraffic(fc);
    }
  }, 60000);
}
function stopTrafficRefresh() { if (trafficTimer) clearInterval(trafficTimer); trafficTimer = null; }

document.getElementById("routeBtn").addEventListener("click", async () => {
  const mode = document.getElementById("mode").value;
  const place = document.getElementById("place").value;
  const s = `${start.getLatLng().lat},${start.getLatLng().lng}`;
  const e = `${end.getLatLng().lat},${end.getLatLng().lng}`;
  try {
    const traffic = trafficToggle?.checked ? 'true' : 'false';
    const provider = async () => api("/map/route", { mode, place, start: s, end: e, traffic });
    const fc = await provider();
    drawFeatureCollection(fc);
    startTrafficRefresh(provider);
  } catch (e) { alert("Routing failed: " + e.message); }
});

document.getElementById("compareBtn").addEventListener("click", async () => {
  const place = document.getElementById("place").value;
  const s = `${start.getLatLng().lat},${start.getLatLng().lng}`;
  const e = `${end.getLatLng().lat},${end.getLatLng().lng}`;
  try {
    const provider = async () => api("/map/compare", { start: s, end: e, place });
    const fc = await provider();
    drawFeatureCollection(fc);
    startTrafficRefresh(provider);
  } catch (e) { alert("Compare failed: " + e.message); }
});

document.getElementById("clearBtn").addEventListener("click", () => { clearRoute(); });
document.getElementById("locateBtn").addEventListener("click", () => { map.locate({ setView: true, maxZoom: 15 }); });

document.getElementById("exportBtn").addEventListener("click", async () => {
  if (!routeLayer && routeSegments.length === 0) return alert("Route first");
  const mode = document.getElementById("mode").value;
  const km = parseFloat((statDistance.textContent||"0")) || 0;
  const mins = parseFloat((statEta.textContent||"0")) || 0;
  const co2 = parseFloat((statCo2.textContent||"0")) || 0;
  const length_m = km * 1000; const travel_s = mins * 60; const emissions_g = co2;
  const url = new URL("./api/proxy.php", location.href);
  url.searchParams.set("path", "export/csv");
  const res = await fetch(url, { method:"POST", body: new URLSearchParams({ mode, length_m, travel_s, emissions_g }) });
  const txt = await res.text();
  const blob = new Blob([txt], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "route_stats.csv"; a.click();
});
