<?php
require_once __DIR__ . '/../includes/config.php';
$path = $_GET['path'] ?? '/health';
$qs = $_GET; unset($qs['path']);
$ch = curl_init();
$url = rtrim($API_BASE, '/') . $path . (count($qs) ? ('?' . http_build_query($qs)) : '');
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);
header('Content-Type: application/json');
if ($response === false) { http_response_code(502); echo json_encode(['error'=>'Bad Gateway','detail'=>$err]); exit; }
http_response_code($httpcode ?: 200); echo $response;
