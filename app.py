from flask import Flask, render_template, request, redirect, url_for, session, flash
from supabase import create_client
import os
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Create clients
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

@app.route("/")
def home():
    return render_template("index.html")

@app.route('/dashboard')
def dashboard():
    if "user_id" not in session:
        flash("⚠️ Please log in to access the dashboard.", "warning")
        return redirect(url_for("login"))
    return render_template("dashboard.html")

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
                session.permanent = True
                flash("✅ Login Successful!", "success")
                return redirect(url_for('dashboard'))
            flash("❌ Invalid email or password. Please try again.", "danger")
        except Exception as e:
            flash("❌ Something went wrong. Please try again later.", "danger")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash("✅ Logged out successfully.", "info")
    return redirect(url_for('home'))

@app.route("/profile")
def profile():
    if "user_id" not in session:
        flash("⚠️ Please log in to access your profile.", "warning")
        return redirect(url_for("login"))
    user = {
        "email": session.get("email", "Not Available"),
        "member_since": session.get("member_since", "Unknown"),
        "email_notifications": session.get("email_notifications", False)
    }
    return render_template("profile.html", user=user)

@app.route("/update_profile", methods=["POST"])
def update_profile():
    if "user_id" not in session:
        flash("⚠️ Please log in to update your profile.", "warning")
        return redirect(url_for("login"))
    email = request.form.get("email")
    new_password = request.form.get("new_password")
    confirm_password = request.form.get("confirm_password")
    email_notifications = "email_notifications" in request.form
    if new_password and new_password != confirm_password:
        flash("❌ Passwords do not match. Try again.", "danger")
        return redirect(url_for("profile"))
    try:
        user_id = session["user_id"]
        updates = {}
        if email and email != session.get("email"):
            updates["email"] = email
        if new_password:
            updates["password"] = new_password
        if updates:
            response = supabase_admin.auth.admin.update_user_by_id(user_id, updates)
            if "email" in updates:
                session["email"] = updates["email"]
                flash("✅ Email updated successfully!", "success")
            if "password" in updates:
                flash("✅ Password updated successfully!", "success")
        session["email_notifications"] = email_notifications
        flash("✅ Preferences updated successfully!", "success")
    except Exception as e:
        flash("❌ Something went wrong. Please try again.", "danger")
    return redirect(url_for("profile"))

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
        except Exception as e:
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

@app.route("/shopping_list")
def shopping_list():
    return render_template("shopping_list.html")

@app.route('/planselection')
def planselection():
    return render_template('planselection.html')


# Route for Payment Processing Page
@app.route('/paymentprocessing')
def payment_processing():
    return render_template('paymentprocessing.html')

# Route for Success Page
@app.route('/success')
def success():
    return render_template('success.html')

# Route for Cancel Page
@app.route('/cancel')
def cancel():
    return render_template('cancel.html')

# Route for Error Page
@app.route('/error')
def error():
    message = request.args.get('message', 'An error occurred during your transaction.')
    return render_template('error.html', message=message)

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
        SUPABASE_ANON_KEY=SUPABASE_ANON_KEY
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

    except Exception as e:
        return "An error occurred while loading the recipe.", 500

if __name__ == "__main__":
    app.run(debug=False)