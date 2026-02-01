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

      // Hide profile links on iOS
      document
        .querySelectorAll('a[href*="profile"]')
        .forEach(el => (el.style.display = "none"));
    }

    // 🔒 Prevent HOME / LOGO navigation flash on iOS
    if (isIOSWebView) {
      document.addEventListener("click", e => {
        const link = e.target.closest("a");
        if (!link) return;

        const href = link.getAttribute("href");
        if (!href || href !== "/") return;

        const path = window.location.pathname;

        // 🚫 On login page: disable Home entirely
        if (path === "/login") {
          e.preventDefault();
          return;
        }

        // Everywhere else → dashboard
        e.preventDefault();
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
    "/",
    "/about",
    "/contact",
    "/pantry_post",
    "/pantry_project",
    "/whyitworks"
  ];

  if (blockedRoutes.includes(path)) {
    window.location.replace("/dashboard");
    return;
  }
})();
