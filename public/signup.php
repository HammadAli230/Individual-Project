{% extends "base.html" %}
{% block content %}
<h2>Create an account</h2>
{% if errors %}
  <div class="card"><ul>{% for e in errors %}<li>{{ e }}</li>{% endfor %}</ul></div>
{% endif %}
<form method="post">
  <label>Name</label>
  <input type="text" name="name" required>
  <label>Email</label>
  <input type="email" name="email" required>
  <label>Password</label>
  <input type="password" name="password" required>
  <label>Confirm Password</label>
  <input type="password" name="confirm" required>
  <button type="submit">Sign Up</button>
</form>
{% endblock %}
