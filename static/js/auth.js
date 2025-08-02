// static/js/auth.js
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (typeof supabase === "undefined") {
      console.error("❌ Supabase is not initialized. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set before loading auth.js.");
      return;
    }

    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.warn("⚠️ No active Supabase session found.");
      return;
    }

    // Only sync once per browser session
    if (!sessionStorage.getItem("flaskSessionSet")) {
      const res = await fetch("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email
        })
      });

      if (res.ok) {
        console.info("✅ Flask session synchronized.");
        sessionStorage.setItem("flaskSessionSet", "true");
      } else {
        console.warn("❌ Flask session sync failed.");
      }
    }
  } catch (err) {
    console.error("Unexpected error in auth.js:", err);
  }
});
