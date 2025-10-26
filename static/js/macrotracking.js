document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== "/macrotracking") return;

  try {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error("❌ Supabase not initialized. Make sure auth.js runs before this script.");

    const macroChartCanvas = document.getElementById("macroCircleChart");
    const weeklyTableBody = document.getElementById("weekly-macros");
    const usdaSearchForm = document.getElementById("usda-search-form");
    const usdaResultsContainer = document.getElementById("usda-results");

    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (authError || !user) {
      console.warn("User not logged in:", authError);
      window.location.href = "/login";
      return;
    }

    const { data: goalData } = await supabase
      .from("macro_goals")
      .select("calories, protein, carbs, fat")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!goalData) {
      console.warn("No macro goals found, redirecting...");
      window.location.href = "/macrogoals";
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: todayLogsRaw } = await supabase
      .from("macro_log")
      .select("protein, carbs, fat")
      .eq("user_id", user.id)
      .eq("date", today);

    const todayLogs = Array.isArray(todayLogsRaw) ? todayLogsRaw : [];

    const totals = todayLogs.reduce(
      (acc, entry) => {
        acc.protein += entry.protein || 0;
        acc.carbs += entry.carbs || 0;
        acc.fat += entry.fat || 0;
        return acc;
      },
      { protein: 0, carbs: 0, fat: 0 }
    );

    new Chart(macroChartCanvas, {
      type: "doughnut",
      data: {
        labels: ["Carbs", "Protein", "Fat"],
        datasets: [{
          label: "Consumed",
          data: [totals.carbs, totals.protein, totals.fat],
          backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
          borderWidth: 1,
        }],
      },
      options: {
        cutout: "70%",
        plugins: { legend: { position: "bottom" } },
      },
    });

    const { data: weeklyLogs = [] } = await supabase
      .from("macro_log")
      .select("date, protein, carbs, fat")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(7);

    weeklyTableBody.innerHTML = "";
    weeklyLogs.forEach((entry) => {
      const calories = entry.protein * 4 + entry.carbs * 4 + entry.fat * 9;
      weeklyTableBody.innerHTML += `
        <tr>
          <td>${entry.date}</td>
          <td>${entry.carbs}</td>
          <td>${entry.protein}</td>
          <td>${entry.fat}</td>
          <td>${calories}</td>
        </tr>`;
    });

    const mealForm = document.getElementById("meal-form");
    mealForm?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("meal-name").value.trim();
      const protein = parseFloat(document.getElementById("protein").value);
      const carbs = parseFloat(document.getElementById("carbs").value);
      const fat = parseFloat(document.getElementById("fat").value);
      const logStatus = document.getElementById("log-status");

      const { error } = await supabase.from("macro_log").insert([{
        user_id: user.id,
        date: today,
        name,
        protein,
        carbs,
        fat,
        created_at: new Date().toISOString(),
      }]);

      if (error) {
        logStatus.textContent = "❌ Failed to log meal.";
        logStatus.classList.add("text-danger");
      } else {
        logStatus.textContent = "✅ Meal logged!";
        logStatus.classList.remove("text-danger");
        logStatus.classList.add("text-success");
        setTimeout(() => location.reload(), 1000);
      }
    });

    usdaSearchForm?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const inputEl = document.getElementById("usda-search-input");
      const query = inputEl.value.trim();
      const resultsBox = document.getElementById("usda-results");

      if (!query) return;

      resultsBox.innerHTML = `
        <div class="text-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-2">Searching USDA foods...</p>
        </div>`;

      try {
        const res = await fetch(`/usda/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (!data.foods?.length) {
          resultsBox.innerHTML = "<p class='text-danger'>No results found. Try a different food name.</p>";
          return;
        }

        resultsBox.innerHTML = data.foods.slice(0, 10).map(food => `
          <div class="card p-3 mb-2 shadow-sm">
            <h6 class="mb-1">${food.description}</h6>
            <small class="text-muted">FDC ID: ${food.fdcId}</small>
            <button class="btn btn-primary-custom mt-2" onclick="logUSDAFood('${food.fdcId}', '${food.description.replace(/'/g, "")}')">
              Log This
            </button>
          </div>
        `).join("");

        inputEl.value = "";

      } catch (err) {
        console.error("USDA search error:", err);
        resultsBox.innerHTML = "<p class='text-danger'>Something went wrong. Please try again.</p>";
      }
    });

    window.logUSDAFood = async (fdcId, name) => {
      try {
        const res = await fetch(`/usda/detail?fdcId=${fdcId}`);
        const data = await res.json();

        const nutrients = data.foodNutrients.reduce((acc, n) => {
          if (n.nutrientName.includes("Protein")) acc.protein = n.value;
          if (n.nutrientName.includes("Carbohydrate")) acc.carbs = n.value;
          if (n.nutrientName.includes("Total lipid")) acc.fat = n.value;
          return acc;
        }, { protein: 0, carbs: 0, fat: 0 });

        const { error } = await supabase.from("macro_log").insert([{
          user_id: user.id,
          date: today,
          name,
          protein: nutrients.protein,
          carbs: nutrients.carbs,
          fat: nutrients.fat,
          created_at: new Date().toISOString(),
        }]);

        if (error) alert("❌ Error logging food.");
        else {
          alert("✅ Logged " + name);
          location.reload();
        }
      } catch (err) {
        console.error("Error logging USDA food", err);
      }
    };

  } catch (err) {
    console.error("🔥 Unexpected error loading macro tracking:", err);
  }
});
