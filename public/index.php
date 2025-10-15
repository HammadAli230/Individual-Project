{% extends "base.html" %}
{% block content %}
  {% if user %}
    <div class="card">
      <p>Welcome, <strong>{{ user.name }}</strong> ({{ user.email }})</p>
    </div>
  {% else %}
    <div class="card">
      <p><a href="{{ url_for('signup') }}">Create an account</a> or <a href="{{ url_for('login') }}">log in</a>.</p>
    </div>
  {% endif %}
{% endblock %}
