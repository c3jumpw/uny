/*!
 * UnyBase licence check for static websites and browser-only apps.
 *
 *   <script src="https://unybase.unywebs.com/license.js" data-key="unyl_…"></script>
 *
 * Put it in <head>. It asks UnyBase whether this site may run, about
 * once a minute, and covers the page with a neutral "temporarily
 * unavailable" notice only when Unywebs has paused the site.
 *
 * It fails open: if UnyBase cannot be reached, or the key is wrong, the
 * site keeps working on the last answer it saw (or normally, if none).
 *
 * The current answer is published for the app's own code:
 *   window.unybaseLicense            { status, owner_message, ... }
 *   window "unybase-license" event   detail = the same object
 * Use them to show owner_message to the client's own staff (for example
 * in an admin area) during "grace". Never show it to the public.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var key = (script.getAttribute("data-key") || "").trim();
  if (!key) {
    console.warn("[UnyBase] license.js loaded without data-key; skipping the check.");
    return;
  }
  var endpoint =
    script.getAttribute("data-endpoint") ||
    new URL(script.src, location.href).origin + "/api/license/status";
  var storeKey = "unybase-license:" + key.slice(0, 12);
  var overlayId = "unybase-paused";
  var retryAfterFailureMs = 60000;
  var nextAllowedFetch = 0;

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(storeKey) || "null");
    } catch (e) {
      return null;
    }
  }
  function writeCache(value) {
    try {
      localStorage.setItem(storeKey, JSON.stringify(value));
    } catch (e) {
      /* private mode or storage blocked: the in-page state still works */
    }
  }

  function publish(value) {
    window.unybaseLicense = value;
    try {
      window.dispatchEvent(new CustomEvent("unybase-license", { detail: value }));
    } catch (e) {
      /* very old browsers: window.unybaseLicense is still set */
    }
  }

  function showPaused(message) {
    if (document.getElementById(overlayId)) return;
    var style = document.createElement("style");
    style.id = overlayId + "-style";
    style.textContent =
      "html.unybase-paused,html.unybase-paused body{overflow:hidden!important}" +
      "#" + overlayId + "{position:fixed;inset:0;z-index:2147483647;display:flex;" +
      "align-items:center;justify-content:center;padding:24px;background:#f6f7f9;" +
      "color:#1d2433;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center}" +
      "#" + overlayId + " div{max-width:420px}" +
      "#" + overlayId + " h1{font-size:22px;margin:0 0 8px;font-weight:600}" +
      "#" + overlayId + " p{margin:0;color:#4a5466}" +
      "@media (prefers-color-scheme:dark){#" + overlayId + "{background:#0f141c;color:#e7ebf2}" +
      "#" + overlayId + " p{color:#a9b2c3}}";
    (document.head || document.documentElement).appendChild(style);

    var box = document.createElement("div");
    box.id = overlayId;
    box.setAttribute("role", "alert");
    var inner = document.createElement("div");
    var h = document.createElement("h1");
    h.textContent = "Temporarily unavailable";
    var p = document.createElement("p");
    p.textContent = message || "Please check back soon.";
    inner.appendChild(h);
    inner.appendChild(p);
    box.appendChild(inner);
    document.documentElement.appendChild(box);
    document.documentElement.classList.add("unybase-paused");
  }

  function clearPaused() {
    var box = document.getElementById(overlayId);
    if (box) box.remove();
    var style = document.getElementById(overlayId + "-style");
    if (style) style.remove();
    document.documentElement.classList.remove("unybase-paused");
  }

  function apply(value) {
    if (!value) return;
    if (value.status === "paused") showPaused(value.message);
    else clearPaused();
    if (value.status === "grace" && value.owner_message) {
      console.info("[UnyBase] " + value.owner_message);
    }
    publish(value);
  }

  function isFresh(value) {
    if (!value || !value.saved_at) return false;
    var ttl = (Number(value.recheck_after) || 60) * 1000;
    return Date.now() - value.saved_at < ttl;
  }

  function check() {
    var cached = readCache();
    if (isFresh(cached) || Date.now() < nextAllowedFetch) return;
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 4000) : null;
    fetch(endpoint, {
      headers: { Authorization: "Bearer " + key },
      cache: "no-store",
      credentials: "omit",
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (r.ok && r.body && r.body.status) {
          r.body.saved_at = Date.now();
          writeCache(r.body);
          apply(r.body);
        } else {
          // Unknown or retired key: keep running, and say so for whoever
          // is debugging the deploy.
          if (r.body && r.body.status === "unknown_key") {
            console.warn("[UnyBase] This licence key is not recognised. The site keeps running.");
          }
          nextAllowedFetch = Date.now() + retryAfterFailureMs;
        }
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        // UnyBase unreachable: keep the last answer, try again later.
        nextAllowedFetch = Date.now() + retryAfterFailureMs;
      });
  }

  // Last known answer first, so a paused site stays paused on reload
  // even before the network replies. An answer older than a day is not
  // trusted on its own: the fresh check below decides.
  var last = readCache();
  if (last && last.saved_at && Date.now() - last.saved_at < 86400000) apply(last);
  check();
  setInterval(check, 60000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") check();
  });
})();
