document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🚫 iOS WebView guard: block signup / subscribe
    const isIOSWebView =
      /iPhone|iPad|iPod/.test(navigator.userAgent) &&
      !window.navigator.standalone &&
      !/Safari/.test(navigator.userAgent);

    if (isIOSWebView) {
      // Hide signup / subscribe buttons
      document
        .querySelectorAll('a[href*="signup"], a[href*="subscribe"]')
        .forEach(el => (el.style.display = "none"));

      // Hard block direct navigation
      if (
        window.location.pathname.includes("signup") ||
        window.location.pathname.includes("subscribe")
      ) {
        document.body.innerHTML = `
          <div style="padding:2rem; text-align:center; font-family:system-ui;">
            <h2>Sign up on the website</h2>
            <p>
              To create an account or subscribe, please visit
              <br>
              <strong>the-happy-pantry.com</strong>
              in your browser.
            </p>
          </div>
        `;
        return;
      }
    }

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

      console.log("✅ Supabase client initialized");
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
