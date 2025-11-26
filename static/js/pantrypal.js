const PantryPal = (() => {
  const state = {
  endpoint: "/api/pantrypal",
  els: {
    form: null,
    input: null,
    messages: null,
    typing: null,
    sheet: null,
    fab: null,
    backdrop: null
  },
  getContext: () => ({}),
  sending: false,
  debug: true // ← 🔍 this is what you're missing
};



  function $(sel) {
    return document.querySelector(sel);
  }

  function ensureEls(selectors) {
    state.els.form = $(selectors.form);
    state.els.input = $(selectors.input);
    state.els.messages = $(selectors.messages);
    state.els.typing = $(selectors.typing);
    state.els.sheet = $("#ppSheet");
    state.els.fab = $("#ppFab");
    state.els.backdrop = $("#ppBackdrop");

    if (!state.els.form || !state.els.input || !state.els.messages) {
      throw new Error("PantryPal: Missing required elements (form/input/messages)");
    }
  }

  function renderBubble(text, who = "user") {
    const wrap = document.createElement("div");
    wrap.className = `pp-bubble pp-${who}`;
    wrap.setAttribute("role", "status");
    wrap.textContent = text;
    state.els.messages.appendChild(wrap);
    state.els.messages.scrollTop = state.els.messages.scrollHeight;
  }

  function setTyping(on) {
    if (!state.els.typing) return;
    state.els.typing.hidden = !on;
  }

  async function sendToBackend(message) {
    const payload = {
      message,
      context: safeContext(state.getContext()),
    };

    const res = await fetch(state.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function safeContext(ctx) {
    try {
      return JSON.parse(JSON.stringify(ctx || {}));
    } catch {
      return {};
    }
  }
function validateResponse(data) {
  if (!data) {
    throw new Error("Missing response data");
  }

  // ✅ Normalize legacy field
  if (typeof data.message === "string" && !data.text) {
    data.text = data.message;
  }

  const hasText = typeof data.text === "string";
  const hasList = typeof data.shopping_list === "object";
  const hasReplacement = typeof data.replacement === "string";

  const hasRecognized = hasText || hasList || hasReplacement;

  if (!hasRecognized) {
    if (state.debug) {
      console.warn("🔍 Unrecognized AI response structure:", data);
    }
    throw new Error("Invalid AI response shape: no recognized fields");
  }

  if (data.actions && typeof data.actions !== "object") {
    throw new Error("Invalid AI response shape: actions must be an object if present");
  }

  return data;
}




  function dispatchActions(actions) {
    if (!actions || typeof actions !== "object") return;

    if (actions.applyFilters) {
      window.dispatchEvent(new CustomEvent("pp:applyFilters", { detail: actions.applyFilters }));
    }
    if (actions.showRecipes) {
      window.dispatchEvent(new CustomEvent("pp:showRecipes", { detail: actions.showRecipes }));
    }
    if (actions.suggestSwap) {
      window.dispatchEvent(new CustomEvent("pp:suggestSwap", { detail: actions.suggestSwap }));
    }
  }

async function handleSubmit(e) {
  e.preventDefault();
  if (state.sending) return;

  const message = (state.els.input.value || "").trim();
  if (!message) return;

  state.sending = true;
  renderBubble(message, "user");
  state.els.input.value = "";
  setTyping(true);

  try {
    const data = await sendToBackend(message);
    const valid = validateResponse(data);

    if (valid.text) {
      renderBubble(valid.text, "ai");
    } else if (valid.shopping_list) {
      renderBubble(formatShoppingList(valid.shopping_list), "ai");
    } else if (valid.replacement) {
      const reply = `You can replace it with **${valid.replacement}**.\n${valid.notes || ""}`;
      renderBubble(reply, "ai");
    }

    dispatchActions(valid.actions);
  } catch (err) {
    console.error("PantryPal error:", err);
    renderBubble("Sorry — I hit a snag. Try again in a moment.", "ai");
  } finally {
    setTyping(false);
    state.sending = false;
  }
}

  function installStylesOnce() {
    if (document.getElementById("pp-styles")) return;
    const css = document.createElement("style");
    css.id = "pp-styles";
    css.textContent = `
      .pp-bubble { max-width: 85%; margin: 8px 0; padding: 10px 12px; border-radius: 14px; line-height: 1.35; }
      .pp-user { margin-left: auto; background: #e8f7ff; }
      .pp-ai { margin-right: auto; background: #f0fdfa; border: 1px solid rgba(0,0,0,.06); }
      #ppTyping { font-size: .9rem; opacity: .8; margin-top: 6px; }
    `;
    document.head.appendChild(css);
  }

  function toggleChat(open) {
    const isOpen = open !== undefined ? open : !state.els.sheet.classList.contains("open");
    if (!state.els.sheet || !state.els.backdrop || !state.els.fab) return;

    state.els.sheet.classList.toggle("open", isOpen);
    state.els.backdrop.classList.toggle("open", isOpen);
    state.els.fab.setAttribute("aria-expanded", String(isOpen));
  }

  function init(opts = {}) {
    state.endpoint = opts.endpoint || state.endpoint;
    state.getContext = typeof opts.getContext === "function" ? opts.getContext : state.getContext;
    ensureEls(opts.selectors || {});
    installStylesOnce();

    state.els.form.addEventListener("submit", handleSubmit);
    state.els.fab?.addEventListener("click", () => toggleChat(true));
    state.els.backdrop?.addEventListener("click", () => toggleChat(false));
  }

  function formatShoppingList(list) {
  let output = "🛒 Here's your shopping list:\n";
  for (const [category, items] of Object.entries(list)) {
    output += `\n${category}:\n`;
    items.forEach(item => {
      output += `• ${item}\n`;
    });
  }
  return output;
}


  return { init };
})();

// ---------------------------
// Event listeners
// ---------------------------
window.addEventListener("pp:applyFilters", (e) => {
  if (window.applyRecipeFilters) {
    window.applyRecipeFilters(e.detail);
  } else {
    console.debug("pp:applyFilters", e.detail);
  }
});

window.addEventListener("pp:showRecipes", (e) => {
  if (window.showRecipesLimit) {
    window.showRecipesLimit(e.detail.limit || 6);
  } else {
    console.debug("pp:showRecipes", e.detail);
  }
});

window.addEventListener("pp:suggestSwap", (e) => {
  if (window.showSwapSuggestion) {
    window.showSwapSuggestion(e.detail);
  } else {
    console.debug("pp:suggestSwap", e.detail);
    try {
      const msg = document.createElement("div");
      msg.textContent = `Swap suggestion: ${e.detail.from} → ${e.detail.to}`;
      msg.style.position = "fixed";
      msg.style.bottom = "16px";
      msg.style.left = "50%";
      msg.style.transform = "translateX(-50%)";
      msg.style.padding = "10px 12px";
      msg.style.borderRadius = "12px";
      msg.style.background = "#111";
      msg.style.color = "#fff";
      msg.style.zIndex = "9999";
      document.body.appendChild(msg);
      setTimeout(() => msg.remove(), 3000);
    } catch {}
  }
});

// ✅ Initialize PantryPal
PantryPal.init({
  selectors: {
    form: "#ppForm",
    input: "#ppInput",
    messages: "#ppMessages",
    typing: "#ppTyping"
  },
  getContext: () => ({
    recipeTitle: window.currentRecipe?.title || document.querySelector("h1")?.textContent || "",
    ingredients: window.currentRecipe?.ingredients || [],
    page: "recipe"
  })
});
