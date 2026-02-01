// App WebView global guard (iOS-only navigation enforcement)
(function () {
  const ua = navigator.userAgent || "";

  const isIOSWebView =
    /iPhone|iPad|iPod/.test(ua) &&
    !window.navigator.standalone &&
    !/Safari/.test(ua);

  const isAndroidWebView =
    /Android.*wv|HappyPantryAndroid/i.test(ua);

  const isAppWebView = isIOSWebView || isAndroidWebView;

  // Expose flags
  window.__IS_APP_WEBVIEW__ = isAppWebView;
  window.__IS_ANDROID_WEBVIEW__ = isAndroidWebView;

  if (!isAppWebView) return;

  // ---------------- DOM READY ----------------
  document.addEventListener("DOMContentLoaded", () => {

    // Hide signup / subscribe links everywhere (iOS + Android)
    document
      .querySelectorAll('a[href*="signup"], a[href*="subscribe"]')
      .forEach(el => (el.style.display = "none"));

    // Hide logout links on iOS
    if (isIOSWebView) {
      document
        .querySelectorAll('a[href*="logout"]')
        .forEach(el => (el.style.display = "none"));
    }

    // 🔒 Prevent HOME / LOGO navigation flash on iOS
    if (isIOSWebView) {
      document.addEventListener("click", e => {
        const link = e.target.closest("a");
        if (!link) return;

        const href = link.getAttribute("href");
        if (!href || href !== "/") return;

        e.preventDefault();

        const path = window.location.pathname;

        // On login page → stay on login
        if (path === "/login") {
          window.location.replace("/login");
          return;
        }

        // Everywhere else → dashboard
        window.location.replace("/dashboard");
      });
    }
  });

  const path = window.location.pathname;

  // ---------------- HARD BLOCK SIGNUP / SUBSCRIBE ----------------
  if (path.includes("signup") || path.includes("subscribe")) {
    document.body.innerHTML = `
      <div style="padding:2rem; text-align:center; font-family:system-ui;">
        <h2>Sign up on the website</h2>
        <p>
          To create an account or subscribe, please visit
          <br>
          <strong>the-happy-pantry.com</strong>
          in your browser.
        </p>
      </div>
    `;
    return;
  }

  // ---------------- HARD BLOCK LOGOUT ----------------
  if (path.includes("logout")) {
    window.location.replace("/login");
    return;
  }

  // ---------------- iOS LOGIN-FORWARD ENFORCEMENT ----------------
  if (!isIOSWebView) return;

  // 🚫 Blocked marketing routes inside the app
  const blockedRoutes = [
    "/",                 // index.html
    "/about",            // about.html
    "/contact",          // contact.html
    "/pantry_post",      // pantry_post.html
    "/pantry_project",   // pantry_project.html
    "/whyitworks"        // whyitworks.html
  ];

  // If user somehow hits a marketing page, send to dashboard
  if (blockedRoutes.includes(path)) {
    window.location.replace("/dashboard");
    return;
  }
})();
