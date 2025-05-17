document.addEventListener("DOMContentLoaded", () => {
  const supabaseUrl = "https://ulaaelkluixsmqozeaaa.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFlbGtsdWl4c21xb3plYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MzQ5NDUsImV4cCI6MjA1NzMxMDk0NX0.FG3FEN51RpTmlr14vijyL_YM3jyt1lIok9Z4FsKhnMs";
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

  console.log("📦 [recipes.js] Supabase client initialized");

  const recipeContainer = document.getElementById("recipeContainer");
  const pageInfo = document.getElementById("pageInfo");
  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");

  let currentPage = 1;
  const pageSize = 9;

  async function fetchRecipes() {
    console.log("📡 Fetching recipes...");

    const searchTerm = document.getElementById("searchInput").value.trim();
    const category = document.getElementById("categoryFilter").value;
    const diet = document.getElementById("dietFilter").value;
    const sort = document.getElementById("sortFilter").value || "title.asc";

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

    if (error) {
      console.error("❌ Supabase error:", error.message);
      recipeContainer.innerHTML = '<p class="text-red-500">Failed to load recipes.</p>';
      return;
    }

    console.log("✅ Recipes fetched:", data);
    console.log("📊 Total matching recipes:", count);

    if (!data || data.length === 0) {
      recipeContainer.innerHTML = '<p class="text-gray-600">No recipes found.</p>';
      nextPageBtn.disabled = true;
      prevPageBtn.disabled = currentPage === 1;
      return;
    }

    data.forEach((recipe) => {
      const imagePath = `/static/assets/${recipe.image || "default.jpg"}`;
      const selectedIds = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");
      const isChecked = selectedIds.includes(recipe.id.toString());

      recipeContainer.innerHTML += `
        <div class="relative bg-white rounded-xl shadow-md transition p-4 border border-gray-200">
          <input 
            type="checkbox" 
            class="recipe-select absolute top-2 right-2 w-5 h-5" 
            data-id="${recipe.id}" 
            ${isChecked ? "checked" : ""}
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            title="Select this recipe to add it to your shopping list."
          />
          <a href="/recipes/${recipe.slug}" class="block">
            <img src="${imagePath}" alt="${recipe.title}" class="mb-2 rounded-xl max-h-40 w-full object-cover" />
            <h3 class="text-xl font-semibold text-teal-700 mb-1">${recipe.title}</h3>
            <p class="text-sm text-gray-600">${recipe.description || ""}</p>
          </a>
        </div>
      `;
    });

    const totalPages = Math.ceil(count / pageSize);
    nextPageBtn.disabled = currentPage >= totalPages;
    prevPageBtn.disabled = currentPage === 1;

    setupCheckboxListeners();
    initializeTooltips();
  }

  function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // ✅ Mobile Support for Long Press
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
      if ('ontouchstart' in window) {
        tooltipTriggerEl.addEventListener('touchstart', (e) => {
          e.preventDefault();
          const tooltipInstance = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
          tooltipInstance.show();
          setTimeout(() => tooltipInstance.hide(), 1500);
        });
      }
    });

    console.log("🛠️ Tooltips initialized for recipe checkboxes.");
  }

  function setupCheckboxListeners() {
    const checkboxes = document.querySelectorAll(".recipe-select");

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener("change", () => {
        const selectedIds = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");
        const recipeId = checkbox.getAttribute("data-id");
        const index = selectedIds.indexOf(recipeId);

        if (checkbox.checked && index === -1) {
          selectedIds.push(recipeId);
        } else if (!checkbox.checked && index !== -1) {
          selectedIds.splice(index, 1);
        }

        localStorage.setItem("selectedRecipes", JSON.stringify(selectedIds));
        console.log("✅ Selected Recipes:", selectedIds);
      });
    });
  }

  fetchRecipes();
});