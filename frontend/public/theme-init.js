/*
 * Resolve the theme before first paint so the app never flashes
 * light-then-dark. Kept as an external, same-origin script so it
 * satisfies the `script-src 'self'` Content-Security-Policy.
 * Keep in sync with src/lib/theme.js.
 */
(function () {
  var theme = "light";
  try {
    var stored = localStorage.getItem("school-erp-theme");
    var prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
  } catch (error) {
    theme = "light";
  }
  document.documentElement.setAttribute("data-theme", theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1120" : "#4f46e5");
})();
