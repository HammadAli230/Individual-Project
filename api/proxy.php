<?php
require_once __DIR__ . '/../includes/config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path   = isset($_GET['path']) ? $_GET['path'] : '';

$base = rtrim($API_BASE ?? 'http://127.0.0.1:8000', '/');
$target = $base . '/' . ltrim($path, '/');

$raw_qs = $_SERVER['QUERY_STRING'] ?? '';
if ($raw_qs !== '') {
  $raw_qs = preg_replace('/(^|&)path=[^&]*/', '$1', $raw_qs, 1);
  $raw_qs = trim($raw_qs, '&');
  if ($raw_qs !== '') {
    $target .= '?' . $raw_qs;
  }
}

set_time_limit(300);

$forward_headers = [];
foreach ($_SERVER as $k => $v) {
  if (strpos($k, 'HTTP_') === 0) {
    $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($k, 5)))));
    if (in_array($name, ['Host', 'Content-Length'])) continue;
    $forward_headers[] = $name . ': ' . $v;
  }
}
if (!empty($_SERVER['CONTENT_TYPE'])) {
  $forward_headers[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}
if (!preg_grep('/^Accept:/i', $forward_headers)) {
  $forward_headers[] = 'Accept: application/json';
}

$ch = curl_init($target);

$body_to_send = null;
switch (strtoupper($method))
