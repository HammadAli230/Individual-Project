<?php include __DIR__ . "/includes/header.php"; ?>
<?php include __DIR__ . "/includes/nav.php"; ?>

<main class="container-fluid py-3">
  <div class="row">
    <!-- Sidebar -->
    <div class="col-12 col-lg-3">
      <div class="p-3 bg-white border rounded-4 mb-3 shadow-sm">
        <h2 class="h6 mb-3">Route Preview</h2>

        <!-- City / Place -->
        <div class="mb-2">
          <label class="form-label" for="place">City / Place</label>
          <input id="place" class="form-control form-control-sm" value="Birmingham, UK" />
        </div>

        <!-- Mode selection -->
        <div class="mb-2">
          <label class="form-label" for="mode">Mode</label>
          <select id="mode" class="form-select form-select-sm">
            <option value="walk">Walk (robots)</option>
            <option value="bike" selected>Bike (e-cargo)</option>
            <option value="drive">Drive (vans)</option>
          </select>
        </div>

        <!-- Action buttons -->
        <div class="d-grid gap-2 mb-2">
          <button id="routeBtn" class="btn btn-primary btn-sm">Preview Route</button>
          <button id="clearBtn" class="btn btn-outline-secondary btn-sm">Clear</button>
        </div>

        <!-- Location -->
        <div class="d-grid gap-2 mb-3">
          <button id="locateBtn" class="btn btn-outline-success btn-sm">📍 Use My Location</button>
        </div>

        <hr class="my-2">

        <!-- Simulation Controls -->
        <div class="d-grid gap-2 mb-2">
          <button id="simStartBtn" class="btn btn-success btn-sm" disabled>▶ Start Simulation</button>
          <button id="simPauseBtn" class="btn btn-warning btn-sm" disabled>⏸ Pause</button>
        </div>

        <!-- Live Traffic Badge -->
        <div class="d-flex align-items-center gap-2 small mb-2">
          <span class="badge rounded-pill text-bg-secondary" id="trafficBadge">Traffic: —</span>
          <span class="text-muted" id="trafficNote"></span>
        </div>

        <!-- Status (ARIA live for screen readers) -->
        <div class="small text-muted mb-3" id="simStatus" aria-live="polite">No route loaded.</div>

        <hr>

        <p class="small text-muted mb-0">
          Click the map to set <strong>Start</strong> (1st click) and <strong>End</strong> (2nd click).<br>
          Drag markers to fine-tune, then click <em>Preview Route</em>.<br>
          Use ▶ to animate along the route.<br>
          Traffic badge shows live congestion in your current view.
        </p>
      </div>
    </div>

    <!-- Map Area -->
    <div class="col-12 col-lg-9">
      <div id="map" class="rounded-4 border shadow-sm" style="height: calc(100vh - 160px)"></div>
    </div>
  </div>
</main>

<?php include __DIR__ . "/includes/footer.php"; ?>
<script src="public/js/map.js"></script>
