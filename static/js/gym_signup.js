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


const supabaseClient = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);


const { data, error } = await supabaseClient.auth.signUp({
  email,
  password
});

if (error) {
  alert(error.message);
  return;
}

const user = data.user;

if (!user) {
  alert("Account created, but user data missing. Please log in.");
  window.location.href = "/login";
  return;
}

// 🔗 FINAL STEP: attach user to gym (DB-backed, permanent)
const joinResp = await fetch("/api/gym-join", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    user_id: user.id,
    email: user.email,
    gym_slug: gymSlug
  })
});

if (!joinResp.ok) {
  alert("Account created, but gym enrollment failed. Please contact support.");
  window.location.href = "/login";
  return;
}

// ✅ Success
window.location.href = "/login";


    // Option B (later): confirmation page
    // window.location.href = "/signup-success";
  });
});
