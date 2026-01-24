// --- iOS WebView global guard ---
const isIOSWebView =
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  !window.navigator.standalone &&
  !/Safari/.test(navigator.userAgent);

if (isIOSWebView) {
  document.addEventListener("DOMContentLoaded", () => {
    // Hide signup / subscribe links everywhere
    document
      .querySelectorAll('a[href*="signup"], a[href*="subscribe"]')
      .forEach(el => (el.style.display = "none"));
  });

  // Hard block direct navigation
  if (
    window.location.pathname.includes("signup") ||
    window.location.pathname.includes("subscribe")
  ) {
    document.body.innerHTML = `
      <div style="padding:2rem; text-align:center; font-family:system-ui;">
        <h2>Sign up on the website</h2>
        <p>
          To create an account or subscribe, please visit
          <br>
          <strong>the-happy-pantry.com</strong>
          in your browser.
        </p>
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // ✅ Initialize Supabase client safely
  if (!window.supabaseClient) {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.error("❌ Supabase config missing in window.");
      return;
    }
    if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
      console.error("❌ Supabase SDK not loaded.");
      return;
    }

    window.supabaseClient = supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
    console.log("✅ Supabase client initialized.");
  }

  const supabaseClient = window.supabaseClient;


 
  // 🔐 Handle magic link or password reset links
  const hash = window.location.hash;
  if (hash.includes("access_token")) {
    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      console.log("🔑 Setting Supabase session from URL fragment...");
      const { error } = await supabaseClient.auth.setSession({ access_token, refresh_token });
      if (error) {
        console.error("❌ Failed to set session:", error.message);
      } else {
        console.log("✅ Supabase session restored.");
        const cleanUrl = window.location.origin + window.location.pathname;
        window.location.replace(cleanUrl);
      }
    }
  }

  // ✅ Log session info
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    console.log("🟢 Logged in user:", session.user);
  } else {
    console.log("🔴 No active Supabase session.");
  }

  // ✨ Scroll fade-in animation
  const fadeElements = document.querySelectorAll(".fade-in");
  function fadeInOnScroll() {
    fadeElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9) {
        el.classList.add("visible");
      }
    });
  }
  window.addEventListener("scroll", fadeInOnScroll);
  fadeInOnScroll();

  // 📝 Signup form behavior
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const signupBtn = document.getElementById("signupBtn");
    const spinner = document.getElementById("spinner");
    const errorMessage = document.getElementById("error-message");
    const passwordRequirements = document.getElementById("passwordRequirements");

    function checkFormValidity() {
      signupBtn.disabled = !(emailInput.value.includes("@") && passwordInput.value.length >= 6);
    }

    emailInput.addEventListener("input", checkFormValidity);
    passwordInput.addEventListener("input", () => {
      checkFormValidity();
      if (passwordInput.value.length >= 6) {
        passwordRequirements.style.color = "green";
        passwordRequirements.textContent = "✅ Password meets the requirements!";
      } else {
        passwordRequirements.style.color = "red";
        passwordRequirements.textContent = "⚠️ Password must be at least 6 characters.";
      }
    });

    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      signupBtn.disabled = true;
      spinner.style.display = "inline-block";
      errorMessage.style.display = "none";

      const { error } = await supabaseClient.auth.signUp({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      });

      if (error) {
        errorMessage.textContent = `❌ ${error.message}`;
        errorMessage.style.display = "block";
      } else {
        window.location.href = "/login";
      }

      signupBtn.disabled = false;
      spinner.style.display = "none";
    });
  }

  // 🔐 Login form behavior
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const loginBtn = loginForm.querySelector("button[type=submit]");
    const loginError = document.getElementById("loginError");

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginBtn.disabled = true;
      loginError.style.display = "none";

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      });

      if (error) {
        loginError.textContent = error.message;
        loginError.style.display = "block";
        loginBtn.disabled = false;
        return;
      }

      try {
        const token = data.session.access_token;
        const response = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });

        if (response.ok) {
          window.location.href = "/dashboard";
        } else {
          loginError.textContent = "Failed to sync with backend.";
          loginError.style.display = "block";
        }
      } catch (err) {
        loginError.textContent = "Unexpected error.";
        loginError.style.display = "block";
        console.error(err);
      }

      loginBtn.disabled = false;
    });
  }

  // 🧠 Supabase session sync with Flask
  if (session?.user) {
    fetch("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session.user.id })
    }).then(res => {
      if (res.ok) {
        console.log("✅ Synced Supabase user_id with Flask");
      } else {
        console.warn("❌ Failed to sync user_id with Flask");
      }
    }).catch(err => {
      console.error("❌ Error syncing with Flask:", err);
    });
  }

  // 💳 PayPal Button Handling (on /subscribe)
  if (window.location.pathname === "/subscribe") {
    paypal.Buttons({
      createSubscription: function (data, actions) {
        return actions.subscription.create({
          plan_id: "{{ PAYPAL_PLAN_ID }}" // Injected via Jinja
        });
      },
      onApprove: async function (data) {
        const subscriptionID = data.subscriptionID;
        console.log("✅ PayPal subscription approved:", subscriptionID);

        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error || !user) {
          console.error("❌ Supabase user fetch failed:", error);
          return;
        }

        const res = await fetch("/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            subscription_id: subscriptionID
          })
        });

        if (res.ok) {
          window.location.href = "/success";
        } else {
          console.error("❌ Failed to store subscription in Flask.");
        }
      }
    }).render("#paypal-button-container");
  }

});
