document.addEventListener("DOMContentLoaded", async () => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("User not logged in:", userError);
      window.location.href = "/login";
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
        .maybeSingle();

      if (error) {
        console.error("Error loading goals:", error);
        return;
      }

      if (data) {
        const { calories, protein, carbs, fat } = data;

        if (calories && protein && carbs && fat) {
          window.location.href = "/macrotracking"; // ✅ FIXED
          return;
        }

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

      const age = +document.getElementById("age").value;
      const gender = document.getElementById("gender").value;
      const height = +document.getElementById("height").value;
      const weight = +document.getElementById("weight").value;
      const activity = parseFloat(document.getElementById("activity").value);

      // Mifflin-St Jeor calculation
      let bmr;
      if (gender === "male") {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
      } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
      }

      const calories = Math.round(bmr * activity);
      const protein = Math.round((calories * 0.3) / 4);
      const fat = Math.round((calories * 0.3) / 9);
      const carbs = Math.round((calories * 0.4) / 4);

      document.getElementById("calories").value = calories;
      document.getElementById("protein").value = protein;
      document.getElementById("carbs").value = carbs;
      document.getElementById("fat").value = fat;

      const goalData = {
        user_id: userId,
        calories,
        protein,
        carbs,
        fat,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("macro_goals")
        .upsert(goalData, { onConflict: ["user_id"] });

      if (error) {
        statusEl.textContent = "❌ Error saving goals.";
        statusEl.classList.add("text-danger");
      } else {
        statusEl.textContent = "✅ Goals saved!";
        statusEl.classList.remove("text-danger");
        statusEl.classList.add("text-success");

        setTimeout(() => {
          window.location.href = "/macrotracking"; // ✅ FIXED
        }, 1000);
      }
    });
  } catch (err) {
    console.error("Initialization error:", err);
  }
});
