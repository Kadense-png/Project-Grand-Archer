// Opens/closes the mobile nav dropdown. Closes on link click, outside click, or Escape.

(function () {
  function init() {
    var toggle = document.getElementById("nav-toggle");
    var nav = document.querySelector(".main-nav");
    if (!toggle || !nav) return;

    function close() {
      nav.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      var opening = !nav.classList.contains("open");
      nav.classList.toggle("open", opening);
      toggle.classList.toggle("open", opening);
      toggle.setAttribute("aria-expanded", String(opening));
    });

    // Closes the menu when a real nav link is tapped (not the Log In button,
    // so its own dropdown can still open inside the still-open mobile menu).
    nav.querySelectorAll("ul a").forEach(function (link) {
      link.addEventListener("click", close);
    });

    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
