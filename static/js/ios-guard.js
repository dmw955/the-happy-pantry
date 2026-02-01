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

  document.addEventListener("DOMContentLoaded", () => {
    // Hide signup / subscribe links everywhere (iOS + Android)
    document
      .querySelectorAll('a[href*="signup"], a[href*="subscribe"]')
      .forEach(el => (el.style.display = "none"));
  });

  // --- HARD BLOCK signup & subscribe routes ---
  if (
    window.location.pathname.includes("signup") ||
    window.location.pathname.includes("subscribe")
  ) {
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

  const path = window.location.pathname;

  // Adjust this if your auth token name differs
  const isLoggedIn = !!localStorage.getItem("access_token");

  // BEFORE login → force /login only
  if (!isLoggedIn && path !== "/login") {
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

  if (!isLoggedIn && !window.__LOGIN_IN_PROGRESS__ && !allowedBeforeAuth.includes(path)) {
  window.location.replace("/login");
  return;
}

})();
