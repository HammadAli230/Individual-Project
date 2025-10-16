<?php require_once __DIR__ . "/config.php"; ?>
<nav class="navbar navbar-expand-lg bg-white border-bottom">
  <div class="container-fluid">
    <a class="navbar-brand fw-semibold" href="index.php">ADV</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav" aria-controls="nav" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="nav">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0">
        <li class="nav-item"><a class="nav-link" href="map.php">Map</a></li>
        <li class="nav-item"><a class="nav-link" href="scenarios.php">Scenarios</a></li>
        <li class="nav-item"><a class="nav-link" href="vehicles.php">Vehicles</a></li>
        <li class="nav-item"><a class="nav-link" href="reports.php">Reports</a></li>
      </ul>
      <div class="d-flex gap-2">
        <a class="btn btn-outline-secondary btn-sm" href="login.php">Login</a>
        <a class="btn btn-primary btn-sm" href="signup.php">Sign up</a>
      </div>
    </div>
  </div>
</nav>
