document.addEventListener("DOMContentLoaded", async () => {
  if (window.location.pathname !== "/macrotracking") return;

  try {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error("❌ Supabase not initialized.");

    const macroChartCanvas = document.getElementById("macroCircleChart");
    const macroSummary = document.getElementById("macro-summary");
    const usdaSearchForm = document.getElementById("usda-search-form");
    const usdaResultsContainer = document.getElementById("usda-results");

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
      window.location.href = "/login";
      return;
    }

    const cleanUserId = user.id.split(":")[0];
    const today = new Date().toISOString().split("T")[0];

    // ✅ Load macro goals
    const { data: goalData } = await supabase
      .from("macro_goals")
      .select("calories, protein, carbs, fat")
      .eq("user_id", cleanUserId)
      .maybeSingle();

    if (!goalData) return (window.location.href = "/macrogoals");

    // ✅ Load today's logs
const { data: todayLogsRaw } = await supabase
  .from("macro_log")
  .select("name, protein, carbs, fat")
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

    const caloriesConsumed =
      totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
    const caloriesRemaining = Math.max(goalData.calories - caloriesConsumed, 0);

// Update calorie stats below the chart
document.getElementById("calories-consumed").textContent = `${caloriesConsumed} kcal`;
document.getElementById("calories-remaining").textContent = `${caloriesRemaining} kcal`;


new Chart(macroChartCanvas, {
  type: "doughnut",
  data: {
    labels: ["Carbs", "Protein", "Fat"],
    datasets: [{
      label: "Consumed (g)",
      data: [totals.carbs, totals.protein, totals.fat],
      backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
      borderWidth: 2,
    }],
  },
  options: {
    cutout: "60%",
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.parsed;
            return `${label}: ${value}g`;
          }
        }
      }
    },
  },
});


 
    // ✅ Load 7-day macro log
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

   const todayMealsBody = document.getElementById("today-meals-body");
todayMealsBody.innerHTML = "";

if (todayLogs.length === 0) {
  todayMealsBody.innerHTML = `<tr><td colspan="5">No meals logged today.</td></tr>`;
} else {
  todayLogs.forEach((entry) => {
    const calories = (entry.protein || 0) * 4 +
                     (entry.carbs || 0) * 4 +
                     (entry.fat || 0) * 9;
    todayMealsBody.innerHTML += `
      <tr>
        <td>${entry.name || "—"}</td>
        <td>${entry.protein}</td>
        <td>${entry.carbs}</td>
        <td>${entry.fat}</td>
        <td>${Math.round(calories)}</td>
      </tr>`;
  });
}


    // ✅ USDA Search
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

usdaResultsContainer.innerHTML = uniqueFoods.map((food) => {
  const name = food.description.replace(/'/g, "");
  const nutrients = food.foodNutrients || [];

const protein = getNutrientValue(nutrients, "Protein") ?? 0;
const carbs = getNutrientValue(nutrients, "Carbohydrate") ?? 0;
const fat = getNutrientValue(nutrients, "Total lipid") ?? 0;
const calories = Math.round(protein * 4 + carbs * 4 + fat * 9);


return `
  <div class="card p-3 mb-3 usda-card"
       data-fdc-id="${food.fdcId}" 
       data-name="${name}" 
       data-protein="${protein}" 
       data-carbs="${carbs}" 
       data-fat="${fat}">
    <h6 class="mb-1">${name}</h6>
    <p class="mb-2">
      Protein: ${protein}g | Carbs: ${carbs}g | Fat: ${fat}g<br>
      <strong>Calories:</strong> ${calories}
    </p>

    <div class="mb-2">
      <label class="form-label form-label-sm d-block mb-0">Number of servings</label>
      <input type="number" class="form-control form-control-sm" 
             min="0.1" step="0.1" value="1" 
             placeholder="Servings" data-serving-input style="max-width: 120px;">
    </div>

<button class="btn btn-primary-custom btn-sm log-usda-btn">
  Log This
</button>

  </div>`;

}).join("");

  } catch (err) {
    console.error("USDA search error", err);
    usdaResultsContainer.innerHTML = "<p>Error searching food.</p>";
  }
});


document.querySelectorAll(".log-usda-btn").forEach(button => {
  button.addEventListener("click", async (e) => {
    const card = e.target.closest(".usda-card");

    const name = card.getAttribute("data-name");
    const fdcId = card.getAttribute("data-fdc-id");
    const baseProtein = parseFloat(card.getAttribute("data-protein"));
    const baseCarbs = parseFloat(card.getAttribute("data-carbs"));
    const baseFat = parseFloat(card.getAttribute("data-fat"));
    const baseCalories = parseFloat(card.getAttribute("data-calories"));
    const multiplier = parseFloat(card.querySelector("[data-serving-input]")?.value || "1");

    const protein = baseProtein * multiplier;
    const carbs = baseCarbs * multiplier;
    const fat = baseFat * multiplier;
    const calories = baseCalories * multiplier;

    if (protein === 0 && carbs === 0 && fat === 0) {
      alert("⚠️ No macro data found for this item.");
      return;
    }

    const { error } = await supabase.from("macro_log").insert([{
      user_id: cleanUserId,
      date: today,
      name,
      protein,
      carbs,
      fat,
      calories,
      created_at: new Date().toISOString(),
    }]);

    if (error) {
      alert("❌ Error logging food.");
      console.error(error);
    } else {
      alert(`✅ Logged "${name}" (${multiplier}x)`);
      location.reload();
    }
  });
});




    // ✅ Helper for nutrient extraction
    function getNutrient(arr, name) {
      const found = arr.find(n =>
        (n.nutrientName || "").toLowerCase().includes(name.toLowerCase())
      );
      return found?.value ?? 0;
    }

    // ✅ Clear Button
    const clearBtn = document.getElementById("clear-results-btn");
    const usdaResultsWrapper = document.getElementById("usda-results-wrapper");

    clearBtn?.addEventListener("click", () => {
      if (usdaResultsWrapper?.classList.contains("show")) {
        usdaResultsWrapper.classList.remove("show");
      }
      usdaResultsContainer.innerHTML = "";
    });

    // ✅ Favorite Recipes Collapse: Logging a saved recipe
const favCollapse = document.getElementById("fav-recipes-collapse");
const favoritesContainer = document.getElementById("favorite-recipes-container");
let favoritesLoaded = false;

favCollapse?.addEventListener("shown.bs.collapse", async () => {
  if (favoritesLoaded) return;
  favoritesLoaded = true;

  favoritesContainer.innerHTML = `
    <div class="text-center py-3">
      <div class="spinner-border text-success" role="status"></div>
      <p class="mt-2">Loading favorites...</p>
    </div>
  `;

  const { data: favorites, error: fetchError } = await supabase
    .from("favorite_recipes")
    .select(`
      id,
      title,
      calories,
      protein,
      carbs,
      fat,
      recipe:recipes (portion_note)
    `)
    .eq("user_id", cleanUserId);

  if (fetchError || !favorites?.length) {
    favoritesContainer.innerHTML = "<p>No favorites found or error loading.</p>";
    console.error("Favorite fetch error:", fetchError);
    return;
  }

  favoritesContainer.innerHTML = favorites.map(recipe => `
    <div class="col-md-4">
      <div class="card mb-3 p-3" 
           data-recipe-id="${recipe.id}" 
           data-title="${recipe.title}" 
           data-protein="${recipe.protein}" 
           data-carbs="${recipe.carbs}" 
           data-fat="${recipe.fat}">
        <h5>${recipe.title}</h5>
        <p>Protein: ${recipe.protein}g<br>Carbs: ${recipe.carbs}g<br>Fat: ${recipe.fat}g<br>Calories: ${recipe.calories}</p>

<div class="mb-1">
  <label class="form-label form-label-sm d-block mb-0">Number of servings</label>
  <input type="number" class="form-control form-control-sm" 
         min="0.1" step="0.1" value="1" 
         placeholder="Servings" data-serving-input style="max-width: 120px;">
</div>


        ${recipe.recipe?.portion_note ? `<small class="text-muted d-block mb-2">${recipe.recipe.portion_note}</small>` : ''}

        <button class="btn btn-sm btn-success" data-recipe-id="${recipe.id}">
          Log This
        </button>
      </div>
    </div>
  `).join("");

  favoritesContainer.querySelectorAll("button[data-recipe-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const card = button.closest(".card");
      const multiplier = parseFloat(card.querySelector("[data-serving-input]")?.value || "1");

      const name = card.getAttribute("data-title");
      const protein = parseFloat(card.getAttribute("data-protein")) * multiplier;
      const carbs = parseFloat(card.getAttribute("data-carbs")) * multiplier;
      const fat = parseFloat(card.getAttribute("data-fat")) * multiplier;

      const { error: insertError } = await supabase.from("macro_log").insert([{
        user_id: cleanUserId,
        date: today,
        name,
        protein,
        carbs,
        fat,
        created_at: new Date().toISOString(),
      }]);

      if (insertError) {
        alert("❌ Error logging recipe");
        console.error(insertError);
      } else {
        alert(`✅ Logged "${name}" (${multiplier}x)`);
        location.reload();
      }
    });
  });
});


  } catch (err) {
    console.error("🔥 Unexpected error:", err);
  }
});
