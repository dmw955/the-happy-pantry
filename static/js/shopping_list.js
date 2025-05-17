document.addEventListener("DOMContentLoaded", async () => {
  console.log("🛒 Shopping list script loaded");

  const supabaseUrl = "https://ulaaelkluixsmqozeaaa.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFlbGtsdWl4c21xb3plYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MzQ5NDUsImV4cCI6MjA1NzMxMDk0NX0.FG3FEN51RpTmlr14vijyL_YM3jyt1lIok9Z4FsKhnMs";
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

  const listContainer = document.getElementById("listContainer");
  const selectedIds = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");

  console.log("📦 Selected Recipe IDs:", selectedIds);

  if (selectedIds.length === 0) {
    listContainer.innerHTML = `<p class="text-red-600">⚠️ You haven't selected any recipes.</p>`;
    return;
  }

  function decimalToFraction(decimal) {
    const lookup = {
      0.125: '1/8', 0.25: '1/4', 0.333: '1/3', 0.375: '3/8',
      0.5: '1/2', 0.625: '5/8', 0.666: '2/3', 0.75: '3/4', 0.875: '7/8'
    };
    const rounded = Math.round(decimal * 1000) / 1000;
    return lookup[rounded] || decimal.toFixed(2);
  }

  function decimalToMixedFraction(value) {
    const whole = Math.floor(value);
    const decimal = value - whole;
    const fraction = decimalToFraction(decimal);
    return decimal === 0 ? `${whole}` : whole > 0 ? `${whole} ${fraction}` : `${fraction}`;
  }

  function convertFraction(quantity) {
    const map = {
      "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.33, "⅔": 0.67,
      "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875
    };
    return map[quantity] !== undefined ? map[quantity] : parseFloat(quantity);
  }

  function safelyParseIngredient(item) {
    try {
      return typeof item === "string" ? JSON.parse(item) : item;
    } catch {
      console.warn("⚠️ Failed to parse ingredient:", item);
      return null;
    }
  }

  function categorizeIngredient(name) {
    const lower = name.toLowerCase();

    if ([
      "apple", "asparagus", "avocado", "baby carrots", "bell pepper", "bok choy",
      "broccoli", "broccoli florets", "brussels sprouts", "carrot ribbons", "carrots", "celery",
      "cucumber", "lettuce", "mushrooms", "onion", "red onion", "scallions", "shallot", "spinach",
      "tomatoes", "zucchini", "green onion", "pea shoots", "fresh parsley"
    ].some(i => lower.includes(i))) return "Produce";

    if ([
      "bacon", "beef", "beef broth", "beef sirloin", "beef stew meat", "chicken", "chicken breast",
      "chicken thighs", "ground beef", "ham", "pork", "sausage", "sirloin", "steak", "turkey"
    ].some(i => lower.includes(i))) return "Meats";

    if ([
      "butter", "cheddar", "cheese", "cream", "feta", "greek yogurt", "milk", "mozzarella",
      "parmesan", "sour cream", "yogurt", "heavy cream"
    ].some(i => lower.includes(i))) return "Dairy";

    if ([
      "breadcrumbs", "broth", "canned", "dijon", "garbanzo", "honey", "ketchup", "mayo", "mustard",
      "olive oil", "oil", "peanut butter", "soy sauce", "stock", "sugar", "syrup", "tomato paste",
      "tomato sauce", "vinegar", "worcestershire","artichoke"
    ].some(i => lower.includes(i))) return "Pantry";

    if ([
      "basil", "cayenne", "chili powder", "cumin", "garlic powder", "italian seasoning", "onion powder",
      "oregano", "paprika","pepper", "salt", "spice", "thyme", "seasoning"
    ].some(i => lower.includes(i))) return "Spices";

    if ([
      "bagel", "bread", "brown rice", "flour", "noodles", "oats", "orzo", "pasta", "quinoa", "rice",
      "spaghetti", "tortilla", "white rice", "whole wheat", "wrap"
    ].some(i => lower.includes(i))) return "Grains";

    if ([
      "frozen", "frozen broccoli", "frozen corn", "frozen peas", "mixed vegetables", "frozen berries"
    ].some(i => lower.includes(i))) return "Frozen";

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

  recipes.forEach(recipe => {
    if (Array.isArray(recipe.ingredients)) {
      recipe.ingredients.forEach(itemRaw => {
        const parsed = safelyParseIngredient(itemRaw);
        if (!parsed || !parsed.item) return;

        const key = parsed.item.toLowerCase();
        const quantity = convertFraction(parsed.quantity);
        const category = parsed.category || categorizeIngredient(parsed.item);

        if (!categoryGroups[category]) {
          categoryGroups[category] = {};
        }

        if (!categoryGroups[category][key]) {
          categoryGroups[category][key] = { ...parsed, quantity: quantity || 0 };
        } else {
          categoryGroups[category][key].quantity += quantity || 0;
        }
      });
    }
  });

  const categoryOrder = [
    "Produce", "Spices", "Meats", "Dairy", "Grains", "Pantry", "Frozen", "Other"
  ];

  let html = "";

  categoryOrder.forEach(category => {
    if (categoryGroups[category]) {
      html += `<h3 class="font-semibold text-lg mt-4">${category}</h3><ul class="list-disc pl-5 space-y-1">`;
      Object.values(categoryGroups[category]).forEach(item => {
        const displayQty = decimalToMixedFraction(item.quantity || 0);
        html += `<li>${displayQty} ${item.unit || ""} ${item.item}</li>`;
      });
      html += `</ul>`;
    }
  });

  listContainer.innerHTML = html;

  const clearBtn = document.getElementById("clearListBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      localStorage.removeItem("selectedRecipes");
      location.reload();
    });
  }
});
const pdfBtn = document.getElementById("downloadPdfBtn");

if (pdfBtn) {
  pdfBtn.addEventListener("click", async () => {
    const listContainer = document.getElementById("listContainer");
    if (!listContainer) return;

    const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // Load logo image
    const logoImg = new Image();
    logoImg.src = "/static/assets/logo.png";
    logoImg.crossOrigin = "anonymous";

    logoImg.onload = () => {
      const logoWidth = 40;
      const logoHeight = 15;

      pdf.addImage(
        logoImg,
        "PNG",
        (pageWidth - logoWidth) / 2,
        y,
        logoWidth,
        logoHeight
      );
      y += logoHeight + 8;

      // Header
      pdf.setFontSize(16);
      pdf.setTextColor(40);
      pdf.text("Shopping List", pageWidth / 2, y, { align: "center" });
      y += 10;

      // Get content from listContainer
      const sections = listContainer.querySelectorAll("h3");
      sections.forEach(section => {
        const category = section.textContent.trim();
        const ul = section.nextElementSibling;

        // Add category header
        pdf.setFontSize(13);
        pdf.setTextColor(60);
        y += 8;
        if (y > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(category, margin, y);

        // Add items
        ul.querySelectorAll("li").forEach(li => {
          const text = li.textContent.trim();
          y += 7;
          if (y > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }

          // Draw checkbox and item text
          pdf.setDrawColor(180);
          pdf.rect(margin, y - 4, 4, 4); // checkbox
          pdf.setFontSize(11);
          pdf.setTextColor(20);
          pdf.text(text, margin + 6, y);
        });
      });

      pdf.save("shopping_list.pdf");
    };

    logoImg.onerror = () => {
      alert("❌ Failed to load logo image.");
    };
  });
}
