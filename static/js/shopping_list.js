document.addEventListener("DOMContentLoaded", async () => {
  console.log("🛒 Shopping list script loaded");

// ─── Supabase Client Setup ─────────────────────────────────────────────────
  const supabaseUrl = "https://ulaaelkluixsmqozeaaa.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFlbGtsdWl4c21xb3plYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MzQ5NDUsImV4cCI6MjA1NzMxMDk0NX0.FG3FEN51RpTmlr14vijyL_YM3jyt1lIok9Z4FsKhnMs";
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);


// ─── Fallback Category Mapping ───────────────────────────────────────────────
const FALLBACK_CATEGORY_KEYWORDS = {
  "Baking": ["chia seeds", "chia seeds or flax seeds"],
  "Condiment": ["hummus"],
  "Dairy": ["almond milk", "butter", "egg", "egg whites", "eggs", "eggs, beaten", "greek yogurt", "greek yogurt or sour cream", "low-fat mozzarella cheese, shredded", "milk", "milk (dairy or plant-based)", "nut butter (optional)", "parmesan", "parmesan cheese, grated", "ricotta cheese", "shredded cheddar cheese", "shredded cheddar or monterey jack cheese", "shredded mozzarella cheese", "swiss cheese slice", "swiss cheese, shredded", "unsalted butter, cold & cubed", "unsweetened almond milk"],
  "Grains": ["all-purpose flour", "breadcrumbs", "grits", "large flour tortillas", "noodles", "pizza crust", "rolled oats", "whole wheat tortilla", "whole wheat tortilla (10-inch)", "whole wheat wrap", "ziti pasta"],
  "Pantry": ["black beans, drained and rinsed", "brown sugar", "chicken broth", "crushed tomatoes", "fresh salsa (or pico de gallo)", "granola", "hot sauce (optional)", "maple syrup (optional)", "marinara sauce", "mustard", "olive oil", "salsa", "spaghetti", "taco seasoning", "tomato paste", "tomato sauce", "unsweetened cocoa powder", "vanilla extract"],
  "Produce": ["apples, peeled and sliced", "avocado", "avocado, sliced (optional)", "banana", "berries or granola (optional)", "blueberries", "bok choy", "broccoli", "broccolini", "carrots", "carrots, chopped", "celery stalks, chopped", "frozen mixed berries", "grated carrot", "lettuce leaves", "mushrooms, sliced", "onion, diced", "onion, sliced", "parsley, chopped", "red onion, sliced", "ripe avocado", "shredded lettuce", "tomato slices", "tomato, diced", "zucchini, sliced"],
  "Protein": ["chicken breast, cooked & diced", "chicken thighs", "firm tofu", "ground beef", "lean ground beef or turkey", "sea scallops", "turkey breast, sliced"],
  "Spices": ["bay leaf", "bell peppers", "bell peppers, sliced", "dried basil", "dried oregano", "garlic", "garlic clove, minced", "garlic cloves, minced"]
};


function assignFallbackGroup(name) {
  const l = name.toLowerCase();
  for (const [group, keywords] of Object.entries(FALLBACK_CATEGORY_KEYWORDS)) {
    if (keywords.some(k => l.includes(k))) {
      return group;
    }
  }
  return "Other";
}


// ─── Fetch & Render Shopping List ───────────────────────────────────────────
  const listContainer = document.getElementById("listContainer");
  const selectedIds = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");
  console.log("📦 Selected Recipe IDs:", selectedIds);

  if (selectedIds.length === 0) {
    listContainer.innerHTML = `<p class="text-red-600">⚠️ You haven't selected any recipes.</p>`;
    return;
  }

  function decimalToFraction(d) {
    const m = {0.125:'1/8',0.25:'1/4',0.333:'1/3',0.375:'3/8',0.5:'1/2',0.625:'5/8',0.666:'2/3',0.75:'3/4',0.875:'7/8'};
    const r = Math.round(d*1000)/1000;
    return m[r]||d.toFixed(2);
  }
  function decimalToMixedFraction(v) {
    const w = Math.floor(v), dec = v-w, frac = decimalToFraction(dec);
    return dec===0?`${w}`:w>0?`${w} ${frac}`:`${frac}`;
  }
  function convertFraction(q) {
    const m = {"½":0.5,"¼":0.25,"¾":0.75,"⅓":0.33,"⅔":0.67,"⅛":0.125,"⅜":0.375,"⅝":0.625,"⅞":0.875};
    return m[q]!==undefined?m[q]:parseFloat(q);
  }
  function safelyParseIngredient(i) {
    try { return typeof i==='string'?JSON.parse(i):i; }
    catch { console.warn("⚠️ Failed to parse ingredient:",i); return null; }
  }
  function categorizeIngredient(name) {
    const l = name.toLowerCase();
    if (["apple","avocado","broccoli","carrot","celery","lettuce","mushroom","onion","spinach","tomato","zucchini"].some(x=>l.includes(x))) return "Produce";
    if (["chicken","beef","pork","turkey","ham","sausage"].some(x=>l.includes(x))) return "Meats";
    if (["cheese","milk","cream","yogurt","butter"].some(x=>l.includes(x))) return "Dairy";
    if (["rice","pasta","quinoa","bread","flour","oats"].some(x=>l.includes(x))) return "Grains";
    if (["oil","sugar","honey","vinegar","ketchup","mustard"].some(x=>l.includes(x))) return "Pantry";
    if (["pepper","salt","basil","oregano","thyme","paprika","cumin"].some(x=>l.includes(x))) return "Spices";
    if (["frozen"].some(x=>l.includes(x))) return "Frozen";
    return "Other";
  }

  const { data: recipes, error } = await supabaseClient
    .from("recipes")
    .select("title, ingredients")
    .in("id", selectedIds);

  if (error) {
    console.error("Error fetching recipes:", error.message);
    listContainer.innerHTML = `<p class="text-red-500">Failed to load shopping list.</p>`;
    return;
  }

  const categoryGroups = {};
  recipes.forEach(r => {
    (r.ingredients||[]).forEach(raw => {
      const p = safelyParseIngredient(raw);
      if (!p?.item) return;
      const key = p.item.toLowerCase(), qty = convertFraction(p.quantity)||0;
      const cat = p.group?.trim() || assignFallbackGroup(p.item);
      categoryGroups[cat] = categoryGroups[cat]||{};
      if (!categoryGroups[cat][key]) categoryGroups[cat][key] = {...p,quantity:qty};
      else categoryGroups[cat][key].quantity += qty;
    });
  });

  const order = ["Produce","Spices","Meats","Dairy","Grains","Pantry","Frozen","Protein","Condiment","Baking","Other"];
  let html = "";
  order.forEach(cat => {
    if (!categoryGroups[cat]) return;
    html += `<h3 class="font-semibold text-lg mt-4">${cat}</h3><ul class="list-disc pl-5 space-y-1">`;
    Object.values(categoryGroups[cat]).forEach(it => {
      html += `<li>${decimalToMixedFraction(it.quantity)} ${it.unit||""} ${it.item}</li>`;
    });
    html += `</ul>`;
  });
  listContainer.innerHTML = html;

// ─── Clear List ─────────────────────────────────────────────────────────────
document.getElementById("clearListBtn")?.addEventListener("click", () => {
  localStorage.removeItem("selectedRecipes");
  location.reload();
});

// ─── Download PDF ───────────────────────────────────────────────────────────
document.getElementById("downloadPdfBtn")?.addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const element = document.getElementById("listContainer");

  // Load your logo
  const logo = new Image();
  logo.src = "/mnt/data/5d812932-cd59-4a80-8724-397e292ebb7f.png"; // ← path to uploaded logo
  await new Promise(resolve => {
    logo.onload = resolve;
    logo.onerror = resolve;
  });

  // Add logo to the top of the PDF
  doc.addImage(logo, 'PNG', 40, 30, 120, 40); // Adjust x, y, width, height as needed
  doc.setFontSize(18);
  doc.text("Shopping List", 180, 55);

  // Convert shopping list into checkbox lines
  let y = 100;
  const categories = element.querySelectorAll("h3");
  categories.forEach(cat => {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(cat.innerText, 40, y);
    y += 20;

    const list = cat.nextElementSibling?.querySelectorAll("li") || [];
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    list.forEach(li => {
      if (y > 780) {
        doc.addPage();
        y = 60;
      }
      doc.rect(40, y - 10, 10, 10); // checkbox
      doc.text(li.innerText, 60, y);
      y += 20;
    });

    y += 10;
  });

  doc.save("shopping_list.pdf");
});


// ─── Export to Calendar ─────────────────────────────────────────────────────
document.getElementById("exportCalendarBtn")?.addEventListener("click", () => {
  const listContainer = document.getElementById("listContainer");
  if (!listContainer) return;

  const allItems = Array.from(listContainer.querySelectorAll("h3")).flatMap((heading) => {
    const category = heading.textContent.trim();
    const list = heading.nextElementSibling;
    const items = list ? Array.from(list.querySelectorAll("li")).map(li => li.textContent.trim()) : [];

    return items.map(item => ({
      category,
      item
    }));
  });

  const mealMap = {
    "Breakfast": ["Grains", "Dairy", "Baking"],
    "Lunch": ["Protein", "Produce", "Pantry"],
    "Dinner": ["Meats", "Grains", "Produce"]
  };

  const mealTimes = {
    "Breakfast": "08:00",
    "Lunch": "12:00",
    "Dinner": "18:00"
  };

  const assignedMeals = {
    "Breakfast": [],
    "Lunch": [],
    "Dinner": []
  };

  const shuffledItems = [...allItems].sort(() => Math.random() - 0.5);

  shuffledItems.forEach(({ category, item }) => {
    for (const [meal, categories] of Object.entries(mealMap)) {
      if (categories.includes(category)) {
        assignedMeals[meal].push(`${item} (${category})`);
        break;
      }
    }
  });

  let icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\n`;

  Object.entries(assignedMeals).forEach(([meal, items], index) => {
    const date = new Date();
    date.setDate(date.getDate() + index); // spread across days
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = mealTimes[meal].replace(':', '') + '00';

    icsContent += `BEGIN:VEVENT\nSUMMARY:${meal} Plan\nDESCRIPTION:${items.join(', ').replace(/\n/g, '\\n')}\n`;
    icsContent += `DTSTART:${dateStr}T${timeStr}\nDTEND:${dateStr}T${timeStr}\nEND:VEVENT\n`;
  });

  icsContent += `END:VCALENDAR`;

  const blob = new Blob([icsContent], { type: "text/calendar" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "meal_plan.ics";
  link.click();
});

});