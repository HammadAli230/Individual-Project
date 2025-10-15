<?php
require_once __DIR__ . "/../config/config.php";
session_start();
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $email = trim($_POST['email'] ?? '');
  $password = $_POST['password'] ?? '';

  if ($email === '' || $password === '') {
    $errors[] = 'Please enter both email and password.';
  } else {
    try {
      $pdo = pdo_conn();
      $stmt = $pdo->prepare('SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1');
      $stmt->execute([$email]);
      $user = $stmt->fetch();
      if ($user && password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user'] = ['id'=>$user['id'],'name'=>$user['name'],'email'=>$user['email']];
        header('Location: '.$BASE_PATH.'/public/index.php'); exit;
      }
      $errors[] = 'Invalid email or password.';
    } catch (Throwable $e) {
      $errors[] = 'Database error.';
    }
  }
}
include __DIR__ . "/../includes/header.php";
include __DIR__ . "/../includes/nav.php";
?>
<main class="container py-4">
  <div class="p-4 bg-white border rounded-4">
    <h1 class="h4 mb-3">Login</h1>
    <?php if ($errors): ?>
      <div class="alert alert-danger"><ul class="mb-0"><?php foreach ($errors as $e): ?><li><?= htmlspecialchars($e) ?></li><?php endforeach; ?></ul></div>
    <?php endif; ?>
    <form method="post" novalidate>
      <div class="mb-3">
        <label class="form-label">Email</label>
        <input class="form-control" type="email" name="email" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Password</label>
        <input class="form-control" type="password" name="password" required>
      </div>
      <button class="btn btn-primary" type="submit">Log in</button>
      <a class="btn btn-link" href="signup.php">Create an account</a>
    </form>
  </div>
</main>
<?php include __DIR__ . "/../includes/footer.php"; ?>
