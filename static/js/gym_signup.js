document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("gym-signup-form");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

const email = document.getElementById("email").value.trim();
const password = document.getElementById("password").value;
const confirmPassword = document.getElementById("confirm_password").value;
const gymSlug = document.getElementById("gym_slug").value;

if (!email || !password || !confirmPassword) {
  alert("Please complete all fields.");
  return;
}

if (password !== confirmPassword) {
  alert("Passwords do not match.");
  return;
}


const supabaseClient = window.supabaseClient;

const { data, error } = await supabaseClient.auth.signUp({
  email,
  password,
  options: {
    data: {
      pending_gym_slug: gymSlug
    }
  }
});


    if (error) {
      alert(error.message);
      return;
    }

    /*
      IMPORTANT:
      - User is now created
      - Gym slug is stored in user metadata
      - We will process this AFTER login in a later step
    */

    // Redirect behavior (choose ONE)
    // Option A: straight to login
    window.location.href = "/login";

    // Option B (later): confirmation page
    // window.location.href = "/signup-success";
  });
});
