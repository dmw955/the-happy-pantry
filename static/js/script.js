// Ensure Supabase is loaded before using it
if (typeof supabase === 'undefined') {
  console.error("❌ Supabase library not loaded! Make sure the script order is correct in your HTML.");
}

// ✅ Initialize Supabase
const supabaseUrl = "https://ulaaelkluixsmqozeaaa.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFlbGtsdWl4c21xb3plYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MzQ5NDUsImV4cCI6MjA1NzMxMDk0NX0.FG3FEN51RpTmlr14vijyL_YM3jyt1lIok9Z4FsKhnMs";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log("✅ Supabase Object:", supabaseClient);

document.addEventListener("DOMContentLoaded", async () => {
  console.log("✅ script.js is running!");

  // 🔐 Handle password reset from URL hash
  const hash = window.location.hash;
  if (hash.includes("access_token")) {
    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      const { error } = await supabaseClient.auth.setSession({ access_token, refresh_token });
      if (error) {
        console.error("❌ Session error:", error.message);
      } else {
        console.log("✅ Supabase session set");
        const cleanedUrl = window.location.href.split('#')[0];
        window.location.replace(cleanedUrl);
      }
    }
  }

  // 📝 Signup form handling
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

  // ✨ Scroll fade animation
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
});
