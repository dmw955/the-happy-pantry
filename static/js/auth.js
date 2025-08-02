document.addEventListener("DOMContentLoaded", async () => {
  try {
    // ✅ Validate Supabase config
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.error("❌ Missing Supabase config");
      return;
    }

    // ✅ Correctly initialize Supabase client
    const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    // ✅ Check if user is logged in
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      console.warn("⚠️ No Supabase session found");
      return;
    }

    const user = data.user;

    // ✅ Build payload
    const payload = {
      user_id: user.id,
      email: user.email
    };

    // ✅ Prevent re-sending during same browser session
    if (!sessionStorage.getItem("flaskSessionSet")) {
      const res = await fetch("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log("✅ Flask session synced");
        sessionStorage.setItem("flaskSessionSet", "true");
      } else {
        const errMsg = await res.text();
        console.error("❌ Flask session sync failed:", errMsg);
      }
    }
  } catch (err) {
    console.error("🔥 Error in auth.js:", err);
  }
});
