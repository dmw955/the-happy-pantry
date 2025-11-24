function waitForSupabaseClient(callback) {
  if (window.supabaseClient) {
    callback(window.supabaseClient);
  } else {
    console.warn("⏳ Waiting for Supabase client...");
    setTimeout(() => waitForSupabaseClient(callback), 100);
  }
}

waitForSupabaseClient((supabaseClient) => {
  document.addEventListener("DOMContentLoaded", async () => {
    let user = null;

    let retries = 0;
    let session = null;
    while (!session?.user && retries < 15) {
      const res = await supabaseClient.auth.getSession();
      session = res?.data?.session;
      if (session?.user) {
        user = session.user;
        break;
      }
      await new Promise((res) => setTimeout(res, 100));
      retries++;
    }

    console.log("✅ Supabase session after retry:", user);

    if (!user) {
      console.warn("🔴 No Supabase user found — redirecting to login");
      window.location.href = "/login";
      return;
    }

    supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      user = newSession?.user;
      console.log("🔄 Supabase session updated:", user);
    });

    const recipeContainer = document.getElementById("recipeContainer");
    const pageInfo = document.getElementById("pageInfo");
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const showFavoritesToggle = document.getElementById("showFavoritesToggle");

    let currentPage = 1;
    const pageSize = 9;

    async function fetchRecipes() {
      const searchTerm = document.getElementById("searchInput")?.value.trim() || "";
      const category = document.getElementById("categoryFilter")?.value || "";
      const diet = document.getElementById("dietFilter")?.value || "";
      const sort = "random"; // Force random sort every time
      const showFavorites = showFavoritesToggle?.checked;

      let favoriteIds = [];
      const { data: favData } = await supabaseClient
        .from("favorite_recipes")
        .select("recipe_id")
        .eq("user_id", user.id);
      favoriteIds = favData?.map(item => item.recipe_id) || [];

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabaseClient
        .from("recipes")
        .select("*", { count: "exact" });

      if (sort === "random") {
        query = query.order("created_at", { ascending: false });
      } else {
        query = query.order(sort.split(".")[0], { ascending: sort.split(".")[1] === "asc" });
      }

      query = query.range(from, to);

      if (searchTerm) query = query.ilike("title", `%${searchTerm}%`);
if (category) query = query.eq("category", category);

if (diet) {
  query = query.contains("diet_tags", [diet]);
}




      const { data, error, count } = await query;
      if (sort === "random" && Array.isArray(data)) {
        data.sort(() => Math.random() - 0.5);
      }

      recipeContainer.innerHTML = "";
      pageInfo.textContent = `Page ${currentPage}`;

      if (error || !data) {
        console.error("🔥 Supabase error:", error);
        recipeContainer.innerHTML = '<p class="text-danger">Failed to load recipes.</p>';
        return;
      }

      const selectedIds = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");

      data.forEach(recipe => {
        const isFavorited = favoriteIds.includes(recipe.id);
        const imagePath = `/static/assets/${recipe.image || "default.jpg"}`;
        const isChecked = selectedIds.includes(String(recipe.id));

        const card = document.createElement("article");
        card.className = "recipe-card position-relative";

        card.innerHTML = `
          <div class="position-absolute" style="top:10px; right:10px; z-index:10; display:flex; gap:8px;">
            <label class="d-inline-flex align-items-center bg-white border border-gray-300 px-3 py-2 rounded-3 shadow-sm text-sm text-gray-800" style="min-width: 150px; cursor:pointer;">
              <input 
                type="checkbox" 
                class="recipe-select form-check-input me-2" 
                data-id="${recipe.id}" 
                ${isChecked ? "checked" : ""}
              />
              <span class="select-none">Add to List</span>
            </label>
            <button 
              class="favorite-btn text-xl p-2 bg-white rounded-3 border"
              title="${isFavorited ? "Unfavorite" : "Favorite"}"
              data-recipe-id="${recipe.id}">
              ${isFavorited ? "❤️" : "🤍"}
            </button>
          </div>

          <a href="/recipes/${recipe.slug}" class="stretched-link text-decoration-none text-reset" style="display:block; margin-top:52px;">
            <div class="thumb">
              <img src="${imagePath}" alt="${escapeHtml(recipe.title || "Recipe")}" />
            </div>
            <h3>${escapeHtml(recipe.title || "Untitled")}</h3>
            <div class="meta">
              ${[recipe.category || "", recipe.total_time ? formatTime(recipe.total_time) : ""].filter(Boolean).join(" · ")}
            </div>
            <p class="text-sm text-gray-600 mb-0">${escapeHtml(recipe.description || "")}</p>
          </a>
        `;

        recipeContainer.appendChild(card);
      });

      const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
      nextPageBtn.disabled = currentPage >= totalPages;
      prevPageBtn.disabled = currentPage === 1;

      setupCheckboxListeners();
      setupFavoriteListeners();
    }

    function setupCheckboxListeners() {
      document.querySelectorAll(".recipe-select").forEach(checkbox => {
        checkbox.addEventListener("change", () => {
          const selected = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");
          const id = checkbox.getAttribute("data-id");
          const idx = selected.indexOf(id);
          if (checkbox.checked && idx === -1) selected.push(id);
          else if (!checkbox.checked && idx !== -1) selected.splice(idx, 1);
          localStorage.setItem("selectedRecipes", JSON.stringify(selected));
        });
      });
    }

    function setupFavoriteListeners() {
      document.querySelectorAll(".favorite-btn").forEach(button => {
        button.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const recipeId = button.getAttribute("data-recipe-id");

          const { data: { session } } = await supabaseClient.auth.getSession();
          const currentUser = session?.user;
          if (!currentUser) {
            alert("You must be logged in to favorite recipes.");
            return;
          }

          const { data: existing, error } = await supabaseClient
            .from("favorite_recipes")
            .select("id")
            .eq("user_id", currentUser.id)
            .eq("recipe_id", recipeId)
            .maybeSingle();

          if (error) {
            console.error("❌ Error checking favorite state", error);
            return;
          }

          if (existing) {
            const { error: deleteError } = await supabaseClient
              .from("favorite_recipes")
              .delete()
              .match({ user_id: currentUser.id, recipe_id: recipeId });

            if (deleteError) {
              console.error("❌ Failed to unfavorite", deleteError);
            } else {
              button.textContent = "🤍";
              button.title = "Favorite";
            }
          } else {
            const { data: recipeData, error: fetchError } = await supabaseClient
              .from("recipes")
              .select("title, nutrition")
              .eq("id", recipeId)
              .maybeSingle();

            if (fetchError || !recipeData) {
              console.error("❌ Failed to fetch recipe details", fetchError);
              return;
            }

            const nutrition = recipeData.nutrition || {};
            const { Fat, Carbs, Protein } = nutrition;

            const macros = {
              calories: Math.round(
                (parseInt(Protein?.replace(" g", "")) || 0) * 4 +
                (parseInt(Carbs?.replace(" g", "")) || 0) * 4 +
                (parseInt(Fat?.replace(" g", "")) || 0) * 9
              ),
              fat: parseInt(Fat?.replace(" g", "")) || null,
              carbs: parseInt(Carbs?.replace(" g", "")) || null,
              protein: parseInt(Protein?.replace(" g", "")) || null
            };

            const { error: insertError } = await supabaseClient
              .from("favorite_recipes")
              .insert([{ user_id: currentUser.id, recipe_id: recipeId, title: recipeData.title, calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fat: macros.fat }]);

            if (insertError) {
              console.error("❌ Failed to favorite", insertError);
            } else {
              button.textContent = "❤️";
              button.title = "Unfavorite";
            }
          }

          if (!showFavoritesToggle?.checked) fetchRecipes();
        });
      });
    }

    // ✅ Filters trigger refresh on change
    document.getElementById("categoryFilter")?.addEventListener("change", () => {
      currentPage = 1;
      fetchRecipes();
    });

    document.getElementById("dietFilter")?.addEventListener("change", () => {
      currentPage = 1;
      fetchRecipes();
    });

    document.getElementById("sortFilter")?.addEventListener("change", () => {
      currentPage = 1;
      fetchRecipes();
    });

    document.getElementById("clearFilters")?.addEventListener("click", () => {
      document.getElementById("categoryFilter").value = "";
      document.getElementById("dietFilter").value = "";
      document.getElementById("sortFilter").value = "title.asc";
      document.getElementById("searchInput").value = "";
      currentPage = 1;
      fetchRecipes();
    });

    showFavoritesToggle?.addEventListener("change", fetchRecipes);
    nextPageBtn.addEventListener("click", () => { currentPage++; fetchRecipes(); });
    prevPageBtn.addEventListener("click", () => { if (currentPage > 1) currentPage--; fetchRecipes(); });

    fetchRecipes();

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[c]));
    }

    function formatTime(minutes) {
      if (!minutes || isNaN(minutes)) return "";
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hrs && mins) return `${hrs} hr ${mins} min`;
      if (hrs) return `${hrs} hr`;
      return `${mins} min`;
    }

    window.addEventListener("pantrypal:showRecipes", () => {
      document.getElementById("recipeContainer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
});