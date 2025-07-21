document.addEventListener("DOMContentLoaded", async () => {
  const user = (await supabase.auth.getUser()).data.user;
  const userId = user?.id;

  const form = document.getElementById("macro-goals-form");
  const statusEl = document.getElementById("goal-status");

  // Load existing macro goals
  async function loadGoals() {
    const { data, error } = await supabase
      .from("macro_goals")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data) {
      document.getElementById("calories").value = data.calories;
      document.getElementById("protein").value = data.protein;
      document.getElementById("carbs").value = data.carbs;
      document.getElementById("fat").value = data.fat;
    }

    if (error && error.code !== "PGRST116") {
      console.error("Error loading goals:", error);
    }
  }

  await loadGoals();

  // Handle form submit
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
      .upsert(goalData, { onConflict: ['user_id'] });

    if (error) {
      statusEl.textContent = "❌ Error saving goals.";
      statusEl.classList.add("text-red-600");
    } else {
      statusEl.textContent = "✅ Goals saved!";
      statusEl.classList.add("text-green-600");
    }
  });
});
