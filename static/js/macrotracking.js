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

// ✅ Get logs from the past 7 days using created_at (safer than relying on date field)
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
sevenDaysAgo.setHours(0, 0, 0, 0); // normalize to midnight

console.log("📅 Looking for entries created on/after:", sevenDaysAgo.toISOString());

const { data: weeklyLogs = [], error } = await supabase
  .from("macro_log")
  .select("created_at, date, name, protein, carbs, fat")
  .eq("user_id", cleanUserId)
  .gte("created_at", sevenDaysAgo.toISOString())
  .order("date", { ascending: true });

console.log("✅ Clean user ID:", cleanUserId);
console.log("📊 Weekly logs returned:", weeklyLogs);
if (error) {
  console.error("❌ Error loading macro logs:", error);
}


    weeklyTableBody.innerHTML = "";

    if (weeklyLogs.length === 0) {
      weeklyTableBody.innerHTML = `<tr><td colspan="5">No macros logged in the past 7 days.</td></tr>`;
    } else {
      weeklyLogs.forEach((entry) => {
        const calories = (entry.protein || 0) * 4 + (entry.carbs || 0) * 4 + (entry.fat || 0) * 9;
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

      const { error } = await supabase.from("macro_log").insert([{
        user_id: cleanUserId,
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

// ✅ USDA Search functionality with duplicate filtering & type prioritization
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

    // ✅ Step 1: Sort by data type — prefer Foundation/Survey over Branded
    const sortedFoods = data.foods.sort((a, b) => {
      const aType = a.dataType || "";
      const bType = b.dataType || "";
      return aType === "Branded" ? 1 : -1;
    });

    // ✅ Step 2: Filter to unique descriptions (case-insensitive)
    const seen = new Set();
    const uniqueFoods = sortedFoods.filter(food => {
      const desc = food.description.toLowerCase().trim();
      if (seen.has(desc)) return false;
      seen.add(desc);
      return true;
    }).slice(0, 10); // take top 10 unique items

    // ✅ Step 3: Render results
    usdaResultsContainer.innerHTML = uniqueFoods.map(food => {
      const name = food.description.replace(/'/g, "");
      const brand = food.brandOwner ? `<small class="text-muted">Brand: ${food.brandOwner}</small>` : "";

      return `
        <div class="card p-3 mb-3">
          <h6>${name}</h6>
          ${brand}
          <div class="mt-2">
            <button class="btn btn-primary-custom me-2" onclick="logUSDAFood('${food.fdcId}', '${name}')">Log This</button>
            <button class="btn btn-outline-success" onclick="saveAsRecipe('${food.fdcId}', '${name}')">Save as Recipe</button>
          </div>
        </div>`;
    }).join("");

  } catch (err) {
    console.error("USDA search error", err);
    usdaResultsContainer.innerHTML = "<p>Error searching food.</p>";
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
          user_id: cleanUserId,
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

    // ✅ Save as recipe (unchanged)
    window.saveAsRecipe = async (fdcId, name) => {
      try {
        const { data: existing } = await supabase
          .from("favorite_recipes")
          .select("id")
          .eq("user_id", cleanUserId)
          .eq("title", name)
          .maybeSingle();

        if (existing) {
          alert("⚠️ This recipe is already saved.");
          return;
        }

        const res = await fetch(`/usda/detail?fdcId=${fdcId}`);
        const data = await res.json();

        const nutrients = data.foodNutrients.reduce((acc, n) => {
          const label = n.nutrientName.toLowerCase();
          if (label.includes("protein")) acc.protein = n.value;
          if (label.includes("carbohydrate")) acc.carbs = n.value;
          if (label.includes("lipid") || label.includes("fat")) acc.fat = n.value;
          return acc;
        }, { protein: null, carbs: null, fat: null });

        if (
          nutrients.protein == null &&
          nutrients.carbs == null &&
          nutrients.fat == null
        ) {
          alert("⚠️ No macro data found for this item.");
          return;
        }

        const calories = 
          (nutrients.protein || 0) * 4 +
          (nutrients.carbs || 0) * 4 +
          (nutrients.fat || 0) * 9;

        const { error } = await supabase.from("favorite_recipes").insert([{
          user_id: cleanUserId,
          title: name,
          calories,
          protein: nutrients.protein,
          carbs: nutrients.carbs,
          fat: nutrients.fat,
          created_at: new Date().toISOString()
        }]);

        if (error) {
          alert("❌ Failed to save recipe.");
          console.error(error);
        } else {
          alert(`✅ Saved "${name}" as a recipe!`);
        }

      } catch (err) {
        console.error("Error saving recipe:", err);
        alert("❌ Error saving recipe.");
      }
    };

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

      const { data: favorites, error } = await supabase
        .from("favorite_recipes")
        .select("id, title, calories, protein, carbs, fat")
        .eq("user_id", cleanUserId);

      if (error || !favorites?.length) {
        favoritesContainer.innerHTML = "<p>No favorites found or error loading.</p>";
        console.error("Favorite fetch error:", error);
        return;
      }

      favoritesContainer.innerHTML = favorites.map(recipe => `
        <div class="col-md-4">
          <div class="card mb-3 p-3">
            <h5>${recipe.title}</h5>
            <p>Protein: ${recipe.protein}g<br>Carbs: ${recipe.carbs}g<br>Fat: ${recipe.fat}g<br>Calories: ${recipe.calories}</p>
            <button class="btn btn-sm btn-success mt-2" data-recipe-id="${recipe.id}" data-title="${recipe.title}">
              Log This
            </button>
          </div>
        </div>
      `).join("");

      favoritesContainer.querySelectorAll("button[data-recipe-id]").forEach(button => {
        button.addEventListener("click", async () => {
          const name = button.dataset.title;
          const recipe = favorites.find(r => r.id == button.dataset.recipeId);

          const { error: insertError } = await supabase.from("macro_log").insert([{
            user_id: cleanUserId,
            date: today,
            name,
            protein: recipe.protein,
            carbs: recipe.carbs,
            fat: recipe.fat,
            created_at: new Date().toISOString(),
          }]);

          if (insertError) {
            alert("❌ Error logging recipe");
            console.error(insertError);
          } else {
            alert(`✅ Logged "${name}"`);
            location.reload();
          }
        });
      });
    });

        // ✅ USDA Results Clear Button - Collapses and clears content
    const clearBtn = document.getElementById("clear-results-btn");
    const usdaResultsWrapper = document.getElementById("usda-results-wrapper");

    clearBtn?.addEventListener("click", () => {
      if (usdaResultsWrapper?.classList.contains("show")) {
        usdaResultsWrapper.classList.remove("show"); // Collapse results
      }
      usdaResultsContainer.innerHTML = ""; // Clear results content
    });


  } catch (err) {
    console.error("🔥 Unexpected error loading macro tracking:", err);
  }
  
});
