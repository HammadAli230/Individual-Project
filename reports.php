<?php require_once __DIR__ . '/includes/header.php'; ?>
<div class="container">
  <div class="card">
    <h2>Reports</h2>
    <p class="muted">Your recent routes (saved locally in your browser). Use <b>Export CSV</b> on the Map page for a download.</p>
    <table id="reportTable">
      <thead><tr><th>When</th><th>Mode</th><th>Distance (km)</th><th>Duration (min)</th><th>CO₂e (g)</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</div>
<script>
  const rows = JSON.parse(localStorage.getItem('adv_reports') || '[]');
  const tbody = document.querySelector('#reportTable tbody');
  if (!rows.length) {
    const tr = document.createElement('tr'); tr.innerHTML = '<td colspan="5" class="muted">No routes yet.</td>'; tbody.appendChild(tr);
  } else {
    rows.forEach(r => {
      const tr = document.createElement('tr');
      const km = (r.distance_m/1000).toFixed(2);
      const min = (r.travel_s/60).toFixed(0);
      const co2 = (r.emissions_g).toFixed(0);
      tr.innerHTML = `<td>${new Date(r.at).toLocaleString()}</td><td>${r.mode}</td><td>${km}</td><td>${min}</td><td>${co2}</td>`;
      tbody.appendChild(tr);
    });
  }
</script>
<style>
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #eee; text-align: left; }
  thead th { position: sticky; top: 0; background: #fafafa; }
</style>
