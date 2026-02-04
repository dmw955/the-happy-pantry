document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("freeWeekForm");
  const emailInput = document.getElementById("email");

  if (!form || !emailInput) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }

    try {
      const response = await fetch("/api/free-week-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      // Already signed up
      if (response.status === 409) {
        window.location.href = "/free_week_error.html";
        return;
      }

      // Success
      if (response.ok) {
        // GA4 conversion event
        if (typeof gtag === "function") {
          gtag("event", "free_week_signup", {
            event_category: "engagement"
          });
        }

        window.location.href = "/free_week_success.html";
        return;
      }

      // Any other error
      throw new Error("Signup failed");

    } catch (err) {
      console.error("Free week signup error:", err);
      window.location.href = "/free_week_error.html";
    }
  });
});
