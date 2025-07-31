// ✅ Ensure Supabase is loaded
if (typeof supabase === 'undefined') {
  console.error("❌ Supabase library not loaded! Check script tag order in your HTML.");
}

// ✅ Initialize Supabase client once globally
if (typeof window.supabaseClient === "undefined") {
  const supabaseUrl = "https://ulaaelkluixsmqozeaaa.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFlbGtsdWl4c21xb3plYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MzQ5NDUsImV4cCI6MjA1NzMxMDk0NX0.FG3FEN51RpTmlr14vijyL_YM3jyt1lIok9Z4FsKhnMs";
  window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
  console.log("✅ Supabase client created globally");
}

console.log("✅ Supabase Object:", supabaseClient);

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ script.js is running!");

  if (window.location.pathname === '/login') {
    await supabaseClient.auth.signOut();
    console.log("🔌 Cleared Supabase session on login page");
  }

  // 🔐 Handle magic link / password reset link or hosted login redirect
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

  // ✅ CLIENT-SIDE LOGIN WITH SESSION SYNC
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
          window.location.href = "/dashboard";  // Or any protected route
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
});
