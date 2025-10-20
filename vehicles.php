<?php require_once __DIR__ . '/includes/header.php'; ?>
<div class="container">
  <div class="card">
    <h2>Vehicle profile</h2>
    <p class="muted">These values tweak CO₂e estimates shown on the Map page.</p>
    <div class="grid">
      <label>Type
        <select id="vehType">
          <option value="car">Car (petrol)</option>
          <option value="diesel">Car (diesel)</option>
          <option value="van">Van</option>
          <option value="ev">EV</option>
          <option value="bike">Bike</option>
        </select>
      </label>
      <label>Emission factor (g/km)
        <input id="vehEF" type="number" step="1" value="180">
      </label>
      <label>Idle penalty (%)
        <input id="vehIdle" type="number" step="1" value="5">
      </label>
    </div>
    <button id="saveVeh" class="btn primary">Save</button>
    <span id="saved" class="muted" style="margin-left:8px; display:none;">Saved ✓</span>
  </div>
</div>
<script>
  const defaults = { type:'car', ef_gpkm: 180, idle_pct: 5 };
  const cur = JSON.parse(localStorage.getItem('adv_vehicle') || 'null') || defaults;
  const typeEl = document.getElementById('vehType');
  const efEl   = document.getElementById('vehEF');
  const idleEl = document.getElementById('vehIdle');
  typeEl.value = cur.type || defaults.type;
  efEl.value = cur.ef_gpkm || defaults.ef_gpkm;
  idleEl.value = cur.idle_pct || defaults.idle_pct;
  document.getElementById('saveVeh').addEventListener('click', () => {
    const obj = { type: typeEl.value, ef_gpkm: Number(efEl.value), idle_pct: Number(idleEl.value) };
    localStorage.setItem('adv_vehicle', JSON.stringify(obj));
    document.getElementById('saved').style.display = 'inline';
    setTimeout(() => document.getElementById('saved').style.display = 'none', 1500);
  });
</script>
<style>
  .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 10px 0 16px; }
  .btn { padding: 8px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background:#fff; cursor:pointer; }
  .btn.primary { background:#2563eb; color:#fff; border-color:#2563eb; }
</style>
