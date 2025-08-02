document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== "/macrotracking") return;

  try {
    // ✅ Supabase singleton instance
    const supabase = window.supabase || (
      window.supabase = supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      )
    );

    const macroChartCanvas = document.getElementById("macroCircleChart");
    const weeklyTableBody = document.getElementById("weekly-macros");
    const usdaSearchForm = document.getElementById("usda-search-form");
    const usdaResultsContainer = document.getElementById("usda-results");

    // ✅ Check user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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

    // ✅ Daily macros
    const today = new Date().toISOString().split("T")[0];
    const { data: todayLogs = [] } = await supabase
      .from("macro_log")
      .select("protein, carbs, fat")
      .eq("user_id", user.id)
      .eq("date", today);

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
        datasets: [
          {
            label: "Consumed",
            data: [totals.carbs, totals.protein, totals.fat],
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
            borderWidth: 1,
          },
        ],
      },
      options: {
        cutout: "70%",
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });

    // ✅ Weekly macro logs
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
        </tr>
      `;
    });

    // ✅ Manual meal logging
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

    // ✅ USDA food search
    usdaSearchForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const query = document.getElementById("usda-search-input").value.trim();
      if (!query) return;

      usdaResultsContainer.innerHTML = "<p>Searching...</p>";

      try {
        const res = await fetch(`/usda/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (!data.foods || data.foods.length === 0) {
          usdaResultsContainer.innerHTML = "<p>No results found.</p>";
          return;
        }

        usdaResultsContainer.innerHTML = data.foods
          .slice(0, 10)
          .map(food => `
            <div class="card p-3 mb-2">
              <h6>${food.description}</h6>
              <button class="btn btn-primary-custom" onclick="logUSDAFood('${food.fdcId}', '${food.description.replace(/'/g, "")}')">Log This</button>
            </div>`).join("");

      } catch (err) {
        console.error("USDA search error", err);
        usdaResultsContainer.innerHTML = "<p>Error searching food.</p>";
      }
    });

    // ✅ USDA food log handler
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
