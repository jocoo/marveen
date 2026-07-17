// #d675b902 -- same-host access for HomeLab internal links.
//
// services.yaml renders internal links from HOMEPAGE_VAR_TAILSCALE_HOST, so
// every service link points at the WSL Tailscale node (100.127.203.80). From
// Windows' own Tailscale node that host is unreachable (same-host hairpin --
// see the tailscale-same-host-hairpin note), so those links time out even
// though the HomeLab page itself loads fine on http://localhost:3000.
//
// Fix: on load (and as the Next.js app re-renders), rewrite the HOST of any
// internal link to whatever host the user actually opened this page on. Opened
// on localhost -> links become localhost; opened on the Tailscale IP from a
// phone -> links keep that IP. One config serves every access path. Port, path,
// scheme and query are preserved; external links (public domains) are left
// untouched because only Tailscale-range hosts are rewritten.

(function () {
  'use strict';

  // Tailscale CGNAT range 100.64.0.0/10 (100.64.x.x .. 100.127.x.x). Matching
  // the whole range instead of a hardcoded IP keeps this working if the node's
  // Tailscale address ever changes.
  function isTailscaleHost(hostname) {
    var m = /^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
    return !!m && +m[1] >= 64 && +m[1] <= 127;
  }

  function rewrite(a) {
    var href = a.getAttribute('href');
    if (!href || href.indexOf('//') === -1) return; // skip relative / anchor links
    var u;
    try {
      u = new URL(href, window.location.href);
    } catch (e) {
      return;
    }
    if (!isTailscaleHost(u.hostname)) return; // external / already-local link
    if (u.hostname === window.location.hostname) return; // already same host (no-op)
    u.hostname = window.location.hostname;
    a.setAttribute('href', u.toString());
  }

  function sweep(root) {
    var links = (root || document).querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) rewrite(links[i]);
  }

  function init() {
    sweep(document);
    // Homepage is a Next.js SPA: service cards render and re-render client-side,
    // so re-apply on any added anchor or href change. rewrite() is idempotent
    // (a same-host href is skipped), so our own setAttribute never loops.
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes' && m.target.tagName === 'A') {
          rewrite(m.target);
          continue;
        }
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          if (n.tagName === 'A') rewrite(n);
          if (n.querySelectorAll) sweep(n);
        }
      }
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
