<?php
session_start();
if (!isset($_SESSION['user'])) {
  header("Location: login.php");
  exit;
}
$user = $_SESSION['user'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome <?= htmlspecialchars($user['name']) ?></title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="static/style.css">
</head>
<body class="bg-light">
<div class="container py-5 text-center">
  <h1 class="mb-4">Welcome, <?= htmlspecialchars($user['name']) ?>!</h1>
  <p>This will become your ADV dashboard.</p>
  <a class="btn btn-danger" href="logout.php">Logout</a>
</div>
</body>
</html>
