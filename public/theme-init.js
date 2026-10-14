(function () {
  try {
    var stored = window.localStorage.getItem("mimico-theme");
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {
    document.documentElement.style.colorScheme = "light";
  }
})();
