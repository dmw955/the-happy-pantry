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
    const recipeContainer = document.getElementById("recipeContainer");
    const pageInfo = document.getElementById("pageInfo");
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");

    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const dietFilter = document.getElementById("dietFilter");
    const clearFilters = document.getElementById("clearFilters");

    let currentPage = 1;
    const pageSize = 9;
    let filteredRecipes = [];

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
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

    function shuffleArray(array) {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function getShuffleKey(searchTerm, category, diet) {
      return `recipeShuffle:${searchTerm}|${category}|${diet}`;
    }

    function applyStableShuffle(recipes, searchTerm, category, diet) {
      const shuffleKey = getShuffleKey(searchTerm, category, diet);
      const storedIds = JSON.parse(sessionStorage.getItem(shuffleKey) || "null");

      const recipeIds = recipes.map((recipe) => String(recipe.id));
      const validStoredOrder =
        Array.isArray(storedIds) &&
        storedIds.length === recipeIds.length &&
        storedIds.every((id) => recipeIds.includes(String(id)));

      let orderedIds;

      if (validStoredOrder) {
        orderedIds = storedIds;
      } else {
        orderedIds = shuffleArray(recipeIds);
        sessionStorage.setItem(shuffleKey, JSON.stringify(orderedIds));
      }

      const idIndexMap = new Map(orderedIds.map((id, index) => [String(id), index]));
      return [...recipes].sort((a, b) => {
        return (idIndexMap.get(String(a.id)) ?? 9999) - (idIndexMap.get(String(b.id)) ?? 9999);
      });
    }

    async function fetchRecipes() {
      const searchTerm = searchInput?.value.trim() || "";
      const category = categoryFilter?.value || "";
      const diet = dietFilter?.value || "";

      let query = supabaseClient
        .from("recipes")
        .select("*");

      if (searchTerm) query = query.ilike("title", `%${searchTerm}%`);
      if (category) query = query.eq("category", category);
      if (diet) query = query.contains("diet_tags", [diet]);

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error || !Array.isArray(data)) {
        console.error("🔥 Supabase error:", error);
        recipeContainer.innerHTML = '<p class="text-danger">Failed to load recipes.</p>';
        pageInfo.textContent = "";
        return;
      }

      filteredRecipes = applyStableShuffle(data, searchTerm, category, diet);
      renderRecipes();
    }

    function renderRecipes() {
      recipeContainer.innerHTML = "";

      const totalRecipes = filteredRecipes.length;
      const totalPages = Math.max(1, Math.ceil(totalRecipes / pageSize));
      currentPage = Math.min(currentPage, totalPages);

      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedRecipes = filteredRecipes.slice(startIndex, endIndex);

      if (paginatedRecipes.length === 0) {
        recipeContainer.innerHTML = '<p class="text-muted text-center mb-0">No recipes found.</p>';
      } else {
        const selectedIds = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");

        paginatedRecipes.forEach((recipe) => {
          const imagePath = `/static/assets/${recipe.image || "default.jpg"}`;
          const isChecked = selectedIds.includes(String(recipe.id));

          const card = document.createElement("article");
          card.className = "recipe-card position-relative";

          card.innerHTML = `
            <div class="position-absolute" style="top:10px; right:10px; z-index:10;">
              <label class="d-inline-flex align-items-center bg-white border px-3 py-2 rounded-3 shadow-sm small text-dark"
                     style="cursor:pointer;">
                <input
                  type="checkbox"
                  class="recipe-select form-check-input me-2"
                  data-id="${recipe.id}"
                  ${isChecked ? "checked" : ""}
                />
                <span>Add to List</span>
              </label>
            </div>

            <a href="/recipes/${recipe.slug}" class="stretched-link text-decoration-none text-reset" style="display:block; margin-top:52px;">
              <div class="thumb">
                <img src="${imagePath}" alt="${escapeHtml(recipe.title || "Recipe")}" />
              </div>
              <h3>${escapeHtml(recipe.title || "Untitled")}</h3>
              <div class="meta">
                ${[recipe.category || "", recipe.total_time ? formatTime(recipe.total_time) : ""].filter(Boolean).join(" · ")}
              </div>
              <p class="text-muted mb-0">${escapeHtml(recipe.description || "")}</p>
            </a>
          `;

          recipeContainer.appendChild(card);
        });

        setupCheckboxListeners();
      }

      pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      nextPageBtn.disabled = currentPage >= totalPages;
      prevPageBtn.disabled = currentPage === 1;
    }

    function setupCheckboxListeners() {
      document.querySelectorAll(".recipe-select").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const selected = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");
          const id = checkbox.getAttribute("data-id");
          const idx = selected.indexOf(id);

          if (checkbox.checked && idx === -1) {
            selected.push(id);
          } else if (!checkbox.checked && idx !== -1) {
            selected.splice(idx, 1);
          }

          localStorage.setItem("selectedRecipes", JSON.stringify(selected));
        });
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener("change", () => {
        currentPage = 1;
        fetchRecipes();
      });
    }

    if (dietFilter) {
      dietFilter.addEventListener("change", () => {
        currentPage = 1;
        fetchRecipes();
      });
    }

    if (clearFilters) {
      clearFilters.addEventListener("click", () => {
        if (categoryFilter) categoryFilter.value = "";
        if (dietFilter) dietFilter.value = "";
        if (searchInput) searchInput.value = "";

        currentPage = 1;
        fetchRecipes();
      });
    }

    if (searchInput) {
      let debounceTimeout;
      searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          currentPage = 1;
          fetchRecipes();
        }, 300);
      });
    } else {
      console.warn("⚠️ searchInput not found — skipping input listener");
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / pageSize));
        if (currentPage < totalPages) {
          currentPage++;
          renderRecipes();
          recipeContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    } else {
      console.warn("⚠️ nextPageBtn not found");
    }

    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          renderRecipes();
          recipeContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    } else {
      console.warn("⚠️ prevPageBtn not found");
    }

    window.addEventListener("pantrypal:showRecipes", () => {
      document.getElementById("recipeContainer")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    fetchRecipes();
  });
});