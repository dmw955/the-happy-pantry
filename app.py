# app.py
from flask import (
    Flask, render_template, request, redirect, url_for,
    session, flash, jsonify, send_from_directory
)
from supabase import create_client
import os, json, requests, traceback
from dotenv import load_dotenv

# ─────────────────────────────────────────────────────────────────────────────
# Environment / App
# ─────────────────────────────────────────────────────────────────────────────
load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)
app = Flask(__name__)
app.jinja_env.cache = {}  # ⬅️ This disables template caching


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
USDA_API_KEY = os.getenv("USDA_API_KEY")
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
PAYPAL_PLAN_ID = os.getenv("PAYPAL_PLAN_ID")

# ─────────────────────────────────────────────────────────────────────────────
# Lazy Supabase clients (prevents boot crashes if env vars are missing)
# ─────────────────────────────────────────────────────────────────────────────
_supabase = None
_supabase_admin = None


def get_supabase():
    """Public supabase client; prefers SERVICE key, falls back to ANON."""
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
            raise RuntimeError("Supabase is not configured on the server")
        _supabase = create_client(url, key)
    return _supabase

def get_supabase_admin():
    """Admin supabase client; requires SERVICE key."""
    global _supabase_admin
    if _supabase_admin is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise RuntimeError("Supabase admin is not configured on the server")
        _supabase_admin = create_client(url, key)
    return _supabase_admin

# ─────────────────────────────────────────────────────────────────────────────
# Health & Favicon
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/healthz")
def healthz():
    # Keep this ultra-light—no external calls—so Render health checks succeed.
    return {"ok": True}, 200

@app.route('/favicon.ico')
def favicon():
    """Serve ICO directly if present, else redirect to PNG."""
    ico_path = os.path.join(app.root_path, 'static', 'assets', 'favicon.ico')
    if os.path.exists(ico_path):
        return send_from_directory(
            os.path.join(app.root_path, 'static', 'assets'),
            'favicon.ico',
            mimetype='image/vnd.microsoft.icon'
        )
    # fallback to PNG if you prefer that file
    return redirect(url_for('static', filename='assets/favicon.png'), code=302)

# ─────────────────────────────────────────────────────────────────────────────
# Core Routes
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")


@app.route('/dashboard')
def dashboard():
    return render_template(
        'dashboard.html',
        SUPABASE_URL=os.getenv("SUPABASE_URL"),
        SUPABASE_ANON_KEY=os.getenv("SUPABASE_ANON_KEY")
    )


@app.route("/auth-redirect")
def auth_redirect():
    return render_template(
        "auth-redirect.html",
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
    )

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        try:
            sb = get_supabase()
            response = sb.auth.sign_in_with_password({"email": email, "password": password})

            # Defensive checks — supabase client libs vary in return shape
            user_obj = getattr(response, 'user', None) if response else None
            session_obj = getattr(response, 'session', None) if response else None

            if user_obj:
                # Store safe basics; avoid strict datetime ops on created_at
                session['user_id'] = getattr(user_obj, 'id', None)
                session['email'] = getattr(user_obj, 'email', email)
                member_since = getattr(user_obj, 'created_at', None)
                session['member_since'] = str(member_since) if member_since else "Unknown"
                session['access_token'] = getattr(session_obj, 'access_token', None) if session_obj else None
                session['refresh_token'] = getattr(session_obj, 'refresh_token', None) if session_obj else None
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
    subscription_id = data.get("subscription_id")

    if user_id:
        session["user_id"] = user_id
        session["email"] = email
        session["subscription_id"] = subscription_id
        print("✅ Session set via JS for user:", email)

        # Optionally save subscription to Supabase
        if subscription_id:
            try:
                sb = get_supabase_admin()
                sb.table("subscriptions").insert({
                    "user_id": user_id,
                    "paypal_subscription_id": subscription_id,
                    "status": "active",
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
                print("✅ Supabase subscription row added")
            except Exception as e:
                print("❌ Failed to insert subscription:", e)

        return jsonify({"message": "Session stored"}), 200

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
        user={}  # prevents template crash when not logged in
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
            sba = get_supabase_admin()
            sba.auth.admin.update_user_by_id(user_id, updates)
            if 'email' in updates:
                session['email'] = updates['email']
                flash("✅ Email updated successfully!", "success")
            if 'password' in updates:
                flash("✅ Password updated successfully!", "success")

        session['email_notifications'] = email_notifications
        flash("✅ Preferences updated successfully!", "success")
    except Exception as e:
        print("update_profile error:", e)
        flash("❌ Something went wrong. Please try again.", "danger")

    return redirect(url_for('profile'))

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        try:
            sb = get_supabase()
            sb.auth.reset_password_for_email(
                email,
                options={"redirect_to": "http://127.0.0.1:5000/reset_password"}  # update for prod if needed
            )
            flash("✅ If an account with that email exists, a reset link has been sent.", "success")
            return redirect(url_for('login'))
        except Exception as e:
            print("forgot_password error:", e)
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

@app.route("/planselection")
def planselection():
    # Redirect old links to the main subscribe page
    return redirect(url_for("subscribe"))


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

# ─────────────────────────────────────────────────────────────────────────────
# USDA Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.route('/usda/search')
def usda_search():
    query = request.args.get('query', '')
    try:
        res = requests.get(
            "https://api.nal.usda.gov/fdc/v1/foods/search",
            params={"query": query, "api_key": USDA_API_KEY, "pageSize": 10},
            timeout=12
        )
        return jsonify(res.json()), res.status_code
    except requests.RequestException as e:
        print("USDA search error:", e)
        return jsonify({"error": "USDA API error"}), 502

@app.route('/usda/detail')
def usda_detail():
    fdc_id = request.args.get('fdcId')
    try:
        res = requests.get(
            f"https://api.nal.usda.gov/fdc/v1/food/{fdc_id}",
            params={"api_key": USDA_API_KEY},
            timeout=12
        )
        return jsonify(res.json()), res.status_code
    except requests.RequestException as e:
        print("USDA detail error:", e)
        return jsonify({"error": "USDA API error"}), 502

# ─────────────────────────────────────────────────────────────────────────────
# PantryPal AI Endpoint
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/api/pantrypal", methods=["POST"])
def pantrypal_api():
    try:
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            return jsonify({
                "error": "Server misconfig: OPENAI_API_KEY missing",
                "hint": "Add OPENAI_API_KEY in Render → Environment and restart the service."
            }), 500

        payload = request.get_json(force=True, silent=False)
        user_msg = (payload.get("message") or "").strip()
        context = payload.get("context") or {}
        if not user_msg:
            return jsonify({"error": "Missing 'message'"}), 400

        system_prompt = (
            "You are PantryPal, a concise assistant for The Happy Pantry.\n"
            "RULES:\n"
            "- Do NOT generate full recipes or step-by-steps; reply in 1–3 short bullets.\n"
            "- Prefer actionable outputs the UI can apply: filters (diet/tags/time/macros), simple ingredient swaps, brief rationale.\n"
            "- Stay within site content. No external links. No medical advice.\n"
            "- Respond as strict JSON (response_format=json_object) with keys:\n"
            "  text: string\n"
            "  actions: object | null\n"
        )
        user_prompt = {
            "message": user_msg,
            "context": {
                "activeFilters": context.get("activeFilters"),
                "pantry": context.get("pantry"),
                "favoritesCount": context.get("favoritesCount"),
            }
        }

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": "gpt-4o-mini",
            "response_format": {"type": "json_object"},
            "temperature": 0.3,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt)},
            ],
            "max_tokens": 350,
        }

        try:
            r = requests.post(url, headers=headers, json=body, timeout=20)
        except requests.Timeout:
            return jsonify({"error": "Upstream timeout contacting OpenAI"}), 504
        except requests.RequestException as e:
            return jsonify({"error": "Network error contacting OpenAI", "details": str(e)}), 502

        if r.status_code != 200:
            details = None
            try:
                details = r.json()
            except Exception:
                details = r.text
            print("OpenAI error:", r.status_code, details)
            return jsonify({
                "error": "OpenAI error",
                "status": r.status_code,
                "details": details
            }), 502

        try:
            content = r.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            if not isinstance(data, dict) or "text" not in data:
                raise ValueError("Invalid JSON shape from AI")
        except Exception as e:
            print("AI parse error:", e, "\nRaw:", r.text[:1000])
            data = {
                "text": "I’m here to help with quick swaps and filters! Try asking for a dairy-free swap or a time limit.",
                "actions": None
            }

        return jsonify(data), 200

    except Exception:
        print("PantryPal unhandled error:\n", traceback.format_exc())
        return jsonify({"error": "Unhandled server error"}), 500

@app.route("/api/pantrypal/echo", methods=["POST"])
def pantrypal_echo():
    try:
        payload = request.get_json(force=True, silent=False)
        return {"ok": True, "payload": payload}, 200
    except Exception as e:
        return {"ok": False, "error": f"Invalid JSON: {str(e)}"}, 400

# ─────────────────────────────────────────────────────────────────────────────
# Blog Macro
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/blog_macro")
def blog_macro():
    post = {
        "title": "Macro-Friendly Eating: Simple Ratios That Work",
        "slug": "macro-friendly-eating",
        "author": "The Happy Pantry",
        "date": "2025-09-30",
        "hero": url_for('static', filename='assets/blog/macro-hero.jpg'),
        "summary": "A quick-start guide to protein/carb/fat ratios and portioning.",
        "content": []  # you can fill this later
    }
    return render_template("blog_macro.html", post=post)

# ─────────────────────────────────────────────────────────────────────────────
# Recipes
# ─────────────────────────────────────────────────────────────────────────────
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
        sb = get_supabase()
        response = sb.table('recipes').select('*').eq('slug', slug).execute()
        data = getattr(response, 'data', None) or getattr(response, 'json', None) or None
        # Some client versions return .data, others return dict-like
        if data is None and isinstance(response, dict):
            data = response.get('data')

        if not data:
            return "❌ No recipe found for that slug.", 404
        if len(data) > 1:
            return "❌ Multiple recipes found for that slug. Please check the database.", 500

        recipe = data[0]
        for field in ["ingredients", "dressing"]:
            if isinstance(recipe.get(field), list):
                recipe[field] = [json.loads(i) if isinstance(i, str) else i for i in recipe[field]]

        return render_template('recipe.html', recipe=recipe)
    except Exception as e:
        print("recipe_page error:", e)
        return "An error occurred while loading the recipe.", 500

# ─────────────────────────────────────────────────────────────────────────────
# Misc pages
# ─────────────────────────────────────────────────────────────────────────────
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
# ─────────────────────────────────────────────────────────────────────────────
# PayPal Subscribe (Single Plan)
# ─────────────────────────────────────────────────────────────────────────────
# PayPal Subscribe (Single Plan)
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/subscribe")
def subscribe():
    """
    Render the PayPal subscription page and inject PayPal + Supabase variables.
    """

    paypal_client_id = os.getenv("PAYPAL_CLIENT_ID")
    paypal_plan_id = os.getenv("PAYPAL_PLAN_ID")
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")  # ✅ use the actual key name in Render

    # ✅ Debug output (safe for logs)
    print("DEBUG → PAYPAL_CLIENT_ID:", repr(paypal_client_id))
    print("DEBUG → PAYPAL_PLAN_ID:", repr(paypal_plan_id))
    print("DEBUG → SUPABASE_URL:", repr(supabase_url))
    print("DEBUG → SUPABASE_ANON_KEY:", "SET" if supabase_key else "MISSING")

    if not paypal_client_id or not paypal_plan_id:
        return (
            "Missing PayPal credentials. Check PAYPAL_CLIENT_ID and PAYPAL_PLAN_ID.",
            500,
        )

    return render_template(
        "subscribe.html",
        PAYPAL_CLIENT_ID=paypal_client_id,
        PAYPAL_PLAN_ID=paypal_plan_id,
        SUPABASE_URL=supabase_url,
        SUPABASE_KEY=supabase_key
    )


from flask import render_template_string

@app.route("/debug-subscribe")
def debug_subscribe():
    with open("templates/subscribe.html") as f:
        html = render_template_string(
            f.read(),
            PAYPAL_CLIENT_ID=os.getenv("PAYPAL_CLIENT_ID"),
            PAYPAL_PLAN_ID=os.getenv("PAYPAL_PLAN_ID")
        )
    return html

# ─────────────────────────────────────────────────────────────────────────────
# PayPal Success Callback → Create Supabase User + Subscription Record
# ─────────────────────────────────────────────────────────────────────────────
from datetime import datetime

@app.route("/success")
def success():
    """Handle PayPal subscription success → create Supabase user & record."""
    subscription_id = request.args.get("subscription_id")
    if not subscription_id:
        return "Missing subscription ID.", 400

    # 1️⃣ Get PayPal access token (sandbox/live toggle supported)
    auth_response = requests.post(
        f"{PAYPAL_BASE_URL}/v1/oauth2/token",
        auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
        headers={"Accept": "application/json", "Accept-Language": "en_US"},
        data={"grant_type": "client_credentials"},
    )
    if auth_response.status_code != 200:
        print("⚠️ PayPal auth failed:", auth_response.text)
        return "PayPal authentication failed.", 500

    access_token = auth_response.json()["access_token"]

    # 2️⃣ Fetch subscription details
    sub_response = requests.get(
        f"{PAYPAL_BASE_URL}/v1/billing/subscriptions/{subscription_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if sub_response.status_code != 200:
        print("⚠️ Failed to fetch subscription:", sub_response.text)
        return "Unable to verify PayPal subscription.", 500

    sub_data = sub_response.json()
    subscriber_email = sub_data.get("subscriber", {}).get("email_address")
    start_date = sub_data.get("start_time")
    status = sub_data.get("status")

    if not subscriber_email:
        print("⚠️ Missing subscriber email in PayPal response.")
        return "Unable to retrieve subscriber email.", 400

    # 3️⃣ Create Supabase user
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")

    sb_response = requests.post(
        f"{supabase_url}/auth/v1/admin/users",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        },
        json={"email": subscriber_email},
    )

    if sb_response.status_code not in (200, 201):
        print("⚠️ Supabase user creation failed:", sb_response.text)

    # 4️⃣ Insert subscription record
    sub_payload = {
        "email": subscriber_email,
        "paypal_subscription_id": subscription_id,
        "status": status,
        "start_date": start_date,
        "updated_at": datetime.utcnow().isoformat(),
    }

    insert_response = requests.post(
        f"{supabase_url}/rest/v1/subscriptions",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=[sub_payload],
    )

    if insert_response.status_code not in (200, 201, 204):
        print("⚠️ Failed to insert subscription row:", insert_response.text)

    # 5️⃣ Render success confirmation page
    return render_template("success.html", email=subscriber_email, status=status)

@app.route("/test-vars")
def test_vars():
    return render_template_string("""
        <p>CLIENT_ID: {{ PAYPAL_CLIENT_ID }}</p>
        <p>PLAN_ID: {{ PAYPAL_PLAN_ID }}</p>
    """, PAYPAL_CLIENT_ID=os.getenv("PAYPAL_CLIENT_ID"),
         PAYPAL_PLAN_ID=os.getenv("PAYPAL_PLAN_ID"))

@app.route("/env")
def show_env():
    return {
        "status": "OK",
        "PAYPAL_CLIENT_ID": "SET",
        "PAYPAL_PLAN_ID": "SET",
        "SUPABASE_URL": "SET",
        "SUPABASE_KEY": "SET"
    }



# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # In production, gunicorn will run this; debug=False by default here.
    app.run(debug=False)
