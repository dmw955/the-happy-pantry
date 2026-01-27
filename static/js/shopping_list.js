document.addEventListener("DOMContentLoaded", async () => {
  console.log("🛒 Shopping list script loaded");

  const shoppingList =
  JSON.parse(localStorage.getItem("shoppingList")) || [];


if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
  console.error("❌ Missing Supabase config");
  return;
}

const supabaseClient = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);


  // ─── Fetch & Render Shopping List ───────────────────────────────────────────
  const listContainer = document.getElementById("listContainer");
  const selectedIds = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");
  console.log("📦 Selected Recipe IDs:", selectedIds);

  if (selectedIds.length === 0) {
    listContainer.innerHTML = `<p class="text-red-600">⚠️ You haven't selected any recipes.</p>`;
    return;
  }

  // ─── Helper Functions ───────────────────────────────────────────────────────
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
    if (["apple","avocado","broccoli","carrot","celery","lettuce","mushroom","onion","spinach","tomato","zucchini"]
        .some(x=>l.includes(x))) return "Produce";
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
const CANONICAL_GROUPS = [
  "Produce",
  "Spices",
  "Meats",
  "Dairy",
  "Grains",
  "Pantry",
  "Frozen",
  "Other"
];

const GROUP_FUNNEL_MAP = {
  produce: "Produce",
  veggies: "Produce",
  vegetable: "Produce",
  vegetables: "Produce",
  fruit: "Produce",
  fruits: "Produce",

  protein: "Meats",
  meat: "Meats",
  meats: "Meats",
  poultry: "Meats",
  chicken: "Meats",
  beef: "Meats",
  pork: "Meats",
  turkey: "Meats",
  seafood: "Meats",
  fish: "Meats",

  dairy: "Dairy",
  cheese: "Dairy",
  milk: "Dairy",
  yogurt: "Dairy",
  butter: "Dairy",

  grain: "Grains",
  grains: "Grains",
  rice: "Grains",
  pasta: "Grains",
  bread: "Grains",
  oats: "Grains",
  quinoa: "Grains",

  pantry: "Pantry",
  oil: "Pantry",
  oils: "Pantry",
  condiment: "Pantry",
  condiments: "Pantry",
  sauce: "Pantry",
  sauces: "Pantry",

  spice: "Spices",
  spices: "Spices",
  herb: "Spices",
  herbs: "Spices",
  seasoning: "Spices",
  seasonings: "Spices",

  frozen: "Frozen",
  other: "Other"
};

function funnelGroup(rawGroup, itemName) {
  if (rawGroup) {
    const key = rawGroup.trim().toLowerCase();
    if (GROUP_FUNNEL_MAP[key]) return GROUP_FUNNEL_MAP[key];
  }

  const inferred = categorizeIngredient(itemName);
  const inferredKey = inferred.toLowerCase();

  if (GROUP_FUNNEL_MAP[inferredKey]) {
    return GROUP_FUNNEL_MAP[inferredKey];
  }

  return "Other";
}


  // ─── Group & Render ─────────────────────────────────────────────────────────
 const categoryGroups = {};
recipes.forEach(r => {
  (r.ingredients || []).forEach(raw => {
    const p = safelyParseIngredient(raw);
    if (!p?.item) return;

    const key = p.item.toLowerCase();
    const qty = convertFraction(p.quantity) || 0;

    // FIXED: use categorizeIngredient() instead of missing assignFallbackGroup()
    const cat = funnelGroup(p.group, p.item);



    categoryGroups[cat] = categoryGroups[cat] || {};

    if (!categoryGroups[cat][key]) {
      categoryGroups[cat][key] = { ...p, quantity: qty };
    } else {
      categoryGroups[cat][key].quantity += qty;
    }
  });
});


  const order = CANONICAL_GROUPS;

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

    // ─── Calendar Export (one category per day) ─────────────────────────────────
  const defaultTimes = {
    breakfast: { start: "070000", end: "080000" },
    lunch:     { start: "120000", end: "130000" },
    dinner:    { start: "180000", end: "190000" },
  };
  function toICSDate(d) {
    return d.toISOString().replace(/[-:.]/g, "").split("Z")[0] + "Z";
  }

  console.log("Calendar export setup");
  document.getElementById("exportCalendarBtn")?.addEventListener("click", async () => {
    console.log("Export button clicked");
    const ids = JSON.parse(localStorage.getItem("selectedRecipes") || "[]");
    if (!ids.length) {
      return alert("⚠️ No recipes selected to export.");
    }

    const { data: evts, error: err2 } = await supabaseClient
      .from("recipes")
      .select("id, slug, title, category")
      .in("id", ids);
    if (err2) {
      console.error("Calendar export fetch error:", err2);
      return alert("❌ Failed to fetch recipes for calendar export.");
    }

    // initialize ICS array
    let ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//The Happy Pantry//Meal Plan//EN"
    ];

    // track how many of each category
    const catCount = { breakfast: 0, lunch: 0, dinner: 0 };

    evts.forEach(r => {
      // normalize
      let key = (r.category || "dinner").toLowerCase();
      if (!defaultTimes[key]) {
        console.warn("Unknown category, falling back to dinner:", r.category);
        key = "dinner";
      }

      // increment and compute date
      catCount[key]++;
      const d = new Date();
      d.setDate(d.getDate() + catCount[key]);
      const dateStr = d.toISOString().split("T")[0].replace(/-/g, "");

      const t = defaultTimes[key];
      ics.push(
        "BEGIN:VEVENT",
        `UID:${r.id}@the-happy-pantry.com`,
        `DTSTAMP:${toICSDate(new Date())}`,
        `DTSTART:${dateStr}T${t.start}`,
        `DTEND:${dateStr}T${t.end}`,
        `SUMMARY:${r.title}`,
        `DESCRIPTION:View recipe → https://the-happy-pantry.com/recipes/${r.slug}`,
        "END:VEVENT"
      );
    });

    ics.push("END:VCALENDAR");

    const blob = new Blob([ics.join("\n")], { type: "text/calendar" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "happy-pantry-meal-plan.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });


// ─── PDF Export ─────────────────────────────────────────────────────────────
document.getElementById("downloadPdfBtn")?.addEventListener("click", () => {

if (window.__IS_ANDROID_WEBVIEW__) {
  fetch("https://www.the-happy-pantry.com/api/export/shopping_list.pdf", {
    credentials: "include"
  })
    .then(res => {
      if (!res.ok) {
        throw new Error("PDF export failed");
      }
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      window.location.href = url;
    })
    .catch(err => {
      console.error("Android PDF export error:", err);
      alert("Unable to export PDF. Please try again.");
    });

  return;
}


  // WEBSITE + iOS → client-side PDF
  const c = document.getElementById("listContainer");
  if (!c || !window.jspdf) return;


  const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  let y = 15;

  const logo = new Image();
  logo.src = "/static/assets/logo.png";
  logo.crossOrigin = "anonymous";

  logo.onload = () => {
    const logoWidth = 35;
    const logoHeight = logoWidth * (logo.height / logo.width);

    pdf.addImage(logo, "PNG", (w - logoWidth) / 2, y, logoWidth, logoHeight);
    y += logoHeight + 8;

    pdf.setFontSize(16);
    pdf.text("Shopping List", w / 2, y, { align: "center" });
    y += 10;

    // Recipes Selected
    pdf.setFontSize(15);
    pdf.text("Recipes Selected", w / 2, y, { align: "center" });
    y += 6;

    pdf.setFontSize(11);
    recipes.forEach(r => {
      if (y > h - 15) {
        pdf.addPage();
        y = 15;
      }
      pdf.text(`• ${r.title}`, 18, y);
      y += 5;
    });

    y += 6;
    pdf.line(15, y, w - 15, y);
    y += 8;

    // Ingredients
    c.querySelectorAll("h3").forEach(sec => {
      if (y > h - 15) {
        pdf.addPage();
        y = 15;
      }

      pdf.setFontSize(13);
      pdf.text(sec.textContent, 15, y);
      y += 4;

      sec.nextElementSibling?.querySelectorAll("li").forEach(li => {
        if (y > h - 15) {
          pdf.addPage();
          y = 15;
        }
        pdf.setFontSize(11);
        pdf.text("• " + li.textContent, 20, y);
        y += 5;
      });

      y += 3;
    });

    pdf.setFontSize(9);
    pdf.text(
      "Generated by The Happy Pantry • the-happy-pantry.com",
      w / 2,
      h - 10,
      { align: "center" }
    );

    // iOS WKWebView bridge
    if (window.webkit?.messageHandlers?.exportPDF) {
      const base64 = pdf.output("datauristring").split(",")[1];
      window.webkit.messageHandlers.exportPDF.postMessage({
        filename: "shopping_list.pdf",
        data: base64
      });
    } else {
      pdf.save("shopping_list.pdf");
    }
  };

  logo.onerror = () => {
    alert("Failed to load logo image.");
  };

}); // ← closes downloadPdfBtn click handler
}); // ← closes DOMContentLoaded
