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
    if (!supabaseClient) {
      alert("Signup error. Please refresh and try again.");
      return;
    }

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

    // Attach user to gym (final, DB-backed)
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

    window.location.href = "/login";
  });
});
