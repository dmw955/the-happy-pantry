document.addEventListener("DOMContentLoaded", async () => {
  console.log("🛒 Shopping list script loaded");

  // ─── Supabase Client Setup ─────────────────────────────────────────────────
  const supabaseUrl = "https://ulaaelkluixsmqozeaaa.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFlbGtsdWl4c21xb3plYWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MzQ5NDUsImV4cCI6MjA1NzMxMDk0NX0.FG3FEN51RpTmlr14vijyL_YM3jyt1lIok9Z4FsKhnMs";
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

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

  // ─── Group & Render ─────────────────────────────────────────────────────────
  const categoryGroups = {};
  recipes.forEach(r => {
    (r.ingredients||[]).forEach(raw => {
      const p = safelyParseIngredient(raw);
      if (!p?.item) return;
      const key = p.item.toLowerCase(), qty = convertFraction(p.quantity)||0;
      const cat = p.category || categorizeIngredient(p.item);
      categoryGroups[cat] = categoryGroups[cat]||{};
      if (!categoryGroups[cat][key]) categoryGroups[cat][key] = {...p,quantity:qty};
      else categoryGroups[cat][key].quantity += qty;
    });
  });

  const order = ["Produce","Spices","Meats","Dairy","Grains","Pantry","Frozen","Other"];
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
    const c = document.getElementById("listContainer");
    if (!c) return;
    const pdf = new window.jspdf.jsPDF("p","mm","a4");
    const w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight();
    let y = 15;

    const logo = new Image();
    logo.src = "/static/assets/logo.png";
    logo.crossOrigin = "anonymous";
    logo.onload = () => {
      pdf.addImage(logo,"PNG",(w-40)/2,y,40,15); y += 23;
      pdf.setFontSize(16).setTextColor(40).text("Shopping List",w/2,y,{align:"center"});
      y += 10;
      c.querySelectorAll("h3").forEach(sec => {
        pdf.setFontSize(13).setTextColor(60);
        y += 8; if (y>h-15){pdf.addPage();y=15;}
        pdf.text(sec.textContent,15,y);
        sec.nextElementSibling.querySelectorAll("li").forEach(li => {
          pdf.setDrawColor(180).rect(15,y+2,4,4);
          pdf.setFontSize(11).setTextColor(20);
          pdf.text(li.textContent,25,y+6);
          y += 10; if (y>h-15){pdf.addPage();y=15;}
        });
      });
      pdf.save("shopping_list.pdf");
    };
    logo.onerror = () => alert("❌ Failed to load logo image.");
  });

}); // end DOMContentLoaded
