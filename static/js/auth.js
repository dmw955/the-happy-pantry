document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (typeof supabase === "undefined") {
      console.error("❌ Supabase not initialized");
      return;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      console.warn("⚠️ No Supabase user found");
      return;
    }

    const user = data.user;

    // Send only needed fields
    const sessionPayload = {
      user_id: user.id,
      email: user.email
    };

    // Prevent re-syncing on every reload
    if (!sessionStorage.getItem("flaskSessionSet")) {
      const res = await fetch("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionPayload)
      });

      if (res.ok) {
        console.log("✅ Flask session set");
        sessionStorage.setItem("flaskSessionSet", "true");
      } else {
        console.warn("❌ Flask session sync failed");
        const errText = await res.text();
        console.log("🧨 Server said:", errText);
      }
    }
  } catch (err) {
    console.error("🔥 Unexpected error in auth.js:", err);
  }
});
