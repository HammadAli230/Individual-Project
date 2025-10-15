<?php
// (Optional while debugging)
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../config/config.php';  // connect to DB
session_start();

$errors = [];

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($email === '' || $password === '') {
        $errors[] = 'Please enter both email and password.';
    } else {
        try {
            // connect to database
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);

            // check if email exists
            $stmt = $pdo->prepare('SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password_hash'])) {
                // success: set session
                $_SESSION['user'] = [
                    'id' => $user['id'],
                    'name' => $user['name'],
                    'email' => $user['email']
                ];
                header('Location: index.php');
                exit;
            } else {
                $errors[] = 'Invalid email or password.';
            }
        } catch (PDOException $e) {
            $errors[] = 'Database error: ' . htmlspecialchars($e->getMessage());
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <link rel="stylesheet" href="static/style.css">
</head>
<body>
  <main>
    <h1>Login</h1>

    <?php if ($errors): ?>
      <div class="card">
        <ul>
          <?php foreach ($errors as $err): ?>
            <li><?= htmlspecialchars($err) ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    <?php endif; ?>

    <form method="post" novalidate>
      <label>Email:</label>
      <input type="email" name="email" required>

      <label>Password:</label>
      <input type="password" name="password" required>

      <button type="submit">Log In</button>
      <p>Don’t have an account? <a href="signup.php">Sign up here</a>.</p>
    </form>
  </main>
</body>
</html>
            