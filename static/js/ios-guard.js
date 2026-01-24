// iOS WebView global guard
(function () {
  const isIOSWebView =
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !window.navigator.standalone &&
    !/Safari/.test(navigator.userAgent);

  if (!isIOSWebView) return;

  document.addEventListener("DOMContentLoaded", () => {
    // Hide signup / subscribe links everywhere
    document
      .querySelectorAll('a[href*="signup"], a[href*="subscribe"]')
      .forEach(el => (el.style.display = "none"));
  });

  // Hard block direct navigation
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
  }
})();
