document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔐 Existing Supabase logic (unchanged)
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.error("❌ Missing Supabase config");
      return;
    }

    if (!window.supabaseClient) {
      if (!window.supabase?.createClient) {
        console.error("❌ Supabase library did not load properly");
        return;
      }

      window.supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );
    }

    const supabase = window.supabaseClient;

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

      if (!res.ok) {
        const errMsg = await res.text();
        console.error("❌ Flask session sync failed:", errMsg);
        return;
      }

      sessionStorage.setItem("flaskSessionSet", "true");
      console.log("✅ Flask session synced");
    }

    // ✅ AUTH IS NOW COMPLETE — CLEAR THE FLAG
    window.__LOGIN_IN_PROGRESS__ = false;

  } catch (err) {
    console.error("🔥 Error in auth.js:", err);
  }
});
