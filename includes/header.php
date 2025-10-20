<?php
require_once __DIR__ . '/config.php';
$path = $_SERVER['PHP_SELF'] ?? '';
function active($needle) {
  $p = $_SERVER['PHP_SELF'] ?? '';
  return (strpos($p, $needle) !== false) ? 'active' : '';
}
?>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --border:#e5e7eb; --text:#111827; --muted:#6b7280; --blue:#2563eb; }
  html, body { height: 100%; margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: var(--text); background: var(--bg); }
  .navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #fff; border-bottom: 1px solid var(--border); }
  .navwrap { max-width: 1200px; margin: 0 auto; display:flex; align-items:center; gap:18px; padding: 10px 16px; }
  .brand { font-weight: 800; letter-spacing: .5px; }
  .nav { display:flex; gap:16px; }
  .nav a { text-decoration: none; color: #374151; padding:6px 10px; border-radius: 8px; }
  .nav a.active, .nav a:hover { background:#f3f4f6; color:#111827; }
  .cta { margin-left:auto; display:flex; gap:10px; }
  .btn { padding: 8px 12px; border-radius: 10px; border:1px solid var(--border); background:#fff; color:#111827; text-decoration:none; }
  .btn:hover { background:#f9fafb; }
  .btn.primary { background: var(--blue); color:#fff; border-color: transparent; }
  .container { max-width: 1200px; margin: 0 auto; padding: 18px 16px; }
  .card { background: var(--card); border:1px solid var(--border); border-radius: 16px; padding: 24px; }
  .muted { color: var(--muted); }
</style>
<div class="navbar">
  <div class="navwrap">
    <div class="brand">ADV</div>
    <nav class="nav">
      <a class="<?php echo active('map.php'); ?>" href="/Individual-Project/map.php">Map</a>
      <a class="<?php echo active('scenarios.php'); ?>" href="/Individual-Project/scenarios.php">Scenarios</a>
      <a class="<?php echo active('vehicles.php'); ?>" href="/Individual-Project/vehicles.php">Vehicles</a>
      <a class="<?php echo active('reports.php'); ?>" href="/Individual-Project/reports.php">Reports</a>
    </nav>
    <div class="cta">
      <a href="#" class="btn">Login</a>
      <a href="#" class="btn primary">Sign up</a>
    </div>
  </div>
</div>
