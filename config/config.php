<?php
// Where the site lives (adjust if your URL changes)
$BASE_PATH = "/Individual-Project";   // e.g., http://localhost/Individual-Project

// Site name
$SITE_NAME = "ADV — Autonomous Delivery Vehicles";

// MySQL (phpMyAdmin / XAMPP defaults)
const DB_HOST = '127.0.0.1';
const DB_NAME = 'fyp_app';
const DB_USER = 'root';
const DB_PASS = '';
const DB_CHARSET = 'utf8mb4';

// PDO helper
function pdo_conn(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $dsn = 'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset='.DB_CHARSET;
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  return $pdo;
}
