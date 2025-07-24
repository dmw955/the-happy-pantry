document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔐 Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("User not logged in:", userError);
      window.location.href = "login.html";
      return;
    }

    const userId = user.id;
    const form = document.getElementById("macro-goals-form");
    const statusEl = document.getElementById("goal-status");

    // 🚀 Load existing macro goals
    async function loadGoals() {
      const { data, error } = await supabase
        .from("macro_goals")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(); // ✅ avoids 406 when no row exists

      if (error) {
        console.error("Error loading goals:", error);
        return;
      }

      if (data) {
        const { calories, protein, carbs, fat } = data;

        // If all macros are filled, assume goals are set and redirect
        if (calories && protein && carbs && fat) {
          window.location.href = "macrotracking.html";
          return;
        }

        // Prefill form fields if partially completed
        document.getElementById("calories").value = calories || "";
        document.getElementById("protein").value = protein || "";
        document.getElementById("carbs").value = carbs || "";
        document.getElementById("fat").value = fat || "";
      }
    }

    await loadGoals();

    // 📝 Handle form submit
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const goalData = {
        user_id: userId,
        calories: +document.getElementById("calories").value,
        protein: +document.getElementById("protein").value,
        carbs: +document.getElementById("carbs").value,
        fat: +document.getElementById("fat").value,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("macro_goals")
        .upsert(goalData, { onConflict: ["user_id"] });

      if (error) {
        statusEl.textContent = "❌ Error saving goals.";
        statusEl.classList.add("text-red-600");
      } else {
        statusEl.textContent = "✅ Goals saved!";
        statusEl.classList.remove("text-red-600");
        statusEl.classList.add("text-green-600");

        // Redirect after short delay
        setTimeout(() => {
          window.location.href = "macrotracking.html";
        }, 1000);
      }
    });
  } catch (err) {
    console.error("Initialization error:", err);
  }
});
