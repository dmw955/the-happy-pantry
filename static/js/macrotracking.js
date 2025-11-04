document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== "/macrotracking") return;

  try {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error("❌ Supabase not initialized. Make sure auth.js runs before this script.");

    const macroChartCanvas = document.getElementById("macroCircleChart");
    const weeklyTableBody = document.getElementById("weekly-macros");
    const usdaSearchForm = document.getElementById("usda-search-form");
    const usdaResultsContainer = document.getElementById("usda-results");

    // ✅ Helper: Safely get nutrient values
    function getNutrientValue(nutrients, label) {
      const nutrient = nutrients.find(
        (n) =>
          typeof n.nutrientName === "string" &&
          n.nutrientName.toLowerCase().includes(label.toLowerCase())
      );
      return nutrient?.value ?? null;
    }

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

    const cleanUserId = user.id.split(":")[0]; // ✅ Fix for 400 error
    const today = new Date().toISOString().split("T")[0];

    const { data: goalData } = await supabase
      .from("macro_goals")
      .select("calories, protein, carbs, fat")
      .eq("user_id", cleanUserId)
      .maybeSingle();

    if (!goalData) {
      console.warn("No macro goals found, redirecting...");
      window.location.href = "/macrogoals";
      return;
    }

    const { data: todayLogsRaw } = await supabase
      .from("macro_log")
      .select("protein, carbs, fat")
      .eq("user_id", cleanUserId)
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
        plugins: { legend: { position: "bottom" } },
      },
    });

    // ✅ Get logs from the past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    console.log("📅 Looking for entries created on/after:", sevenDaysAgo.toISOString());

    const { data: weeklyLogs = [], error } = await supabase
      .from("macro_log")
      .select("created_at, date, name, protein, carbs, fat")
      .eq("user_id", cleanUserId)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("date", { ascending: true });

    console.log("✅ Clean user ID:", cleanUserId);
    console.log("📊 Weekly logs returned:", weeklyLogs);
    if (error) console.error("❌ Error loading macro logs:", error);

    weeklyTableBody.innerHTML = "";

    if (weeklyLogs.length === 0) {
      weeklyTableBody.innerHTML = `<tr><td colspan="5">No macros logged in the past 7 days.</td></tr>`;
    } else {
      weeklyLogs.forEach((entry) => {
        const calories =
          (entry.protein || 0) * 4 +
          (entry.carbs || 0) * 4 +
          (entry.fat || 0) * 9;
        weeklyTableBody.innerHTML += `
          <tr>
            <td>${entry.date}</td>
            <td>${entry.carbs || 0}</td>
            <td>${entry.protein || 0}</td>
            <td>${entry.fat || 0}</td>
            <td>${Math.round(calories)}</td>
          </tr>`;
      });
    }

    // ✅ Manual meal logging form
    const mealForm = document.getElementById("meal-form");
    mealForm?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("meal-name").value.trim();
      const protein = parseFloat(document.getElementById("protein").value);
      const carbs = parseFloat(document.getElementById("carbs").value);
      const fat = parseFloat(document.getElementById("fat").value);
      const logStatus = document.getElementById("log-status");

      const { error } = await supabase.from("macro_log").insert([
        {
          user_id: cleanUserId,
          date: today,
          name,
          protein,
          carbs,
          fat,
          created_at: new Date().toISOString(),
        },
      ]);

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

    // ✅ USDA Search with macros shown
    usdaSearchForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const query = document.getElementById("usda-search-input").value.trim();
      if (!query) return;

      usdaResultsContainer.innerHTML = "<p>Searching...</p>";

      try {
        const res = await fetch(`/usda/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (!data.foods?.length) {
          usdaResultsContainer.innerHTML = "<p>No results found.</p>";
          return;
        }

        const sortedFoods = data.foods.sort((a, b) => {
          const aType = a.dataType || "";
          const bType = b.dataType || "";
          return aType === "Branded" ? 1 : -1;
        });

        const seen = new Set();
        const uniqueFoods = sortedFoods.filter((food) => {
          const desc = food.description.toLowerCase().trim();
          if (seen.has(desc)) return false;
          seen.add(desc);
          return true;
        }).slice(0, 10);

        usdaResultsContainer.innerHTML = uniqueFoods
          .map((food) => {
            const name = food.description.replace(/'/g, "");
            const nutrients = food.foodNutrients || [];
            const protein = getNutrientValue(nutrients, "Protein") ?? 0;
            const carbs = getNutrientValue(nutrients, "Carbohydrate") ?? 0;
            const fat = getNutrientValue(nutrients, "Total lipid") ?? 0;

            return `
              <div class="card p-3 mb-3">
                <h6 class="mb-1">${name}</h6>
                <p class="mb-2">Protein: ${protein}g | Carbs: ${carbs}g | Fat: ${fat}g</p>
                <button class="btn btn-primary-custom" onclick="logUSDAFood(${food.fdcId}, '${name}')">Log This</button>
              </div>`;
          })
          .join("");
      } catch (err) {
        console.error("USDA search error", err);
        usdaResultsContainer.innerHTML = "<p>Error searching food.</p>";
      }
    });

    // ✅ Safe USDA Logging
    window.logUSDAFood = async (fdcId, name) => {
      try {
        const res = await fetch(`/usda/detail?fdcId=${fdcId}`);
        const data = await res.json();

        if (!Array.isArray(data.foodNutrients)) {
          alert("❌ This food has no nutrient data.");
          return;
        }

        const nutrients = data.foodNutrients.reduce(
          (acc, n) => {
            if (typeof n.nutrientName !== "string") return acc;
            const lname = n.nutrientName.toLowerCase();
            if (lname.includes("protein")) acc.protein = n.value;
            if (lname.includes("carbohydrate")) acc.carbs = n.value;
            if (lname.includes("lipid") || lname.includes("fat")) acc.fat = n.value;
            return acc;
          },
          { protein: 0, carbs: 0, fat: 0 }
        );

        const { error } = await supabase.from("macro_log").insert([
          {
            user_id: cleanUserId,
            date: today,
            name,
            protein: nutrients.protein,
            carbs: nutrients.carbs,
            fat: nutrients.fat,
            created_at: new Date().toISOString(),
          },
        ]);

        if (error) {
          alert("❌ Error logging food.");
          console.error(error);
        } else {
          alert(`✅ Logged "${name}"`);
          location.reload();
        }
      } catch (err) {
        console.error("Error logging USDA food", err);
        alert("❌ Unexpected error.");
      }
    };

    // ✅ Clear USDA Results
    const clearBtn = document.getElementById("clear-results-btn");
    const usdaResultsWrapper = document.getElementById("usda-results-wrapper");

    clearBtn?.addEventListener("click", () => {
      if (usdaResultsWrapper?.classList.contains("show")) {
        usdaResultsWrapper.classList.remove("show");
      }
      usdaResultsContainer.innerHTML = "";
    });
  } catch (err) {
    console.error("🔥 Unexpected error loading macro tracking:", err);
  }
});
