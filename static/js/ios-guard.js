// App WebView global guard (iOS only for navigation enforcement)
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

  // ---- DOM READY ----
  document.addEventListener("DOMContentLoaded", () => {

    // Hide signup / subscribe links everywhere (iOS + Android)
    document
      .querySelectorAll('a[href*="signup"], a[href*="subscribe"]')
      .forEach(el => (el.style.display = "none"));

    // 🔒 Prevent HOME / LOGO navigation flash on iOS
    if (isIOSWebView) {
      document.addEventListener("click", e => {
        const link = e.target.closest("a");
        if (!link) return;

        const href = link.getAttribute("href");
        if (!href) return;

        // ONLY intercept true homepage links
        if (href !== "/") return;

        e.preventDefault();

        const isLoggedIn =
          !!localStorage.getItem("access_token") ||
          !!localStorage.getItem("sb-access-token");

        window.location.replace(
          isLoggedIn ? "/dashboard" : "/login"
        );
      });
    }
  }); // ✅ <-- THIS WAS MISSING

  const path = window.location.pathname;

  // --- HARD BLOCK signup & subscribe routes ---
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

  // --- iOS LOGIN-FORWARD ENFORCEMENT ---
  if (!isIOSWebView) return;

  const isLoggedIn =
    !!localStorage.getItem("access_token") ||
    !!localStorage.getItem("sb-access-token");

  const allowedBeforeAuth = ["/login", "/dashboard"];

  // BEFORE login → force /login only (unless login is in progress)
  if (
    !isLoggedIn &&
    !window.__LOGIN_IN_PROGRESS__ &&
    !allowedBeforeAuth.includes(path)
  ) {
    window.location.replace("/login");
    return;
  }

  // AFTER login → block marketing pages
  const blockedAfterLogin = [
    "/",
    "/about",
    "/whyitworks",
    "/pantry_project",
    "/contact"
  ];

  if (isLoggedIn && blockedAfterLogin.includes(path)) {
    window.location.replace("/dashboard");
    return;
  }
})();
