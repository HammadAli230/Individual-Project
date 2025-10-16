/* global L */

// ======= Config =======
const TRAFFIC_PROVIDER = "tomtom"; // "tomtom" supported here
const TRAFFIC_TILES_DEFAULT_ON = false; // traffic overlay off by default

// ---------- DOM refs ----------
const placeEl   = document.getElementById("place");
const modeEl    = document.getElementById("mode");
const routeBtn  = document.getElementById("routeBtn");
const clearBtn  = document.getElementById("clearBtn");
const locateBtn = document.getElementById("locateBtn");
const startBtn  = document.getElementById("simStartBtn");
const pauseBtn  = document.getElementById("simPauseBtn");
const statusEl  = document.getElementById("simStatus");
const trafficBadge = document.getElementById("trafficBadge");
const trafficNote  = document.getElementById("trafficNote");

// ---------- Helpers ----------
function setStatus(txt) { if (statusEl) statusEl.textContent = txt; }
function disable(el, v = true) { if (el) el.disabled = v; }
function busy(el, v = true, labelWhenBusy = "Loading…", labelReady = null) {
  if (!el) return;
  el.dataset._label ??= el.textContent;
  if (v) {
    el.textContent = labelWhenBusy;
    el.classList.add("disabled");
    el.setAttribute("aria-busy", "true");
    el.disabled = true;
  } else {
    el.textContent = labelReady || el.dataset._label;
    el.classList.remove("disabled");
    el.removeAttribute("aria-busy");
    el.disabled = false;
  }
}

// ---------- Map setup ----------
const map = L.map("map").setView([52.4862, -1.8904], 12);

// Base OSM
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Traffic tiles (TomTom)
let trafficTiles = L.tileLayer(
  "https://{s}.api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key={apikey}&thickness=10&tileSize=256",
  {
    apikey: "use-config", // we keep the real key on the server side for API calls
    subdomains: "abcd",
    opacity: 0.8,
    attribution: "Traffic © TomTom"
  }
);

// Layer control
const baseLayers = { "OpenStreetMap": osm };
const overlays   = { "Live Traffic": trafficTiles };
L.control.layers(baseLayers, overlays, { collapsed: true }).addTo(map);
L.control.scale().addTo(map);
if (TRAFFIC_TILES_DEFAULT_ON) trafficTiles.addTo(map);

// ---------- Markers ----------
const DEFAULT_START = [52.488, -1.9];
const DEFAULT_END   = [52.48,  -1.88];

let start = L.marker(DEFAULT_START, { draggable: true }).addTo(map).bindPopup("Start");
let end   = L.marker(DEFAULT_END,   { draggable: true }).addTo(map).bindPopup("End");

// ---------- Route + sim state ----------
let routeLayer = null;
let routeLatLngs = [];
let routeLengthMeters = 0;

let simMarker = null;
let simReqId = null;
let simRunning = false;
let simProgressM = 0;
let lastTs = null;

let lastTrafficPct = 0; // updated by updateTrafficBadge()

// ---------- Click-to-set start/end ----------
let clickCount = 0;
map.on("click", (e) => {
  const { lat, lng } = e.latlng;
  if (clickCount % 2 === 0) start.setLatLng([lat, lng]).openPopup();
  else                      end.setLatLng([lat, lng]).openPopup();
  clickCount++;
});

// ---------- Locate ----------
if (locateBtn) {
  locateBtn.addEventListener("click", () => {
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    busy(locateBtn, true, "Locating…", "📍 Use My Location");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 14);
        start.setLatLng([latitude, longitude]).openPopup();
        busy(locateBtn, false, undefined, "📍 Use My Location");
      },
      (err) => {
        busy(locateBtn, false, undefined, "📍 Use My Location");
        alert("Location error: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ---------- Utilities ----------
const baseSpeed = (mode) => (mode === "walk" ? 1.4 : mode === "bike" ? 4.0 : 8.0); // m/s base
const modeSpeedMS = (mode) => {
  const v0 = baseSpeed(mode);
  const factor = Math.max(0.2, 1 - lastTrafficPct / 100); // never below 20% of base
  return v0 * factor;
};

function polylineLength(latlngs) {
  let m = 0;
  for (let i = 1; i < latlngs.length; i++) m += map.distance(latlngs[i - 1], latlngs[i]);
  return m;
}

function interpolateOnLine(latlngs, distanceM) {
  if (!latlngs.length) return null;
  if (distanceM <= 0) return L.latLng(latlngs[0]);
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

// ---------- Robust Clear ----------
function resetSim() {
  try {
    // Remove known route layer if present
    if (routeLayer && map.hasLayer(routeLayer)) {
      try { routeLayer.remove(); } catch {}
      try { map.removeLayer(routeLayer); } catch {}
    }
    routeLayer = null;

    // Remove any other non-base overlays (keeps OSM + Live Traffic)
    map.eachLayer((l) => {
      const isOSM = l === osm;
      const isTraffic = l === trafficTiles;
      const isStart = l === start;
      const isEnd = l === end;
      const isSimMarker = l === simMarker;
      if (!isOSM && !isTraffic && !isStart && !isEnd && !isSimMarker) {
        try { map.removeLayer(l); } catch {}
      }
    });

    // Remove moving marker
    if (simMarker && map.hasLayer(simMarker)) {
      try { map.removeLayer(simMarker); } catch {}
    }
    simMarker = null;

    // Stop any animation
    if (simReqId) {
      cancelAnimationFrame(simReqId);
      simReqId = null;
    }
    simRunning = false;

    // Reset state
    routeLatLngs = [];
    routeLengthMeters = 0;
    simProgressM = 0;
    lastTs = null;
    clickCount = 0; // next click sets Start again

    // Reset markers to defaults
    try { start.setLatLng(DEFAULT_START); } catch {}
    try { end.setLatLng(DEFAULT_END); } catch {}

    // UI
    disable(startBtn, true);
    disable(pauseBtn, true);
    disable(routeBtn, false);
    disable(clearBtn, false);

    setStatus("Cleared. Load a new route.");
  } catch (e) {
    console.error("resetSim error:", e);
    alert("Couldn’t clear the map. See console for details.");
  }
}

// ---------- Live traffic badge ----------
async function updateTrafficBadge() {
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(",");
  try {
    const resp = await fetch(`api/traffic.php?bbox=${bbox}`);
    const data = await resp.json();
    if (data.avgCongestionPct == null) {
      if (trafficBadge) trafficBadge.textContent = "Traffic: n/a";
      if (trafficNote)  trafficNote.textContent = "";
      lastTrafficPct = 0;
      return;
    }
    const pct = data.avgCongestionPct;
    lastTrafficPct = pct;
    if (trafficBadge) {
      trafficBadge.textContent = `Traffic: ${pct}%`;
      trafficBadge.className = "badge rounded-pill " + (
        pct < 10 ? "text-bg-success" :
        pct < 30 ? "text-bg-warning" :
                   "text-bg-danger"
      );
    }
    if (trafficNote) trafficNote.textContent = `(${data.samples} samples)`;
  } catch (e) {
    // ignore errors silently
  }
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
  disable(clearBtn, true);
  disable(startBtn, true);
  disable(pauseBtn, true);

  try {
    const params = new URLSearchParams({
      path: "/map/route",
      place,
      mode,
      start_lat: s.lat, start_lon: s.lng,
      end_lat: e.lat,   end_lon: e.lng
    });
    const resp = await fetch(`api/proxy.php?${params.toString()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const gj = await resp.json();

    // Clear any previous route layer then draw new one
    if (routeLayer && map.hasLayer(routeLayer)) {
      try { map.removeLayer(routeLayer); } catch {}
      routeLayer = null;
    }
    routeLayer = L.geoJSON(gj).addTo(map);

    const coords = gj?.features?.[0]?.geometry?.coordinates || [];
    routeLatLngs = coords.map(([lon, lat]) => [lat, lon]);
    routeLengthMeters = polylineLength(routeLatLngs);

    if (!routeLatLngs.length) throw new Error("No route geometry returned.");

    map.fitBounds(L.latLngBounds(routeLatLngs), { padding: [20, 20] });

    // Reset sim for fresh run
    if (simMarker && map.hasLayer(simMarker)) {
      try { map.removeLayer(simMarker); } catch {}
    }
    simMarker = null;
    if (simReqId) { cancelAnimationFrame(simReqId); simReqId = null; }
    simProgressM = 0; lastTs = null;
    disable(startBtn, false);
    disable(pauseBtn, true);

    setStatus(`Route loaded: ${(routeLengthMeters/1000).toFixed(2)} km. Ready to simulate.`);
  } catch (err) {
    console.error(err);
    alert("Failed to fetch route from backend.\n• Is FastAPI running on 127.0.0.1:8000?\n• Is php_curl enabled?\n\n" + err.message);
    setStatus("Error fetching route.");
  } finally {
    busy(routeBtn, false, undefined, "Preview Route");
    disable(clearBtn, false);
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

  if (simProgressM >= routeLengthMeters) {
    setStatus("Arrived ✅");
    stopAnim();
    return;
  }
  simReqId = requestAnimationFrame(frame);
}

function stopAnim() {
  if (simReqId) cancelAnimationFrame(simReqId);
  simReqId = null;
  simRunning = false;
  disable(pauseBtn, true);
  disable(startBtn, false);
}

function startSim() {
  if (!routeLatLngs.length) return alert("Load a route first.");
  if (simRunning) return;
  simRunning = true;
  disable(startBtn, true);
  disable(pauseBtn, false);
  lastTs = null;
  simReqId = requestAnimationFrame(frame);
}

function pauseSim() {
  if (!simRunning) return;
  stopAnim();
  setStatus("Paused ⏸");
}

// ---------- Wire buttons ----------
routeBtn?.addEventListener("click", fetchRoute);
clearBtn?.addEventListener("click", resetSim);
startBtn?.addEventListener("click", startSim);
pauseBtn?.addEventListener("click", pauseSim);

// Initial state
disable(startBtn, true);
disable(pauseBtn, true);
setStatus("No route loaded.");
