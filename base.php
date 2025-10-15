<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{{ title or "Auth System" }}</title>
  <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
</head>
<body>
  <main>
    <header>
      <h1>Signup & Login System</h1>
      {% if session.user %}
        <a href="{{ url_for('logout') }}">Logout</a>
      {% else %}
        <a href="{{ url_for('signup') }}">Signup</a>
        <a href="{{ url_for('login') }}">Login</a>
      {% endif %}
    </header>
    {% with messages = get_flashed_messages() %}
      {% if messages %}
        <div class="card">
          {% for m in messages %}<p>{{ m }}</p>{% endfor %}
        </div>
      {% endif %}
    {% endwith %}
    {% block content %}{% endblock %}
  </main>
</body>
</html>
