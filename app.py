from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from supabase import create_client
import os
from dotenv import load_dotenv
import json
import requests

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
USDA_API_KEY = os.getenv("USDA_API_KEY")

# Create Supabase clients
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

@app.route("/")
def home():
    return render_template("index.html")

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route("/auth-redirect")
def auth_redirect():
    return render_template("auth-redirect.html", 
        SUPABASE_URL=SUPABASE_URL, 
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
    )

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        try:
            response = supabase.auth.sign_in_with_password({"email": email, "password": password})
            if response and hasattr(response, 'user') and response.user:
                session['user_id'] = response.user.id
                session['email'] = response.user.email
                session['member_since'] = response.user.created_at.strftime("%B %Y") if response.user.created_at else "Unknown"
                session['access_token'] = response.session.access_token if response.session else None
                session['refresh_token'] = response.session.refresh_token if response.session else None
                session.permanent = True
                flash("✅ Login Successful!", "success")
                return redirect(url_for('dashboard'))
            flash("❌ Invalid email or password. Please try again.", "danger")
        except Exception as e:
            print("Login error:", e)
            flash("❌ Something went wrong. Please try again later.", "danger")
    return render_template('login.html', SUPABASE_URL=SUPABASE_URL, SUPABASE_ANON_KEY=SUPABASE_ANON_KEY)

@app.route("/session", methods=["POST"])
def store_session():
    data = request.get_json()
    user_id = data.get("user_id")
    email = data.get("email")

    if user_id:
        session["user_id"] = user_id
        session["email"] = email
        print("✅ Session set via JS for user:", email)
        return jsonify({"message": "Session stored"}), 200
    else:
        print("❌ No user_id provided in /session")
        return jsonify({"error": "user_id missing"}), 400

@app.route('/logout')
def logout():
    session.clear()
    flash("✅ Logged out successfully.", "info")
    return redirect(url_for('home'))

@app.route('/profile')
def profile():
    return render_template(
        'profile.html',
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY,
        user={}  # ← This prevents template crash
    )

@app.route('/update_profile', methods=['POST'])
def update_profile():
    user_id = session.get('user_id')
    if not user_id:
        flash("⚠️ Please log in to update your profile.", "warning")
        return render_template("profile.html")

    email = request.form.get('email')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')
    email_notifications = 'email_notifications' in request.form

    if new_password and new_password != confirm_password:
        flash("❌ Passwords do not match. Try again.", "danger")
        return redirect(url_for('profile'))

    try:
        updates = {}
        if email and email != session.get('email'):
            updates['email'] = email
        if new_password:
            updates['password'] = new_password

        if updates:
            supabase_admin.auth.admin.update_user_by_id(user_id, updates)
            if 'email' in updates:
                session['email'] = updates['email']
                flash("✅ Email updated successfully!", "success")
            if 'password' in updates:
                flash("✅ Password updated successfully!", "success")

        session['email_notifications'] = email_notifications
        flash("✅ Preferences updated successfully!", "success")
    except Exception:
        flash("❌ Something went wrong. Please try again.", "danger")

    return redirect(url_for('profile'))

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        try:
            supabase.auth.reset_password_for_email(
                email,
                options={"redirect_to": "http://127.0.0.1:5000/reset_password"}
            )
            flash("✅ If an account with that email exists, a reset link has been sent.", "success")
            return redirect(url_for('login'))
        except Exception:
            flash("❌ Something went wrong. Please try again later.", "danger")
    return render_template('forgot_password.html')

@app.route('/reset_password')
def reset_password():
    return render_template(
        'reset_password.html',
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
    )

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/signup')
def signup():
    return render_template('signup.html')

@app.route('/shopping_list')
def shopping_list():
    return render_template('shopping_list.html')

@app.route('/planselection')
def planselection():
    return render_template('planselection.html')

@app.route('/pantrypost')
def pantrypost():
    return render_template('pantry_post.html')

@app.route('/whyitworks')
def whyitworks():
    return render_template('whyitworks.html')

@app.route('/pantry_project')
def pantry_project():
    return render_template('pantry_project.html')

@app.route('/paymentprocessing')
def payment_processing():
    return render_template('paymentprocessing.html')

@app.route('/success')
def success():
    return render_template('success.html')

@app.route("/macrotracking")
def macro_tracking():
    return render_template(
        "macrotracking.html",
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
    )

@app.route("/macrogoals")
def macro_goals():
    return render_template(
        "macrogoals.html",
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
    )

@app.route('/usda/search')
def usda_search():
    query = request.args.get('query')
    res = requests.get(
        "https://api.nal.usda.gov/fdc/v1/foods/search",
        params={"query": query, "api_key": USDA_API_KEY, "pageSize": 10}
    )
    return jsonify(res.json())

@app.route('/usda/detail')
def usda_detail():
    fdc_id = request.args.get('fdcId')
    res = requests.get(
        f"https://api.nal.usda.gov/fdc/v1/food/{fdc_id}",
        params={"api_key": USDA_API_KEY}
    )
    return jsonify(res.json())
# ---- PantryPal AI endpoint -----------------------------------------------
import os, json
from flask import request, jsonify
import requests

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # set this in your env

@app.route("/api/pantrypal", methods=["POST"])
def pantrypal_api():
    if not OPENAI_API_KEY:
        return jsonify({"error": "Server misconfigured: missing OPENAI_API_KEY"}), 500

    payload = request.get_json(silent=True) or {}
    user_msg = (payload.get("message") or "").strip()
    context = payload.get("context") or {}  # optional: filters, user prefs, pantry, etc.

    if not user_msg:
        return jsonify({"error": "Missing 'message'"}), 400

    # System guardrails
    system_prompt = (
        "You are PantryPal, a friendly, concise cooking assistant for The Happy Pantry. "
        "RULES:\n"
        "- Do NOT generate full recipes or instructions; give short tips only (1–3 bullets).\n"
        "- Prefer actionable outputs the UI can apply: filters (tags/time/macros), simple ingredient swaps, and short justifications.\n"
        "- Stay within site content. No external links. No medical advice.\n"
        "- Keep it supportive, upbeat, and brief.\n"
        "- Return JSON with keys: text (string), actions (object with applyFilters, showRecipes, suggestSwap). "
        "Any of those can be null if not relevant.\n"
        "Examples:\n"
        "{ \"text\": \"Try dairy-free swaps like oat milk + nutritional yeast.\", "
        "\"actions\": {\"applyFilters\": {\"diet\":\"dairy-free\"}, \"showRecipes\": {\"limit\":5}, \"suggestSwap\": {\"from\":\"butter\",\"to\":\"olive oil\"}} }"
    )

    # Build a compact user/context message for the model
    user_prompt = {
        "message": user_msg,
        "context": {
            "activeFilters": context.get("activeFilters"),
            "pantry": context.get("pantry"),
            "favoritesCount": context.get("favoritesCount"),
        }
    }

    # Call OpenAI (simple JSON response, non-streaming)
    # Using Chat Completions-style JSON mode for structured output
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "gpt-4o-mini",  # fast & cheap; swap if you prefer
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_prompt)}
        ],
    }
    r = requests.post(url, headers=headers, json=body, timeout=20)
    if r.status_code != 200:
        return jsonify({"error": "AI call failed", "details": r.text}), 502

    try:
        content = r.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
    except Exception as e:
        # Fallback shape
        data = {"text": "I’m here to help with quick swaps and filters!", "actions": None}

    # Optional: log an event to Supabase later
    return jsonify(data), 200

@app.route('/error')
def error():
    message = request.args.get('message', 'An error occurred during your transaction.')
    return render_template('error.html', message=message)

@app.route('/local-resources')
def local_resources():
    return render_template(
        'local_resources.html',
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
    )

@app.route('/subscribe/<plan_type>')
def subscribe(plan_type):
    if plan_type not in ['monthly', 'yearly']:
        return "Invalid Plan", 404
    return render_template('subscribe.html', plan_type=plan_type)

@app.route('/recipes')
def recipes():
    return render_template(
        'recipes.html',
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY,
        USER_ID=session.get('user_id')
    )

@app.route('/recipes/<slug>')
def recipe_page(slug):
    try:
        response = supabase.table('recipes').select('*').eq('slug', slug).execute()
        data = response.data
        if not data:
            return "❌ No recipe found for that slug.", 404
        if len(data) > 1:
            return "❌ Multiple recipes found for that slug. Please check the database.", 500

        recipe = data[0]
        for field in ["ingredients", "dressing"]:
            if isinstance(recipe.get(field), list):
                recipe[field] = [json.loads(i) if isinstance(i, str) else i for i in recipe[field]]

        return render_template('recipe.html', recipe=recipe)
    except Exception:
        return "An error occurred while loading the recipe.", 500

if __name__ == "__main__":
    app.run(debug=False)
