/* global L */

// ======= Config =======
const TRAFFIC_TILES_DEFAULT_ON = false;

// ---------- DOM refs ----------
const placeEl     = document.getElementById("place");
const modeEl      = document.getElementById("mode");
const routeBtn    = document.getElementById("routeBtn");
const clearBtn    = document.getElementById("clearBtn");
const locateBtn   = document.getElementById("locateBtn");
const startBtn    = document.getElementById("simStartBtn");
const pauseBtn    = document.getElementById("simPauseBtn");
const statusEl    = document.getElementById("simStatus");
const trafficBadge= document.getElementById("trafficBadge");
const trafficNote = document.getElementById("trafficNote");

const statDistance= document.getElementById("statDistance");
const statEta     = document.getElementById("statEta");
const statCo2     = document.getElementById("statCo2");
const compareBtn  = document.getElementById("compareBtn");
const exportBtn   = document.getElementById("exportBtn");
const comparePanel= document.getElementById("comparePanel");
const multiBtn    = document.getElementById("multiBtn");
const stopsEl     = document.getElementById("stops");

// ---------- Helpers ----------
function setStatus(txt) { if (statusEl) statusEl.textContent = txt; }
function disable(el, v = true) { if (el) el.disabled = v; }
function busy(el, v = true, labelWhenBusy = "Loading…", labelReady = null) {
  if (!el) return;
  el.dataset._label ??= el.textContent;
  if (v) { el.textContent = labelWhenBusy; el.classList.add("disabled"); el.setAttribute("aria-busy","true"); el.disabled = true; }
  else   { el.textContent = labelReady || el.dataset._label; el.classList.remove("disabled"); el.removeAttribute("aria-busy"); el.disabled = false; }
}
function renderStats(props) {
  if (!props) { statDistance.textContent = statEta.textContent = statCo2.textContent = "—"; return; }
  statDistance.textContent = (props.length_m/1000).toFixed(2) + " km";
  statEta.textContent      = Math.ceil(props.travel_s/60) + " min";
  statCo2.textContent      = (props.emissions_g||0).toFixed(0) + " g CO₂e";
}

// ---------- Map setup ----------
const map = L.map("map").setView([52.4862, -1.8904], 12);

// Base OSM
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// TomTom traffic tiles (visual)
let trafficTiles = L.tileLayer(
  "https://{s}.api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key={apikey}&thickness=10&tileSize=256",
  { apikey: "unused-here", subdomains: "abcd", opacity: 0.8, attribution: "Traffic © TomTom" }
);
const baseLayers = { "OpenStreetMap": osm };
const overlays   = { "Live Traffic": trafficTiles };
L.control.layers(baseLayers, overlays, { collapsed: true }).addTo(map);
L.control.scale().addTo(map);
if (TRAFFIC_TILES_DEFAULT_ON) trafficTiles.addTo(map);

// ---------- Markers ----------
let start = L.marker([52.488, -1.9], { draggable: true }).addTo(map).bindPopup("Start");
let end   = L.marker([52.48,  -1.88], { draggable: true }).addTo(map).bindPopup("End");

// ---------- Route + sim state ----------
let routeLayer = null;
let routeLatLngs = [];
let routeLengthMeters = 0;

let simMarker = null;
let simReqId = null;
let simRunning = false;
let simProgressM = 0;
let lastTs = null;

let lastTrafficPct = 0; // from badge → affects speed

// base mode speeds m/s
const baseSpeed = (mode) => (mode === "walk" ? 1.4 : mode === "bike" ? 4.0 : 8.0);
const modeSpeedMS = (mode) => Math.max(0.2, (1 - lastTrafficPct/100)) * baseSpeed(mode);

// ---------- Click-to-set start/end ----------
let clickCount = 0;
map.on("click", (e) => {
  const { lat, lng } = e.latlng;
  if (clickCount % 2 === 0) start.setLatLng([lat, lng]).openPopup();
  else                      end.setLatLng([lat, lng]).openPopup();
  clickCount++;
});

// ---------- Locate ----------
locateBtn?.addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Geolocation not supported.");
  busy(locateBtn, true, "Locating…", "📍 Use My Location");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 14);
      start.setLatLng([latitude, longitude]).openPopup();
      busy(locateBtn, false, undefined, "📍 Use My Location");
    },
    (err) => { busy(locateBtn, false, undefined, "📍 Use My Location"); alert("Location error: " + err.message); },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// ---------- Utilities ----------
function polylineLength(latlngs) {
  let m = 0;
  for (let i = 1; i < latlngs.length; i++) m += map.distance(latlngs[i - 1], latlngs[i]);
  return m;
}
function interpolateOnLine(latlngs, distanceM) {
  if (!latlngs.length) return null; if (distanceM <= 0) return L.latLng(latlngs[0]);
  let accum = 0;
  for (let i = 1; i < latlngs.length; i++) {
    const a = L.latLng(latlngs[i - 1]), b = L.latLng(latlngs[i]);
    const seg = map.distance(a, b);
    if (accum + seg >= distanceM) {
      const t = (distanceM - accum) / seg;
      return L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t);
    }
    accum += seg;
  }
  return L.latLng(latlngs.at(-1));
}
function resetSim() {
  if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
  if (simMarker)  { map.removeLayer(simMarker);  simMarker  = null; }
  if (simReqId)   { cancelAnimationFrame(simReqId); simReqId = null; }
  simRunning = false; simProgressM = 0; lastTs = null;
  routeLatLngs = []; routeLengthMeters = 0;
  disable(startBtn, true); disable(pauseBtn, true);
  setStatus("Cleared. Load a new route.");
  renderStats(null);
  comparePanel.innerHTML = "";
  window.__lastStats = null;
}

// ---------- Live traffic badge ----------
async function updateTrafficBadge() {
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(",");
  try {
    const resp = await fetch(`api/traffic.php?bbox=${bbox}`);
    const data = await resp.json();
    if (data.avgCongestionPct == null) {
      trafficBadge.textContent = "Traffic: n/a"; trafficBadge.className = "badge rounded-pill text-bg-secondary";
      trafficNote.textContent = ""; lastTrafficPct = 0; return;
    }
    const pct = data.avgCongestionPct; lastTrafficPct = pct;
    trafficBadge.textContent = `Traffic: ${pct}%`;
    trafficBadge.className = "badge rounded-pill " + (pct < 10 ? "text-bg-success" : pct < 30 ? "text-bg-warning" : "text-bg-danger");
    trafficNote.textContent = `(${data.samples} samples)`;
  } catch (_) {}
}
map.on("moveend", updateTrafficBadge);
updateTrafficBadge();

// ---------- Fetch route ----------
async function fetchRoute() {
  const place = placeEl.value.trim();
  const mode  = modeEl.value;
  const s = start.getLatLng(), e = end.getLatLng();
  if (!place) return alert("Enter a city/place.");

  busy(routeBtn, true, "Fetching route…", "Preview Route");
  disable(clearBtn, true); disable(startBtn, true); disable(pauseBtn, true);

  try {
    const params = new URLSearchParams({
      path: "/map/route",
      place, mode,
      start_lat: s.lat, start_lon: s.lng,
      end_lat: e.lat,   end_lon: e.lng
    });
    const resp = await fetch(`api/proxy.php?${params.toString()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const gj = await resp.json();

    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    routeLayer = L.geoJSON(gj).addTo(map);

    const coords = gj?.features?.[0]?.geometry?.coordinates || [];
    routeLatLngs = coords.map(([lon, lat]) => [lat, lon]);
    routeLengthMeters = polylineLength(routeLatLngs);

    map.fitBounds(L.latLngBounds(routeLatLngs), { padding: [20, 20] });

    const props = gj?.features?.[0]?.properties;
    renderStats(props);
    window.__lastStats = { mode, ...props };

    if (simMarker) { map.removeLayer(simMarker); simMarker = null; }
    if (simReqId)  { cancelAnimationFrame(simReqId); simReqId = null; }
    simProgressM = 0; lastTs = null;
    disable(startBtn, false); disable(pauseBtn, true);

    setStatus(`Route loaded: ${(routeLengthMeters/1000).toFixed(2)} km. Ready to simulate.`);
  } catch (err) {
    console.error(err);
    alert("Failed to fetch route from backend.\n• Is FastAPI running on 127.0.0.1:8000?\n• Is php_curl enabled?\n\n" + err.message);
    setStatus("Error fetching route.");
  } finally {
    busy(routeBtn, false, undefined, "Preview Route"); disable(clearBtn, false);
  }
}

// ---------- Simulation ----------
function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = (ts - lastTs) / 1000; lastTs = ts;

  const v = modeSpeedMS(modeEl.value);
  simProgressM = Math.min(simProgressM + v * dt, routeLengthMeters);

  const pos = interpolateOnLine(routeLatLngs, simProgressM);
  if (!simMarker) simMarker = L.circleMarker(pos, { radius: 6 }).addTo(map);
  else            simMarker.setLatLng(pos);

  const remainingM = Math.max(routeLengthMeters - simProgressM, 0);
  const donePct = routeLengthMeters ? Math.round((simProgressM / routeLengthMeters) * 100) : 0;
  const etaMin = Math.ceil((remainingM / v) / 60);

  setStatus(`Moving… ${donePct}% | remaining ${(remainingM/1000).toFixed(2)} km | ETA ~ ${etaMin} min (traffic ${lastTrafficPct}%)`);

  if (simProgressM >= routeLengthMeters) { setStatus("Arrived ✅"); stopAnim(); return; }
  simReqId = requestAnimationFrame(frame);
}
function stopAnim() { if (simReqId) cancelAnimationFrame(simReqId); simReqId = null; simRunning = false; disable(pauseBtn, true); disable(startBtn, false); }
function startSim() { if (!routeLatLngs.length) return alert("Load a route first."); if (simRunning) return; simRunning = true; disable(startBtn, true); disable(pauseBtn, false); lastTs = null; simReqId = requestAnimationFrame(frame); }
function pauseSim() { if (!simRunning) return; stopAnim(); setStatus("Paused ⏸"); }

// ---------- Compare & Export ----------
compareBtn?.addEventListener("click", async () => {
  const s = start.getLatLng(), e = end.getLatLng();
  const params = new URLSearchParams({
    path: "/map/compare",
    start_lat: s.lat, start_lon: s.lng, end_lat: e.lat, end_lon: e.lng,
    modes: "walk,bike,drive"
  });
  try {
    compareBtn.disabled = true; compareBtn.textContent = "Comparing…";
    const resp = await fetch(`api/proxy.php?${params.toString()}`);
    const gj = await resp.json();
    const rows = gj.features.map(f => {
      const p = f.properties || {};
      if (p.error) return `<tr><td>${p.mode}</td><td colspan="3" class="text-danger">${p.error}</td></tr>`;
      return `<tr>
        <td>${p.mode}</td>
        <td>${(p.length_m/1000).toFixed(2)} km</td>
        <td>${Math.ceil(p.travel_s/60)} min</td>
        <td>${(p.emissions_g||0).toFixed(0)} g</td>
      </tr>`;
    }).join("");
    comparePanel.innerHTML = `
      <div class="mt-2">
        <table class="table table-sm mb-0">
          <thead><tr><th>Mode</th><th>Distance</th><th>ETA</th><th>Emissions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) {
    comparePanel.textContent = "Compare failed: " + e.message;
  } finally {
    compareBtn.textContent = "Compare Modes (walk/bike/drive)";
    compareBtn.disabled = false;
  }
});

exportBtn?.addEventListener("click", async () => {
  const stats = window.__lastStats;
  if (!stats) return alert("Load a route first.");
  const form = new FormData();
  form.append("mode", stats.mode);
  form.append("length_m", stats.length_m);
  form.append("travel_s", stats.travel_s);
  form.append("emissions_g", stats.emissions_g || 0);

  // via proxy to avoid CORS issues
  const resp = await fetch(`api/proxy.php?path=/export/csv`, { method: "POST", body: form });
  const csv = await resp.text();

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `adv_route_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---------- Multi-stop ----------
multiBtn?.addEventListener("click", async () => {
  const text = (stopsEl.value || "").trim();
  if (!text) return alert("Enter stops as 'lat,lon;lat,lon;…'");
  const mode = modeEl.value;
  const params = new URLSearchParams({ path: "/map/route_multi", mode, stops: text });
  try {
    busy(multiBtn, true, "Routing…", "Route Multi-Stop");
    const resp = await fetch(`api/proxy.php?${params.toString()}`);
    const gj = await resp.json();
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.geoJSON(gj).addTo(map);
    const coords = gj.features?.[0]?.geometry?.coordinates || [];
    routeLatLngs = coords.map(([lon, lat]) => [lat, lon]);
    routeLengthMeters = polylineLength(routeLatLngs);
    const props = gj.features?.[0]?.properties;
    renderStats(props);
    window.__lastStats = { mode, ...props };
    map.fitBounds(L.latLngBounds(routeLatLngs), { padding: [20, 20] });
    disable(startBtn, false); disable(pauseBtn, true);
  } catch (e) {
    alert("Multi-stop routing failed: " + e.message);
  } finally {
    busy(multiBtn, false, undefined, "Route Multi-Stop");
  }
});

// ---------- Wire buttons ----------
routeBtn?.addEventListener("click", fetchRoute);
clearBtn?.addEventListener("click", resetSim);
startBtn?.addEventListener("click", startSim);
pauseBtn?.addEventListener("click", pauseSim);

// Initial state
disable(startBtn, true); disable(pauseBtn, true);
setStatus("No route loaded.");
