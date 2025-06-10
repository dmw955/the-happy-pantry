document.addEventListener("DOMContentLoaded", async () => {
  const supabaseUrl = "https://ulaaelkluixsmqozeaaa.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFlbGtsdWl4c21xb3plYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MzQ5NDUsImV4cCI6MjA1NzMxMDk0NX0.FG3FEN51RpTmlr14vijyL_YM3jyt1lIok9Z4FsKhnMs";
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

  // ✅ Wait for Supabase to restore session
  const { data: sessionData, error } = await supabaseClient.auth.getSession();
  if (!sessionData?.session) {
    console.warn("No session found — user may not be fully logged in.");
  } else {
    console.log("✅ Session restored:", sessionData.session.user);
  }

  // now continue safely with the rest of your logic...


  const recipeContainer = document.getElementById("recipeContainer");
  const pageInfo = document.getElementById("pageInfo");
  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");
  const showHiddenToggle = document.getElementById("showHiddenToggle");

  let currentPage = 1;
  const pageSize = 9;

  async function fetchRecipes() {
    const searchTerm = document.getElementById("searchInput").value.trim();
    const category = document.getElementById("categoryFilter").value;
    const diet = document.getElementById("dietFilter").value;
    const sort = document.getElementById("sortFilter").value || "title.asc";
    const showHidden = showHiddenToggle?.checked;

    const { data: userData } = await supabaseClient.auth.getUser();
    const user = userData?.user;
    let hiddenIds = [];

    if (user) {
      const { data: hiddenData } = await supabaseClient
        .from("hidden_recipes")
        .select("recipe_id")
        .eq("user_id", user.id);

      if (hiddenData) {
        hiddenIds = hiddenData.map(item => item.recipe_id);
      }
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

    data.forEach((recipe) => {
      const isHidden = hiddenIds.includes(recipe.id);
      if (isHidden && !showHidden) return;

      const imagePath = `/static/assets/${recipe.image || "default.jpg"}`;
      const isChecked = selectedIds.includes(recipe.id.toString());

      const card = document.createElement("div");
      card.className = "relative bg-white rounded-xl shadow-md transition p-4 border border-gray-200";

      if (showHidden && isHidden) {
        card.classList.add("opacity-50", "border-dashed");
      }

      card.innerHTML = `
        <div class="absolute top-2 right-2 z-10">
          <label class="flex items-center bg-white border border-gray-300 px-3 py-2 rounded-xl shadow-md text-sm md:text-base text-gray-800 cursor-pointer" style="min-width: 150px;">
            <input 
              type="checkbox" 
              class="recipe-select mr-2 scale-150" 
              data-id="${recipe.id}" 
              ${isChecked ? "checked" : ""}
            />
            <span class="select-none">Add to List</span>
          </label>
        </div>

        <a href="/recipes/${recipe.slug}" class="block">
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
      }

  function setupCheckboxListeners() {
    document.querySelectorAll(".recipe-select").forEach(checkbox => {
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
      });
    });
  }

   showHiddenToggle?.addEventListener("change", () => fetchRecipes());
  nextPageBtn.onclick = () => { currentPage++; fetchRecipes(); };
  prevPageBtn.onclick = () => { if (currentPage > 1) { currentPage--; fetchRecipes(); } };

  fetchRecipes();
});
