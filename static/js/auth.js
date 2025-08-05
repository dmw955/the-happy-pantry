document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.error("❌ Missing Supabase config");
      return;
    }

    // ✅ Initialize Supabase client once
    if (!window.supabaseClient) {
      if (!window.supabase?.createClient) {
        console.error("❌ Supabase library did not load properly");
        return;
      }

      window.supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );

      console.log("✅ Supabase client initialized");
    }

    const supabase = window.supabaseClient;

    // ✅ Get session instead of getUser (v2-compatible)
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.user) {
      console.warn("⚠️ No Supabase session found");
      return;
    }

    const user = session.user;

    const payload = {
      user_id: user.id,
      email: user.email,
    };

    if (!sessionStorage.getItem("flaskSessionSet")) {
      const res = await fetch("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
