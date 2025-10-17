<?php include __DIR__ . "/includes/header.php"; ?>
<?php include __DIR__ . "/includes/nav.php"; ?>

<main class="container-fluid py-3">
  <div class="row">
    <!-- Sidebar -->
    <div class="col-12 col-lg-3">
      <div class="p-3 bg-white border rounded-4 mb-3 shadow-sm">
        <h2 class="h6 mb-3">Route Preview</h2>

        <!-- City / Place (UI only) -->
        <div class="mb-2">
          <label class="form-label">City / Place</label>
          <input id="place" class="form-control form-control-sm" value="Birmingham, UK">
        </div>

        <!-- Mode selection -->
        <div class="mb-2">
          <label class="form-label">Mode</label>
          <select id="mode" class="form-select form-select-sm">
            <option value="walk">Walk (robots)</option>
            <option value="bike" selected>Bike (e-cargo)</option>
            <option value="drive">Drive (vans)</option>
          </select>
        </div>

        <!-- Actions -->
        <div class="d-grid gap-2 mb-2">
          <button id="routeBtn" class="btn btn-primary btn-sm">Preview Route</button>
          <button id="clearBtn" class="btn btn-outline-secondary btn-sm">Clear</button>
        </div>

        <div class="d-grid gap-2 mb-3">
          <button id="locateBtn" class="btn btn-outline-success btn-sm">📍 Use My Location</button>
        </div>

        <div class="d-flex align-items-center gap-2 small mb-2">
          <span class="badge rounded-pill text-bg-secondary" id="trafficBadge">Traffic: —</span>
          <span class="text-muted" id="trafficNote"></span>
        </div>

        <!-- Simulation -->
        <div class="d-grid gap-2 mb-2">
          <button id="simStartBtn" class="btn btn-success btn-sm" disabled>▶ Start Simulation</button>
          <button id="simPauseBtn" class="btn btn-warning btn-sm" disabled>⏸ Pause</button>
        </div>

        <!-- Stats -->
        <div class="mt-2 small">
          <div><strong>Distance:</strong> <span id="statDistance">—</span></div>
          <div><strong>ETA:</strong> <span id="statEta">—</span></div>
          <div><strong>Emissions:</strong> <span id="statCo2">—</span></div>
        </div>

        <div class="d-grid gap-2 my-2">
          <button id="compareBtn" class="btn btn-outline-primary btn-sm">Compare Modes (walk/bike/drive)</button>
          <button id="exportBtn" class="btn btn-outline-dark btn-sm">Export CSV</button>
        </div>

        <div id="comparePanel" class="small"></div>

        <!-- Multi-stop -->
        <div class="mt-2">
          <label class="form-label small mb-1">Multi-stop (lat,lon; …)</label>
          <textarea id="stops" class="form-control form-control-sm" rows="2"
            placeholder="52.486,-1.89;52.492,-1.88"></textarea>
          <div class="d-grid gap-2 mt-2">
            <button id="multiBtn" class="btn btn-outline-success btn-sm">Route Multi-Stop</button>
          </div>
        </div>

        <hr>
        <div class="small text-muted" id="simStatus">No route loaded.</div>

        <p class="small text-muted mb-0 mt-2">
          Click the map to set <strong>Start</strong> (1st click) and <strong>End</strong> (2nd click).<br>
          Drag markers to fine-tune, then click <em>Preview Route</em>. Use ▶ to animate.
        </p>
      </div>
    </div>

    <!-- Map -->
    <div class="col-12 col-lg-9">
      <div id="map" class="rounded-4 border shadow-sm" style="height: calc(100vh - 160px)"></div>
    </div>
  </div>
</main>

<?php include __DIR__ . "/includes/footer.php"; ?>
<script src="public/js/map.js"></script>
