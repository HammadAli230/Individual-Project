<?php
// api/traffic.php — Summarize congestion in a bbox using TomTom Flow Segment Data.
// DEV ONLY (protect your key in production).
header('Content-Type: application/json');

require_once __DIR__ . '/../includes/config.php';

// Get the API key from config or env
$key = isset($TOMTOM_API_KEY) && $TOMTOM_API_KEY ? $TOMTOM_API_KEY : getenv('TOMTOM_API_KEY');
if (!$key) {
  http_response_code(500);
  echo json_encode(['error' => 'Missing TOMTOM_API_KEY (set in includes/config.php or env).']);
  exit;
}

$bbox = $_GET['bbox'] ?? null; // "minLon,minLat,maxLon,maxLat"
if (!$bbox) {
  http_response_code(400);
  echo json_encode(['error' => 'bbox required: minLon,minLat,maxLon,maxLat']);
  exit;
}

list($minLon, $minLat, $maxLon, $maxLat) = array_map('floatval', explode(',', $bbox));

// Sample a small grid of points in the bbox
$nx = 4; $ny = 4;
$samples = [];
for ($i = 0; $i < $nx; $i++) {
  for ($j = 0; $j < $ny; $j++) {
    $lat = $minLat + ($maxLat - $minLat) * ($j + 0.5) / $ny;
    $lon = $minLon + ($maxLon - $minLon) * ($i + 0.5) / $nx;
    $samples[] = [$lat, $lon];
  }
}

function http_get_json($url) {
  $ch = curl_init();
  curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 15
  ]);
  $resp = curl_exec($ch);
  $err  = curl_error($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($resp === false) return [null, $err, $code];
  return [json_decode($resp, true), null, $code];
}

$ratios = []; // currentSpeed / freeFlowSpeed
foreach ($samples as [$lat, $lon]) {
  $url = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
       . "?key={$key}&point={$lat},{$lon}";
  [$data, $err, $code] = http_get_json($url);
  if (!$data || !isset($data['flowSegmentData'])) continue;

  $fsd  = $data['flowSegmentData'];
  $free = max(1, floatval($fsd['freeFlowSpeed'] ?? 0));
  $curr = floatval($fsd['currentSpeed'] ?? 0);
  if ($free > 0 && $curr >= 0) {
    $ratios[] = min(1.0, $curr / $free); // cap at 1
  }
}

if (!count($ratios)) {
  echo json_encode(['avgCongestionPct' => null, 'samples' => 0]);
  exit;
}

$avgRatio = array_sum($ratios) / count($ratios);
$avgCongestion = round((1 - $avgRatio) * 100); // % slower than free-flow

echo json_encode([
  'avgCongestionPct' => $avgCongestion,
  'samples' => count($ratios)
]);
