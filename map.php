<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/header.php';
?>
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ADV Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body { height: 100%; margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    #topbar { padding: 8px 10px; border-bottom: 1px solid #e5e5e5; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    #map { position: absolute; top: 56px; left: 0; right: 0; bottom: 0; }
    .spacer { flex: 1 1 auto; }
    input, select, button, label { font-size: 14px; padding: 6px 8px; }
    button { cursor: pointer; }
    .pill { padding: 6px 10px; border: 1px solid #ddd; border-radius: 999px; background: #fafafa; }
    .stats { display:flex; gap:14px; font-size: 12px; color:#444; }
    .legend { position:absolute; right:12px; bottom:16px; background:#fff; border:1px solid #ddd; border-radius:8px; padding:6px 8px; font-size:12px; }
    .legend .row { display:flex; align-items:center; gap:6px; margin:4px 0; }
    .legend .sw { width:14px; height:6px; border-radius:4px; display:inline-block; }
    .sw.green{background:#2ecc71;} .sw.yellow{background:#f1c40f;} .sw.red{background:#e74c3c;} .sw.gray{background:#7f8c8d;}
  </style>
  <script>window.TOMTOM_KEY = <?php echo json_encode($TOMTOM_API_KEY ?? ""); ?>;</script>

  <style>
    #topbar { position: fixed; left: 0; right: 0; z-index: 900; background:#fff; border-bottom:1px solid #e5e7eb; padding:8px 10px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    /* The map sits below navbar + topbar using a computed CSS variable */
    #map { position: fixed; top: var(--mapTop, 120px); left: 0; right: 0; bottom: 0; }
  </style>
  <script>
    function layoutMap(){
      const nav = document.querySelector('.navbar');
      const topbar = document.getElementById('topbar');
      const navH = (nav?.offsetHeight || 0);
      if (topbar){ topbar.style.top = navH + 'px'; }
      const mapTop = navH + (topbar?.offsetHeight || 0);
      document.documentElement.style.setProperty('--mapTop', mapTop + 'px');
    }
    window.addEventListener('load', layoutMap);
    window.addEventListener('resize', layoutMap);
  </script>

</head>
<body>
  <div id="topbar">
  <span class="pill"><b>ADV</b> Map</span>
  <label>Start <input id="start" value="Aston University, Birmingham" size="28" placeholder="Enter start address"></label>
  <label>End <input id="end" value="New Street Station, Birmingham" size="28" placeholder="Enter destination"></label>
  <button id="swapBtn">Swap</button>
  <label>Mode
    <select id="mode">
      <option value="walk">walk</option>
      <option value="bike">bike</option>
      <option value="drive" selected>drive</option>
    </select>
  </label>
  <label><input type="checkbox" id="trafficToggle"> Live Traffic</label>
  <button id="routeBtn">Route</button>
  <button id="compareBtn">Compare</button>
  <button id="clearBtn">Clear</button>
  <button id="locateBtn">Locate</button>
  <label>Places <input id="placesQuery" size="16" placeholder="e.g., supermarket"></label>
  <button id="placesBtn">Search</button>
  <button id="exportBtn">Export CSV</button>
  <span class="spacer"></span>
  <div class="stats">
    <div><b id="statDistance">—</b> km</div>
    <div><b id="statEta">—</b> min</div>
    <div><b id="statCo2">—</b> g CO₂e</div>
  </div>
</div>


  <div id="map"></div>
  <div class="legend">
    <div class="row"><span class="sw green"></span> Free flow</div>
    <div class="row"><span class="sw yellow"></span> Moderate</div>
    <div class="row"><span class="sw red"></span> Heavy</div>
    <div class="row"><span class="sw gray"></span> No data</div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
 <script>
  window.TOMTOM_KEY = <?php echo json_encode($TOMTOM_API_KEY ?? ""); ?>;
  window.API_BASE   = <?php echo json_encode($API_BASE ?? ""); ?>;
</script>
  <script src="./js/map.js"></script>
</body>
</html>
