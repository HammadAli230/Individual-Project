<?php
require_once __DIR__ . '/../config/database/db_connection.php';
session_start();

$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $name = trim($_POST['name'] ?? '');
  $email = trim($_POST['email'] ?? '');
  $password = $_POST['password'] ?? '';

  if ($name === '' || $email === '' || $password === '') {
    $errors[] = 'All fields are required.';
  } else {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
      $errors[] = 'Email is already registered.';
    } else {
      $hash = password_hash($password, PASSWORD_DEFAULT);
      $insert = $pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
      $insert->execute([$name, $email, $hash]);
      header('Location: login.php');
      exit;
    }
  }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="static/style.css">
</head>
<body class="bg-light">
<div class="container py-5" style="max-width:560px">
  <div class="card shadow-sm">
    <div class="card-body">
      <h1 class="h4 mb-3">Create an Account</h1>

      <?php if ($errors): ?>
        <div class="alert alert-danger">
          <ul class="mb-0">
            <?php foreach ($errors as $err): ?><li><?= htmlspecialchars($err) ?></li><?php endforeach; ?>
          </ul>
        </div>
      <?php endif; ?>

      <form method="post">
        <div class="mb-3">
          <label class="form-label">Name</label>
          <input class="form-control" type="text" name="name" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Email</label>
          <input class="form-control" type="email" name="email" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Password</label>
          <input class="form-control" type="password" name="password" required>
        </div>
        <button class="btn btn-success w-100" type="submit">Sign Up</button>
        <p class="mt-3 mb-0 text-center">
          <a href="login.php">Already have an account?</a>
        </p>
      </form>
    </div>
  </div>
</div>
</body>
</html>
