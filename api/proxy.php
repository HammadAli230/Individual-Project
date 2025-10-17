<?php
require_once __DIR__ . '/../includes/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path   = $_GET['path'] ?? '';
$query  = $_GET;
unset($query['path']);

$url = rtrim($API_BASE, '/') . '/' . ltrim($path, '/');
if ($method === 'GET' && !empty($query)) {
  $url .= '?' . http_build_query($query);
}

set_time_limit(300); // allow slow cold-starts

$ch = curl_init($url);
$headers = ['Accept: application/json'];

if ($method === 'POST') {
  curl_setopt($ch, CURLOPT_POST, true);
  // forward raw body or form fields
  if (!empty($_POST)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $_POST);
  } else {
    $raw = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $raw);
    $headers[] = 'Content-Type: application/json';
  }
}

curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_HTTPHEADER     => $headers,
  CURLOPT_CONNECTTIMEOUT => 30,
  CURLOPT_TIMEOUT        => 300,
]);

$body = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

http_response_code($http ?: 502);
header('Content-Type: application/json');

if ($body !== false && $http >= 200 && $http < 300) {
  echo $body;
} else {
  echo json_encode([
    'ok'    => false,
    'http'  => $http ?: 0,
    'error' => $err ?: 'proxy_failed_or_timed_out',
    'url'   => $url,
    'method'=> $method,
  ]);
}
