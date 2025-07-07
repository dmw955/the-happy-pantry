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
    const pageSize = 9;

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
        if (!showFavorites && isFavorited) return;

        const imagePath = `/static/assets/${recipe.image || "default.jpg"}`;
        const isChecked = selectedIds.includes(recipe.id.toString());

        const card = document.createElement("div");
        card.className =
          "relative bg-white rounded-xl shadow-md transition p-4 border border-gray-200";

        card.innerHTML = `
          <div class="absolute top-2 right-2 z-10 flex gap-2">
            <label class="flex items-center bg-white border border-gray-300 px-3 py-2 rounded-xl shadow-md text-sm md:text-base text-gray-800 cursor-pointer" style="min-width: 150px;">
              <input 
                type="checkbox" 
                class="recipe-select mr-2 scale-150" 
                data-id="${recipe.id}" 
                ${isChecked ? "checked" : ""}
              />
              <span class="select-none">Add to List</span>
            </label>
            <button 
              class="favorite-btn text-xl" 
              data-recipe-id="${recipe.id}">
              ${isFavorited ? "❤️" : "🤍"}
            </button>
          </div>

          <a href="/recipes/${recipe.slug}" class="block mt-10">
            <img src="${imagePath}" alt="${recipe.title}" class="mb-2 rounded-xl max-h-40 w-full object-cover" />
            <h3 class="text-xl font-semibold text-teal-700 mb-1">${recipe.title}</h3>
            <p class="text-sm text-gray-600">${recipe.description || ""}</p>
          </a>
        `;

        recipeContainer.appendChild(card);
      });

      nextPageBtn.disabled = currentPage >= Math.ceil(count / pageSize);
      prevPageBtn.disabled = currentPage === 1;

      setupCheckboxListeners();
      setupFavoriteListeners();
    }

    // Checkbox listeners
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

    // Favorite button listeners
    function setupFavoriteListeners() {
      document.querySelectorAll(".favorite-btn").forEach(button => {
        button.addEventListener("click", async () => {
          // Fetch fresh session at click
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
          } else {
            await supabaseClient
              .from("favorite_recipes")
              .insert([{ user_id: currentUser.id, recipe_id: recipeId }]);
            button.textContent = "❤️";
          }

          // Refresh list if not filtering to favorites only
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
  });
});
