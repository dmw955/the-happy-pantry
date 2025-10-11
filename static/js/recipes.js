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

    // Initial Supabase session load
    const { data: { session } } = await supabaseClient.auth.getSession();
    user = session?.user;
    console.log("✅ Initial Supabase session loaded:", user);

    // Listen for auth state changes
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
    const pageSize = 9; // ✅ enforce 9 per page

    // Fetch and render recipes
    async function fetchRecipes() {
      const searchTerm = document.getElementById("searchInput")?.value.trim() || "";
      const category = document.getElementById("categoryFilter")?.value || "";
      const diet = document.getElementById("dietFilter")?.value || "";
      const sort = document.getElementById("sortFilter")?.value || "title.asc";
      const showFavorites = showFavoritesToggle?.checked;

      let favoriteIds = [];
      if (user) {
        const { data: favData } = await supabaseClient
          .from("favorite_recipes")
          .select("recipe_id")
          .eq("user_id", user.id);
        favoriteIds = favData?.map(item => item.recipe_id) || [];
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabaseClient
        .from("recipes")
        .select("*", { count: "exact" })
        .order(sort.split(".")[0], { ascending: sort.split(".")[1] === "asc" })
        .range(from, to);

      if (searchTerm) query = query.ilike("title", `%${searchTerm}%`);
      if (category) query = query.eq("category", category);
      if (diet) query = query.contains("diet_tags", [diet]);

      // (Optional) If you later want the toggle to *filter* to only favorites:
      // if (showFavorites && favoriteIds.length) query = query.in("id", favoriteIds);

      const { data, error, count } = await query;

      recipeContainer.innerHTML = "";
      pageInfo.textContent = `Page ${currentPage}`;

      if (error || !data) {
        console.error("🔥 Supabase error:", error);
        recipeContainer.innerHTML = '<p class="text-red-500">Failed to load recipes.</p>';
        return;
      }

      const selectedIds = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");

      data.forEach(recipe => {
        const isFavorited = favoriteIds.includes(recipe.id);
        const imagePath = `/static/assets/${recipe.image || "default.jpg"}`;
        const isChecked = selectedIds.includes(String(recipe.id));

        // ✅ New card markup to match CSS: article.recipe-card + .thumb img
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

    ${[
    recipe.category || "",
    recipe.total_time ? formatTime(recipe.total_time) : ""
  ].filter(Boolean).join(" · ")}
</div>

            <p class="text-sm text-gray-600 mb-0">${escapeHtml(recipe.description || "")}</p>
          </a>
        `;

        recipeContainer.appendChild(card);
      });

      // Pagination state
      const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
      nextPageBtn.disabled = currentPage >= totalPages;
      prevPageBtn.disabled = currentPage === 1;

      // Wire up interactions
      setupCheckboxListeners();
      setupFavoriteListeners();
    }

    // Checkbox listeners (localStorage)
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

    // Favorite button listeners (Supabase)
    function setupFavoriteListeners() {
      document.querySelectorAll(".favorite-btn").forEach(button => {
        button.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Fresh session at click
          const { data: { session: clickSession } } = await supabaseClient.auth.getSession();
          const currentUser = clickSession?.user;
          console.log("❤️ User at click time:", currentUser);

          if (!currentUser) {
            alert("You must be logged in to favorite recipes.");
            return;
          }

          const recipeId = button.getAttribute("data-recipe-id");
          const isFav = button.textContent === "❤️";

          if (isFav) {
            await supabaseClient
              .from("favorite_recipes")
              .delete()
              .match({ user_id: currentUser.id, recipe_id: recipeId });
            button.textContent = "🤍";
            button.title = "Favorite";
          } else {
            await supabaseClient
              .from("favorite_recipes")
              .insert([{ user_id: currentUser.id, recipe_id: recipeId }]);
            button.textContent = "❤️";
            button.title = "Unfavorite";
          }

          // If you later enable "favorites only" filter, you might refetch here based on toggle
          if (!showFavoritesToggle?.checked) fetchRecipes();
        });
      });
    }

    // Pagination and toggle events
    showFavoritesToggle?.addEventListener("change", fetchRecipes);
    nextPageBtn.addEventListener("click", () => { currentPage++; fetchRecipes(); });
    prevPageBtn.addEventListener("click", () => { if (currentPage > 1) { currentPage--; fetchRecipes(); } });

    // Load recipes on page load
    fetchRecipes();

    // ---- Helpers ----
    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
      }[c]));
    }
        // ---- Helpers ----
    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c]));
    }

    // ✅ Add this new helper to fix the undefined error
    function formatTime(minutes) {
      if (!minutes || isNaN(minutes)) return "";
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hrs && mins) return `${hrs} hr ${mins} min`;
      if (hrs) return `${hrs} hr`;
      return `${mins} min`;
    }


    // (Optional) Hook PantryPal actions if you want basic behavior now:
    window.addEventListener("pantrypal:showRecipes", () => {
      document.getElementById("recipeContainer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    // Example for later:
    // window.addEventListener("pantrypal:applyFilters", (e) => {
    //   const detail = e.detail || {};
    //   // Map AI-suggested filters to your UI (e.g., time/protein not yet in UI)
    //   // For now, just refetch:
    //   fetchRecipes();
    // });
  });
});
