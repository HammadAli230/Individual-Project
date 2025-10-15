from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3, re, os

app = Flask(__name__)
app.secret_key = "supersecretkey"  # change this in production


# --- Database setup ---
def get_db():
    conn = sqlite3.connect("users.db")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
    )
    """)
    conn.commit()
    conn.close()

init_db()


# --- Validators ---
def valid_name(name):
    return name and 2 <= len(name.strip()) <= 100

def valid_email(email):
    return re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email)

def valid_password(password):
    return password and len(password) >= 8


# --- Routes ---
@app.route("/")
def index():
    user = session.get("user")
    return render_template("index.html", user=user)


@app.route("/signup", methods=["GET", "POST"])
def signup():
    errors = []
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm", "")

        if not valid_name(name): errors.append("Name must be 2–100 characters.")
        if not valid_email(email): errors.append("Invalid email address.")
        if not valid_password(password): errors.append("Password must be at least 8 characters.")
        if password != confirm: errors.append("Passwords do not match.")

        if not errors:
            try:
                conn = get_db()
                if conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone():
                    errors.append("Email is already registered.")
                else:
                    hash_pw = generate_password_hash(password)
                    conn.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                                 (name, email, hash_pw))
                    conn.commit()
                    session["user"] = {"name": name, "email": email}
                    return redirect(url_for("index"))
            except Exception as e:
                errors.append("Server error, please try again.")
            finally:
                conn.close()
    return render_template("signup.html", errors=errors)


@app.route("/login", methods=["GET", "POST"])
def login():
    errors = []
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        try:
            conn = get_db()
            user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
            conn.close()

            if not user or not check_password_hash(user["password_hash"], password):
                errors.append("Invalid email or password.")
            else:
                session["user"] = {"name": user["name"], "email": user["email"]}
                return redirect(url_for("index"))
        except Exception:
            errors.append("Server error, please try again.")
    return render_template("login.html", errors=errors)


@app.route("/logout")
def logout():
    session.pop("user", None)
    flash("Logged out successfully.")
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run(debug=True)
