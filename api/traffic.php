<?php
require_once __DIR__ . '/../includes/config.php';
header('Content-Type: application/json');

$bbox = $_GET['bbox'] ?? null; // west,south,east,north
if (!$bbox || !$TOMTOM_API_KEY || strpos($TOMTOM_API_KEY, 'YOUR_') === 0) {
  echo json_encode(['avgCongestionPct' => null, 'samples' => 0, 'note' => 'no_key_or_bbox']);
  exit;
}

// Sample 4 tiles within bbox to estimate congestion
list($w, $s, $e, $n) = array_map('floatval', explode(',', $bbox));
$cx = ($w + $e) / 2.0;
$cy = ($s + $n) / 2.0;
$pts = [
  [$cy, $cx],
  [$cy + 0.01, $cx],
  [$cy - 0.01, $cx],
  [$cy, $cx + 0.01],
];

$samples = 0;
$total = 0;
foreach ($pts as $p) {
  $lat = $p[0]; $lon = $p[1];
  $url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json?point={$lat},{$lon}&unit=KMPH&key={$TOMTOM_API_KEY}";
  $json = @file_get_contents($url);
  if ($json !== false) {
    $obj = json_decode($json, true);
    if (isset($obj['flowSegmentData']['currentSpeed']) && isset($obj['flowSegmentData']['freeFlowSpeed'])) {
      $cur = max(1, floatval($obj['flowSegmentData']['currentSpeed']));
      $free = max(1, floatval($obj['flowSegmentData']['freeFlowSpeed']));
      $pct = max(0, min(100, round((1 - $cur/$free)*100)));
      $total += $pct; $samples++;
    }
  }
}

if ($samples === 0) {
  echo json_encode(['avgCongestionPct' => null, 'samples' => 0]);
} else {
  echo json_encode(['avgCongestionPct' => round($total/$samples), 'samples' => $samples]);
}
