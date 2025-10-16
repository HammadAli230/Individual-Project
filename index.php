<?php include __DIR__ . "/includes/header.php"; ?>
<?php include __DIR__ . "/includes/nav.php"; ?>
<main class="container py-4">
  <div class="row g-4">
    <div class="col-12 col-lg-8">
      <div class="p-4 bg-white border rounded-4">
        <h1 class="h3 mb-3">Autonomous Delivery Vehicles — Planner</h1>
        <p class="text-muted mb-4">
          Plan and compare last-mile delivery using vans, e-cargo bikes, and sidewalk robots.
          Use the Map to preview routes and evaluate scenarios.
        </p>
        <a href="map.php" class="btn btn-primary">Open Map</a>
      </div>
    </div>
    <div class="col-12 col-lg-4">
      <div class="p-4 bg-white border rounded-4">
        <h2 class="h5">Quick KPIs</h2>
        <ul class="list-unstyled small mb-0">
          <li>On-time deliveries: <strong>—</strong></li>
          <li>CO₂e per parcel: <strong>—</strong></li>
          <li>Avg. route length: <strong>—</strong></li>
        </ul>
      </div>
    </div>
  </div>
</main>
<?php include __DIR__ . "/includes/footer.php"; ?>
