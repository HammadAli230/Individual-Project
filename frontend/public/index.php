<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ADV — Real Map</title>
<link rel="stylesheet" href="/node_modules/leaflet/dist/leaflet.css" />
<style>
body{font-family:system-ui,Arial,sans-serif;margin:0}
header{padding:16px;border-bottom:1px solid #eee}
#map{height: calc(100vh - 72px);}
.toolbar{display:flex;gap:8px;align-items:center}
.pill{border:1px solid #ddd;border-radius:999px;padding:6px 12px}
.mode-btn{cursor:pointer}
</style>
</head>
<body>
<header>
<h1 style="margin:4px 0">ADV — Autonomous Delivery Vehicles</h1>
<div class="toolbar">
<span class="pill">City: <strong id="city">Birmingham, UK</strong></span>
<span class="pill">Mode:
<select id="mode" class="mode-btn">
<option value="walk">walk (robots)</option>
<option value="bike" selected>bike</option>
<option value="drive">drive (vans)</option>
</select>
</span>
<button id="routeBtn" class="pill">Preview route</button>
</div>
</header>
<div id="map"></div>
<script type="module" src="/src/map.js"></script>
</body>
</html>