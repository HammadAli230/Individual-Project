<?php
require_once __DIR__ . '/../config/database/db_connection.php';
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $email = trim($_POST['email'] ?? '');
  $password = $_POST['password'] ?? '';

  if ($email === '' || $password === '') {
    $errors[] = 'Please enter both email and password.';
  } else {
    $stmt = $pdo->prepare('SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
      session_regenerate_id(true);
      $_SESSION['user'] = ['id'=>$user['id'], 'name'=>$user['name'], 'email'=>$user['email']];
      header('Location: index.php'); exit;
    } else {
      $errors[] = 'Invalid email or password.';
    }
  }
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login — ADV</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- your custom styles (relative to /public) -->
  <link rel="stylesheet" href="static/style.css">
</head>
<body class="bg-surface">

  <!-- simple top bar -->
  <nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
    <div class="container">
      <a class="navbar-brand fw-semibold" href="index.php">ADV</a>
      <div class="ms-auto">
        <a class="btn btn-outline-primary btn-sm" href="signup.php">Sign up</a>
      </div>
    </div>
  </nav>

  <!-- centered card -->
  <main class="d-flex align-items-center min-vh-100 py-5">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-12 col-sm-10 col-md-7 col-lg-5">
          <div class="card shadow-lg soft-rounded">
            <div class="card-body p-4 p-md-5">
              <h1 class="h3 fw-bold mb-3 text-center">Login</h1>
              <p class="text-secondary text-center mb-4">Welcome back — sign in to continue.</p>

              <?php if ($errors): ?>
                <div class="alert alert-danger">
                  <ul class="mb-0">
                    <?php foreach ($errors as $err): ?>
                      <li><?= htmlspecialchars($err) ?></li>
                    <?php endforeach; ?>
                  </ul>
                </div>
              <?php endif; ?>

              <form method="post" novalidate>
                <div class="mb-3">
                  <label for="email" class="form-label">Email</label>
                  <input id="email" class="form-control form-control-lg" type="email" name="email" required>
                </div>
                <div class="mb-3">
                  <label for="password" class="form-label">Password</label>
                  <input id="password" class="form-control form-control-lg" type="password" name="password" required>
                </div>

                <button class="btn btn-primary btn-lg w-100 mt-2" type="submit">Log in</button>
              </form>

              <div class="text-center mt-3">
                <span class="text-secondary">No account?</span>
                <a href="signup.php" class="link-primary">Create one</a>
              </div>
            </div>
          </div>

          <p class="text-center text-secondary mt-4 small">Autonomous Delivery Vehicles</p>
        </div>
      </div>
    </div>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
