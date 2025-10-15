<?php
require_once __DIR__ . "/../config/config.php";
session_start();
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $name = trim($_POST['name'] ?? '');
  $email = trim($_POST['email'] ?? '');
  $password = $_POST['password'] ?? '';
  $password2 = $_POST['password2'] ?? '';

  if (strlen($name) < 2) $errors[] = 'Name must be at least 2 characters.';
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Invalid email.';
  if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';
  if ($password !== $password2) $errors[] = 'Passwords do not match.';

  if (!$errors) {
    try {
      $pdo = pdo_conn();
      $exists = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
      $exists->execute([$email]);
      if ($exists->fetch()) {
        $errors[] = 'Email is already registered.';
      } else {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $pdo->prepare('INSERT INTO users (name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())')
            ->execute([$name, $email, $hash]);
        $_SESSION['user'] = ['id'=>$pdo->lastInsertId(),'name'=>$name,'email'=>$email];
        header('Location: '.$BASE_PATH.'/public/index.php'); exit;
      }
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
    <h1 class="h4 mb-3">Create an account</h1>
    <?php if ($errors): ?>
      <div class="alert alert-danger"><ul class="mb-0"><?php foreach ($errors as $e): ?><li><?= htmlspecialchars($e) ?></li><?php endforeach; ?></ul></div>
    <?php endif; ?>
    <form method="post" novalidate>
      <div class="mb-3">
        <label class="form-label">Full name</label>
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
      <div class="mb-3">
        <label class="form-label">Confirm password</label>
        <input class="form-control" type="password" name="password2" required>
      </div>
      <button class="btn btn-primary" type="submit">Create account</button>
      <a class="btn btn-link" href="login.php">Already have an account?</a>
    </form>
  </div>
</main>
<?php include __DIR__ . "/../includes/footer.php"; ?>
