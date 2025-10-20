// Map UI controller — routes, start/end geocoding, places, clear, export
const TOMTOM_KEY = (typeof window !== "undefined" && window.TOMTOM_KEY) ? String(window.TOMTOM_KEY) : "";
const API_BASE   = (typeof window !== "undefined" && window.API_BASE)   ? String(window.API_BASE)   : "";
console.log("[config] TOMTOM_KEY set?", TOMTOM_KEY ? "yes" : "no", "| API_BASE:", API_BASE || "(proxy mode)");

const api = async (path, params = {}) => {
  const url = new URL("./api/proxy.php", location.href);
  url.searchParams.set("path", path.replace(/^\//, ""));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// ---------- Map ----------
const map = L.map('map').setView([52.4862, -1.8904], 13); // Birmingham
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, attribution: '&copy; OpenStreetMap' }).addTo(map);

const startIcon = new L.Icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize:[25,41], iconAnchor:[12,41], className:'start-marker' });
const endIcon   = new L.Icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconSize:[25,41], iconAnchor:[12,41], className:'end-marker' });

let startMarker = null;
let endMarker   = null;
let routeLine   = null;
let compareLines = [];
const placesLayer = L.layerGroup().addTo(map);

function setStart(lat, lon, label="Start") {
  if (startMarker) startMarker.remove();
  startMarker = L.marker([lat, lon], {icon:startIcon, draggable:true}).addTo(map).bindPopup(label);
  startMarker.on('dragend', () => drawRoute());
}

function setEnd(lat, lon, label="End") {
  if (endMarker) endMarker.remove();
  endMarker = L.marker([lat, lon], {icon:endIcon, draggable:true}).addTo(map).bindPopup(label);
  endMarker.on('dragend', () => drawRoute());
}

function clearAll() {
  if (startMarker) { startMarker.remove(); startMarker = null; }
  if (endMarker)   { endMarker.remove();   endMarker   = null; }
  if (routeLine)   { routeLine.remove();   routeLine   = null; }
  compareLines.forEach(l => l.remove());
  compareLines = [];
  placesLayer.clearLayers();
  setStats(null);
}

function fitToMarkers() {
  const pts = [];
  if (startMarker) pts.push(startMarker.getLatLng());
  if (endMarker)   pts.push(endMarker.getLatLng());
  if (pts.length) map.fitBounds(L.latLngBounds(pts), {padding:[40,40]});
}

function setStats(stats) {
  const dEl = document.getElementById('statDistance');
  const tEl = document.getElementById('statEta');
  const cEl = document.getElementById('statCo2');
  if (!stats) { dEl.textContent='—'; tEl.textContent='—'; cEl.textContent='—'; return; }
  const km = stats.distance_m/1000;
  const mins = stats.travel_s/60;
  // Vehicle override
  const veh = getVehicleProfile();
  let co2 = stats.emissions_g;
  if (veh && veh.ef_gpkm) {
    co2 = km * Number(veh.ef_gpkm);
    if (veh.idle_pct) co2 *= (1 + Number(veh.idle_pct)/100);
  }
  dEl.textContent = km.toFixed(2);
  tEl.textContent = mins.toFixed(0);
  cEl.textContent = co2.toFixed(0);
  // Save back computed emissions for reports
  stats.emissions_g = co2;
}
function pushReport(row) {
  const arr = JSON.parse(localStorage.getItem('adv_reports') || '[]');
  arr.unshift({...row, at: new Date().toISOString()});
  localStorage.setItem('adv_reports', JSON.stringify(arr.slice(0,50)));
}

async function geocode(query) {
  if (!query || !query.trim()) throw new Error("Empty query");
  if (TOMTOM_KEY) {
    const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}`;
    const r = await fetch(url); const j = await r.json();
    const i = j.results && j.results[0];
    if (i && i.position) return { lat:i.position.lat, lon:i.position.lon, label:i.address && i.address.freeformAddress || query };
  }
  // Fallback: Nominatim
  const alt = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  const r2 = await fetch(alt, {headers:{"Accept":"application/json"}}); const jj = await r2.json();
  if (jj && jj[0]) return { lat: parseFloat(jj[0].lat), lon: parseFloat(jj[0].lon), label: jj[0].display_name };
  throw new Error("No geocode result");
}

async function drawRoute() {
  const mode = document.getElementById('mode').value;
  const traffic = document.getElementById('trafficToggle').checked;
  if (!startMarker || !endMarker) return;
  const s = startMarker.getLatLng(); const e = endMarker.getLatLng();
  const params = { mode, start: `${s.lat},${s.lng}`, end: `${e.lat},${e.lng}`, traffic: String(traffic) };
  const fc = await api('/map/route', params);
  if (routeLine) routeLine.remove();
  compareLines.forEach(l => l.remove()); compareLines = [];
  const feat = fc.features[0];
  const coords = feat.geometry.coordinates.map(([x,y]) => [y,x]);
  routeLine = L.polyline(coords, {weight:6}).addTo(map);
  fitToMarkers();
  setStats({ distance_m: feat.properties.distance_m, travel_s: feat.properties.travel_s, emissions_g: feat.properties.emissions_g });
  pushReport({ mode, distance_m: feat.properties.distance_m, travel_s: feat.properties.travel_s, emissions_g: feat.properties.emissions_g });
}

async function compareModes() {
  if (!startMarker || !endMarker) return;
  compareLines.forEach(l => l.remove()); compareLines = [];
  if (routeLine) { routeLine.remove(); routeLine = null; }
  const s = startMarker.getLatLng(); const e = endMarker.getLatLng();
  const fc = await api('/map/compare', { start: `${s.lat},${s.lng}`, end: `${e.lat},${e.lng}` });
  const colorByMode = { walk: 'green', bike: 'orange', drive: 'blue' };
  fc.features.forEach(f => {
    const coords = f.geometry.coordinates.map(([x,y]) => [y,x]);
    const line = L.polyline(coords, {weight:5, opacity:0.9, color: colorByMode[f.properties.mode] || undefined}).addTo(map);
    compareLines.push(line);
  });
  fitToMarkers();
}

// Click to set pins
map.on('click', async (e) => {
  if (!startMarker) setStart(e.latlng.lat, e.latlng.lng, 'Start');
  else if (!endMarker) { setEnd(e.latlng.lat, e.latlng.lng, 'End'); await drawRoute(); }
  else { // move end on subsequent clicks
    setEnd(e.latlng.lat, e.latlng.lng, 'End');
    await drawRoute();
  }
});

// Controls
document.getElementById('routeBtn').addEventListener('click', async () => {
  const sQ = document.getElementById('start').value;
  const eQ = document.getElementById('end').value;
  if (sQ) { const g = await geocode(sQ); setStart(g.lat, g.lon, g.label); }
  if (eQ) { const g = await geocode(eQ); setEnd(g.lat, g.lon, g.label); }
  await drawRoute();
});

document.getElementById('compareBtn').addEventListener('click', compareModes);

document.getElementById('clearBtn').addEventListener('click', clearAll);

document.getElementById('locateBtn').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
      map.setView([p.coords.latitude, p.coords.longitude], 14);
    });
  }
});

document.getElementById('swapBtn').addEventListener('click', async () => {
  const s = document.getElementById('start'); const e = document.getElementById('end');
  const tmp = s.value; s.value = e.value; e.value = tmp;
  const sM = startMarker; startMarker = endMarker; endMarker = sM;
  await drawRoute();
});

// Places search
document.getElementById('placesBtn').addEventListener('click', async () => {
  const q = document.getElementById('placesQuery').value.trim();
  if (!q) return;
  let center = map.getCenter();
  if (startMarker) center = startMarker.getLatLng();
  const url = TOMTOM_KEY
    ? `https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(q)}.json?key=${TOMTOM_KEY}&lat=${center.lat}&lon=${center.lng}&radius=5000&limit=20`
    : `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=20&viewbox=`;
  const res = await fetch(url); const data = await res.json();
  placesLayer.clearLayers();
  if (Array.isArray(data.results)) {
    data.results.forEach(r => {
      const lat = r.position.lat, lon = r.position.lon;
      const name = (r.poi && r.poi.name) || (r.address && r.address.freeformAddress) || q;
      const m = L.marker([lat, lon]).addTo(placesLayer).bindPopup(name);
      m.on('click', () => { setEnd(lat, lon, name); drawRoute(); });
    });
    map.fitBounds(placesLayer.getBounds(), {padding:[40,40]});
  } else if (Array.isArray(data)) {
    data.forEach(r => {
      const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
      const name = r.display_name || q;
      const m = L.marker([lat, lon]).addTo(placesLayer).bindPopup(name);
      m.on('click', () => { setEnd(lat, lon, name); drawRoute(); });
    });
    map.fitBounds(placesLayer.getBounds(), {padding:[40,40]});
  }
});

// Export CSV (client-side)
document.getElementById('exportBtn').addEventListener('click', () => {
  const rows = JSON.parse(localStorage.getItem('adv_reports') || '[]');
  if (!rows.length) { alert('No route data yet'); return; }
  const header = ['timestamp','mode','distance_m','travel_s','emissions_g'];
  const csv = [header.join(',')].concat(rows.map(r => [r.at,r.mode,r.distance_m,r.travel_s,r.emissions_g].join(','))).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'routes.csv'; a.click();
});

// Initial geocode from default inputs
(async () => {
  try {
    const sQ = document.getElementById('start').value;
    const eQ = document.getElementById('end').value;
    if (sQ) { const g = await geocode(sQ); setStart(g.lat, g.lon, g.label); }
    if (eQ) { const g = await geocode(eQ); setEnd(g.lat, g.lon, g.label); }
    fitToMarkers();
  } catch(e) { console.warn(e); }
})();
