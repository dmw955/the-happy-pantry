document.addEventListener("DOMContentLoaded", async () => {
  // ✅ Initialize Supabase client safely once
  if (!window.supabaseClient) {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.error("❌ Supabase config is missing from window");
      return;
    }
    if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
      console.error("❌ Supabase SDK is not loaded yet");
      return;
    }

    window.supabaseClient = supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );
    console.log("✅ Supabase client created in script.js");
  }

  const supabaseClient = window.supabaseClient;
  console.log("✅ Supabase Object:", supabaseClient);

  console.log("✅ script.js is running!");

  if (window.location.pathname === '/login') {
    await supabaseClient.auth.signOut();
    console.log("🔌 Cleared Supabase session on login page");
  }

  // 🔐 Handle magic link / password reset link
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
        console.log("✅ Supabase session set successfully");
        const cleanUrl = window.location.origin + window.location.pathname;
        window.location.replace(cleanUrl);
      }
    } else {
      console.warn("⚠️ access_token or refresh_token missing in URL fragment.");
    }
  }

  // ✅ Session logging for debugging
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    console.log("🟢 User is already logged in:", session.user);
  } else {
    console.log("🔴 No active session found at load.");
  }

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
        passwordRequirements.innerHTML = "✅ Password meets the requirements!";
      } else {
        passwordRequirements.style.color = "red";
        passwordRequirements.innerHTML = "⚠️ Password must be at least <strong>6 characters long</strong>.";
      }
    });

    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      signupBtn.disabled = true;
      spinner.style.display = "inline-block";
      errorMessage.style.display = "none";

      try {
        const { error } = await supabaseClient.auth.signUp({
          email: emailInput.value.trim(),
          password: passwordInput.value,
        });

        if (error) {
          errorMessage.innerHTML = "<strong>❌ Error:</strong> " + error.message;
          errorMessage.style.display = "block";
        } else {
          window.location.href = "/login";
        }
      } catch (err) {
        errorMessage.innerHTML = "<strong>❌ Error:</strong> Something went wrong.";
        errorMessage.style.display = "block";
      } finally {
        signupBtn.disabled = false;
        spinner.style.display = "none";
      }
    });
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

  // ✅ Client-side login with session sync
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const loginBtn = document.querySelector("#loginForm button[type=submit]");
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
          loginError.textContent = "Failed to sync session with backend.";
          loginError.style.display = "block";
        }
      } catch (err) {
        console.error("Error sending token to backend:", err);
        loginError.textContent = "Unexpected error.";
        loginError.style.display = "block";
      }

      loginBtn.disabled = false;
    });
  }

  // ✅ Sync Supabase session to Flask backend
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session && session.user) {
      fetch("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: session.user.id })
      }).then(res => {
        if (res.ok) {
          console.log("✅ Flask session updated with Supabase user_id");
        } else {
          console.warn("❌ Flask session update failed");
        }
      }).catch(err => {
        console.error("❌ Error updating Flask session:", err);
      });
    } else {
      console.log("⚠️ No Supabase session to sync to Flask");
    }
  });

});
