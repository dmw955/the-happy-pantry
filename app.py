# app.py
from flask import (
    Flask, render_template, render_template_string,
    request, redirect, url_for,
    session, flash, jsonify, send_from_directory
)
from supabase import create_client
import os
import json
import requests
import traceback
from datetime import datetime
from dotenv import load_dotenv
import openai


# ─────────────────────────────────────────────────────────────────────────────
# App Initialization
# ─────────────────────────────────────────────────────────────────────────────
load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")


app = Flask(__name__)
app.secret_key = os.urandom(24)
app.jinja_env.cache = {}

# ─────────────────────────────────────────────────────────────────────────────
# Environment Configuration
# ─────────────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
USDA_API_KEY = os.getenv("USDA_API_KEY")

# PayPal Mode must load before base URL
PAYPAL_MODE = os.getenv("PAYPAL_MODE", "live").lower()
PAYPAL_BASE_URL = (
    "https://api-m.sandbox.paypal.com"
    if PAYPAL_MODE == "sandbox"
    else "https://api-m.paypal.com"
)

print(f"DEBUG → PAYPAL_MODE: {PAYPAL_MODE}")
print(f"DEBUG → PAYPAL_BASE_URL: {PAYPAL_BASE_URL}")
print(f"DEBUG → SUPABASE_URL: {SUPABASE_URL}")
print(f"DEBUG → SUPABASE_ANON_KEY: {'SET' if SUPABASE_ANON_KEY else 'MISSING'}")
print(f"DEBUG → SUPABASE_SERVICE_KEY: {'SET' if SUPABASE_SERVICE_KEY else 'MISSING'}")

# ─────────────────────────────────────────────────────────────────────────────
# Supabase Clients
# ─────────────────────────────────────────────────────────────────────────────
_supabase = None
_supabase_admin = None

def get_supabase():
    """Public Supabase client; prefers SERVICE key, falls back to ANON."""
    global _supabase
    if _supabase is None:
        url = SUPABASE_URL
        key = SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY
        if not url or not key:
            raise RuntimeError("Supabase is not configured.")
        _supabase = create_client(url, key)
    return _supabase

def get_supabase_admin():
    """Admin Supabase client; requires SERVICE key."""
    global _supabase_admin
    if _supabase_admin is None:
        url = SUPABASE_URL
        key = SUPABASE_SERVICE_KEY
        if not url or not key:
            raise RuntimeError("Supabase admin is not configured.")
        _supabase_admin = create_client(url, key)
    return _supabase_admin

# ─────────────────────────────────────────────────────────────────────────────
# Health & Favicon
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/healthz")
def healthz():
    return {"ok": True}, 200

@app.route('/favicon.ico')
def favicon():
    """Serve favicon if exists, fallback to PNG."""
    ico_path = os.path.join(app.root_path, 'static', 'assets', 'favicon.ico')
    if os.path.exists(ico_path):
        return send_from_directory(
            os.path.join(app.root_path, 'static', 'assets'),
            'favicon.ico',
            mimetype='image/vnd.microsoft.icon'
        )
    return redirect(url_for('static', filename='assets/favicon.png'), code=302)

# ─────────────────────────────────────────────────────────────────────────────
# Core Pages & User Account Routes
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/local_resources")
def local_resources():
    return render_template("local_resources.html")


@app.route("/contact")
def contact():
    return render_template("contact.html")

@app.route("/signup")
def signup():
    return render_template("signup.html")

@app.route("/dashboard")
def dashboard():
    return render_template(
        "dashboard.html",
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
    )
@app.route("/set_password")
def set_password():
    return render_template("set_password.html", SUPABASE_URL=SUPABASE_URL, SUPABASE_ANON_KEY=SUPABASE_ANON_KEY)


@app.route("/auth-redirect")
def auth_redirect():
    return render_template(
        "auth-redirect.html",
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
    )

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        try:
            sb = get_supabase()
            response = sb.auth.sign_in_with_password({"email": email, "password": password})
            user_obj = getattr(response, "user", None)
            session_obj = getattr(response, "session", None)

            if user_obj:
                session["user_id"] = getattr(user_obj, "id", None)
                session["email"] = getattr(user_obj, "email", email)
                member_since = getattr(user_obj, "created_at", None)
                session["member_since"] = str(member_since) if member_since else "Unknown"
                session["access_token"] = getattr(session_obj, "access_token", None) if session_obj else None
                session["refresh_token"] = getattr(session_obj, "refresh_token", None) if session_obj else None
                flash("✅ Login Successful!", "success")
                return redirect(url_for("dashboard"))
            flash("❌ Invalid email or password.", "danger")
        except Exception as e:
            print("Login error:", e)
            flash("❌ Something went wrong.", "danger")
    return render_template("login.html", SUPABASE_URL=SUPABASE_URL, SUPABASE_ANON_KEY=SUPABASE_ANON_KEY)

@app.route("/logout")
def logout():
    session.clear()
    flash("✅ Logged out successfully.", "info")
    return redirect(url_for("home"))

@app.route("/profile")
def profile():
    return render_template(
        "profile.html",
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY,
        user={}
    )

@app.route("/session", methods=["GET", "POST"])
def session_info():
    return jsonify({
        "user_id": session.get("user_id"),
        "email": session.get("email"),
        "access_token": session.get("access_token"),
    }), 200

@app.route("/update_profile", methods=["POST"])
def update_profile():
    user_id = session.get("user_id")
    if not user_id:
        flash("⚠️ Please log in to update your profile.", "warning")
        return redirect(url_for("profile"))

    email = request.form.get("email")
    new_password = request.form.get("new_password")
    confirm_password = request.form.get("confirm_password")
    email_notifications = 'email_notifications' in request.form

    if new_password and new_password != confirm_password:
        flash("❌ Passwords do not match.", "danger")
        return redirect(url_for("profile"))

    try:
        updates = {}
        if email and email != session.get("email"):
            updates["email"] = email
        if new_password:
            updates["password"] = new_password

        if updates:
            sba = get_supabase_admin()
            sba.auth.admin.update_user_by_id(user_id, updates)
            if "email" in updates:
                session["email"] = updates["email"]
            flash("✅ Profile updated successfully!", "success")
    except Exception as e:
        print("update_profile error:", e)
        flash("❌ Something went wrong.", "danger")

    session["email_notifications"] = email_notifications
    return redirect(url_for("profile"))

@app.route("/forgot_password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        email = request.form.get("email")
        try:
            sb = get_supabase()
            sb.auth.reset_password_for_email(
                email,
                options={"redirect_to": "https://the-happy-pantry.com/reset_password"}
            )
            flash("✅ If an account exists, a reset link was sent.", "success")
            return redirect(url_for("login"))
        except Exception as e:
            print("forgot_password error:", e)
            flash("❌ Error sending reset link.", "danger")
    return render_template("forgot_password.html")

@app.route("/reset_password")
def reset_password():
    return render_template("reset_password.html", SUPABASE_URL=SUPABASE_URL, SUPABASE_ANON_KEY=SUPABASE_ANON_KEY)

# ─────────────────────────────────────────────────────────────────────────────
# Static Pages
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/shopping_list")
def shopping_list():
    return render_template("shopping_list.html")

@app.route("/planselection")
def planselection():
    return render_template(
        "subscribe.html",
        PAYPAL_CLIENT_ID=PAYPAL_CLIENT_ID,
        PAYPAL_PLAN_ID=PAYPAL_PLAN_ID,
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_KEY=SUPABASE_ANON_KEY,
        PAYPAL_MODE=PAYPAL_MODE
    )



@app.route("/pantrypost")
def pantrypost():
    return render_template("pantry_post.html")

@app.route("/thankyou")
def thankyou():
    return render_template("thankyou.html")


@app.route("/whyitworks")
def whyitworks():
    return render_template("whyitworks.html")

@app.route("/pantry_project")
def pantry_project():
    return render_template("pantry_project.html")

@app.route("/paymentprocessing")
def payment_processing():
    return render_template("paymentprocessing.html")

@app.route("/macrotracking")
def macro_tracking():
    return render_template("macrotracking.html",
                           SUPABASE_URL=SUPABASE_URL,
                           SUPABASE_ANON_KEY=SUPABASE_ANON_KEY,
                           USER_ID=session.get("user_id"))


@app.route("/macrogoals")
def macro_goals():
    return render_template("macrogoals.html", SUPABASE_URL=SUPABASE_URL, SUPABASE_ANON_KEY=SUPABASE_ANON_KEY)

@app.route("/usda/search")
def usda_search():
    query = request.args.get("query", "").strip()
    if not query:
        return jsonify({"error": "Missing query"}), 400

    try:
        response = requests.get(
            "https://api.nal.usda.gov/fdc/v1/foods/search",
            params={
                "api_key": USDA_API_KEY,
                "query": query,
                "pageSize": 10
            }
        )
        return jsonify(response.json())
    except Exception as e:
        print("❌ USDA Search Error:", e)
        return jsonify({"error": "USDA search failed"}), 500


@app.route("/usda/detail")
def usda_detail():
    fdc_id = request.args.get("fdcId")
    if not fdc_id:
        return jsonify({"error": "Missing fdcId"}), 400

    try:
        response = requests.get(
            f"https://api.nal.usda.gov/fdc/v1/food/{fdc_id}",
            params={"api_key": USDA_API_KEY}
        )
        return jsonify(response.json())
    except Exception as e:
        print("❌ USDA Detail Error:", e)
        return jsonify({"error": "USDA detail failed"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# PayPal Configuration (Sandbox / Live Toggle)
# ─────────────────────────────────────────────────────────────────────────────
if PAYPAL_MODE == "sandbox":
    PAYPAL_CLIENT_ID = os.getenv("PAYPAL_SANDBOX_CLIENT_ID")
    PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_SANDBOX_CLIENT_SECRET")
    PAYPAL_PLAN_ID = os.getenv("PAYPAL_SANDBOX_PLAN_ID")
else:
    PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
    PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
    PAYPAL_PLAN_ID = os.getenv("PAYPAL_PLAN_ID")

print(f"🟢 PayPal mode: {PAYPAL_MODE.upper()} → {PAYPAL_BASE_URL}")
print(f"→ Plan ID: {PAYPAL_PLAN_ID}")

# ─────────────────────────────────────────────────────────────────────────────
# PayPal Subscribe & Success
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/subscribe")
def subscribe():
    supabase_url = SUPABASE_URL
    supabase_key = SUPABASE_ANON_KEY

    if not PAYPAL_CLIENT_ID or not PAYPAL_PLAN_ID:
        return "Missing PayPal credentials.", 500

    return render_template(
        "subscribe.html",
        PAYPAL_CLIENT_ID=PAYPAL_CLIENT_ID,
        PAYPAL_PLAN_ID=PAYPAL_PLAN_ID,
        SUPABASE_URL=supabase_url,
        SUPABASE_KEY=supabase_key,
        PAYPAL_MODE=PAYPAL_MODE
    )

@app.route("/success")
def success():
    """Handle PayPal subscription success: create Supabase user, send invite, and log subscription."""
    try:
        # -------------------------
        # 1️⃣ Get subscription ID from query param
        # -------------------------
        subscription_id = request.args.get("subscription_id")
        if not subscription_id:
            return "Missing subscription ID.", 400

        print(f"🔄 Handling success for PayPal subscription: {subscription_id}")

        # -------------------------
        # 2️⃣ Use pre-loaded PayPal credentials
        # -------------------------
        global PAYPAL_BASE_URL, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET

        paypal_auth_url = f"{PAYPAL_BASE_URL}/v1/oauth2/token"
        paypal_sub_url = f"{PAYPAL_BASE_URL}/v1/billing/subscriptions/{subscription_id}"

        # -------------------------
        # 3️⃣ Get PayPal Access Token
        # -------------------------
        auth_response = requests.post(
            paypal_auth_url,
            auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
            data={"grant_type": "client_credentials"},
        )

        if auth_response.status_code != 200:
            print("⚠️ PayPal authentication failed:", auth_response.text)
            return "PayPal authentication failed.", 500

        access_token = auth_response.json().get("access_token")

        # -------------------------
        # 4️⃣ Get Subscription Details from PayPal
        # -------------------------
        sub_response = requests.get(
            paypal_sub_url,
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if sub_response.status_code != 200:
            print("⚠️ Subscription lookup failed:", sub_response.text)
            return "Unable to verify subscription.", 500

        sub_data = sub_response.json()
        print("✅ PayPal subscription data:", json.dumps(sub_data, indent=2))

        subscriber_email = sub_data.get("subscriber", {}).get("email_address")
        start_date = sub_data.get("start_time")
        status = sub_data.get("status")

        if not subscriber_email:
            print("⚠️ No email found in subscription data.")
            return "Missing email.", 400

        print(f"📧 Subscriber email: {subscriber_email}")

        # -------------------------
        # 5️⃣ Supabase Setup
        # -------------------------
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
        }

        # -------------------------
        # 6️⃣ Create Supabase User
        # -------------------------
        print("👤 Creating Supabase user...")
        create_user_resp = requests.post(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=headers,
            json={"email": subscriber_email}
        )

        if create_user_resp.status_code not in (200, 201):
            print("⚠️ User creation failed:", create_user_resp.text)
        else:
            print("✅ User created.")

        # -------------------------
            # 7️⃣ Send Invite Email
        print("📨 Sending invite email with redirect...")
        invite_resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/invite",
        headers=headers,
        json={
        "email": subscriber_email,
        "options": {
            "redirectTo": "https://www.the-happy-pantry.com/set_password"
        }
    }
)


        if invite_resp.status_code not in (200, 201):
            print("⚠️ Invite email failed:", invite_resp.text)
        else:
            print("✅ Invite email sent.")

        # -------------------------
        # 8️⃣ Insert Subscription Record
        # -------------------------
        print("📝 Inserting subscription record into Supabase...")
        subscription_payload = {
            "email": subscriber_email,
            "paypal_subscription_id": subscription_id,
            "status": status,
            "start_date": start_date,
            "updated_at": datetime.utcnow().isoformat(),
        }

        record_resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/subscriptions",
            headers={**headers, "Prefer": "return=minimal"},
            json=[subscription_payload],
        )

        if record_resp.status_code not in (200, 201, 204):
            print("⚠️ Failed to insert subscription:", record_resp.text)
        else:
            print("✅ Subscription record inserted.")

        # -------------------------
        # 9️⃣ Show Success Page
        # -------------------------
        return render_template("success.html", email=subscriber_email, status=status)

    except Exception as e:
        print("❌ Uncaught exception in /success route:")
        print(traceback.format_exc())
        return "Internal server error.", 500

# ─────────────────────────────────────────────────────────────────────────────
# PantryPal AI Endpoint
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/api/pantrypal", methods=["POST"])
def pantrypal_api():
    try:
        payload = request.get_json(force=True)
        user_msg = (payload.get("message") or "").strip()
        context = payload.get("context", {})

        if not user_msg:
            return jsonify({"error": "Missing message"}), 400

        system_msg = (
            "You are PantryPal, a helpful kitchen assistant. "
            "Respond in concise JSON with text/actions only. "
            f"Here is some page context: {json.dumps(context)}"
        )

        # ✅ OpenAI SDK call
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg}
            ],
            max_tokens=350,
            temperature=0.3,
        )

        print("📡 OpenAI SDK response:", response)

        try:
            content = response.choices[0].message["content"]
            data = json.loads(content)
        except (KeyError, IndexError, json.JSONDecodeError):
            print("❌ Invalid AI response")
            return jsonify({"error": "Invalid AI response"}), 502

        return jsonify(data), 200

    except Exception:
        print("❌ Server error:\n", traceback.format_exc())
        return jsonify({"error": "Server error"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Blog & Recipes
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/blog_macro")
def blog_macro():
    post = {
        "title": "Macro-Friendly Eating: Simple Ratios That Work",
        "slug": "macro-friendly-eating",
        "author": "The Happy Pantry",
        "date": "2025-09-30",
        "hero": url_for("static", filename="assets/blog/macro-hero.jpg"),
        "summary": "A quick-start guide to protein/carb/fat ratios and portioning.",
        "content": [],
    }
    return render_template("blog_macro.html", post=post)

import random

@app.route("/recipes")
def recipes():
    # Page-only route (unchanged)
    return render_template(
        "recipes.html",
        SUPABASE_URL=SUPABASE_URL,
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
    )

@app.route("/api/recipes")
def api_recipes():
    try:
        sb = get_supabase()
        response = sb.table("recipes").select("*").execute()
        data = getattr(response, "data", [])

        # Shuffle list server‑side
        random.shuffle(data)

        return jsonify(data)
    except Exception as e:
        print("api_recipes error:", e)
        return jsonify({"error": "Error loading recipes"}), 500


@app.route("/recipes/<slug>")
def recipe_by_slug(slug):
    try:
        sb = get_supabase()
        response = sb.table("recipes").select("*").eq("slug", slug).single().execute()
        recipe = response.data

        if not recipe:
            return "Recipe not found", 404

        # ✅ Fix: Parse ingredients if needed
        import json
        if recipe.get("ingredients") and isinstance(recipe["ingredients"][0], str):
            try:
                recipe["ingredients"] = [json.loads(i) for i in recipe["ingredients"]]
            except Exception as e:
                print("❌ Error parsing ingredients JSON:", e)
                recipe["ingredients"] = []

        return render_template(
            "recipe.html",
            recipe=recipe,
            SUPABASE_URL=SUPABASE_URL,
            SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
        )
    except Exception as e:
        print("❌ Error loading recipe by slug:", e)
        return "Server error", 500



# ─────────────────────────────────────────────────────────────────────────────
# Diagnostics
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/env")
def show_env():
    def flag(v): return "SET" if v else "MISSING"
    return {
        "status": "OK",
        "paypal_mode": PAYPAL_MODE.upper(),
        "paypal_client_id": flag(PAYPAL_CLIENT_ID),
        "paypal_plan_id": flag(PAYPAL_PLAN_ID),
        "supabase_url": flag(SUPABASE_URL),
        "supabase_anon_key": flag(SUPABASE_ANON_KEY),
        "supabase_service_key": flag(SUPABASE_SERVICE_KEY),
    }

# ─────────────────────────────────────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=False)
