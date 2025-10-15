<?php include __DIR__ . "/../includes/header.php"; ?>
<?php include __DIR__ . "/../includes/nav.php"; ?>
<main class="container py-4">
  <div class="p-4 bg-white border rounded-4">
    <h1 class="h4 mb-2">Autonomous Delivery Vehicles — Planner</h1>
    <?php if (!empty($_SESSION['user'])): ?>
      <p class="mb-0">You’re logged in as <strong><?= htmlspecialchars($_SESSION['user']['name']) ?></strong> (<?= htmlspecialchars($_SESSION['user']['email']) ?>).</p>
    <?php else: ?>
      <p class="mb-0"><a href="login.php">Log in</a> or <a href="signup.php">create an account</a> to continue.</p>
    <?php endif; ?>
  </div>
</main>
<?php include __DIR__ . "/../includes/footer.php"; ?>
