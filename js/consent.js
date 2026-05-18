// GA4 consent banner (classic script — runs on every page that loads GA).
// Google Consent Mode default is set to DENIED in each page's inline snippet
// before gtag config; analytics only turns on if the visitor clicks Accept.
// No choice yet => show the banner. Choice stored per-origin in localStorage.
(function () {
  var KEY = "foolscap:consent";

  function read() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }
  function set(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {}
    if (window.gtag) {
      gtag("consent", "update", {
        analytics_storage: v === "granted" ? "granted" : "denied",
      });
    }
  }

  var stored = read();
  if (stored === "granted" || stored === "denied") return; // decided already

  function build() {
    var bar = document.createElement("div");
    bar.className = "consent-banner";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Analytics consent");
    bar.innerHTML =
      '<p>Foolscap uses Google Analytics for anonymous, aggregate usage statistics only. Your documents are never collected or sent anywhere. <a href="privacy.html">Privacy</a>.</p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="btn" id="cnDecline">Decline</button>' +
      '<button type="button" class="btn btn-primary" id="cnAccept">Accept</button>' +
      "</div>";
    document.body.appendChild(bar);
    bar.querySelector("#cnAccept").addEventListener("click", function () {
      set("granted");
      bar.remove();
    });
    bar.querySelector("#cnDecline").addEventListener("click", function () {
      set("denied");
      bar.remove();
    });
  }

  if (document.body) build();
  else document.addEventListener("DOMContentLoaded", build);
})();
