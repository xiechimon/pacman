(() => {
  window.__r5 = { notif: [], swNotif: [], sse: [], vis: [], err: [] };
  const log = window.__r5;
  try {
    const Orig = window.Notification;
    if (Orig) {
      function P(title, opts) {
        try { log.notif.push({ ts: Date.now(), title: String(title), opts: JSON.parse(JSON.stringify(opts || {})), hidden: document.hidden, via: "new Notification" }); } catch (e) {}
        return new Orig(title, opts);
      }
      P.prototype = Orig.prototype;
      Object.defineProperty(P, "permission", { get: () => Orig.permission, configurable: true });
      P.requestPermission = function() { return Orig.requestPermission.apply(Orig, arguments); };
      window.Notification = P;
    }
  } catch (e) { log.err.push("notif:" + e.message); }
  try {
    navigator.serviceWorker.ready.then((reg) => {
      const proto = Object.getPrototypeOf(reg);
      const orig = proto.showNotification;
      if (orig && !orig.__r5patched) {
        const patched = function(title, opts) {
          try { log.swNotif.push({ ts: Date.now(), title: String(title), opts: JSON.parse(JSON.stringify(opts || {})), hidden: document.hidden, via: "registration.showNotification" }); } catch (e) {}
          return orig.call(this, title, opts);
        };
        patched.__r5patched = true;
        proto.showNotification = patched;
      }
    }).catch((e) => log.err.push("swready:" + e.message));
  } catch (e) { log.err.push("sw:" + e.message); }
  try {
    const oOpen = XMLHttpRequest.prototype.open, oSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(m, u) { this.__r5u = String(u); return oOpen.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function() {
      if (this.__r5u && /\/api\/teams\/[^/]+\/stream/.test(this.__r5u)) {
        let last = 0;
        this.addEventListener("progress", () => {
          try { const t = String(this.responseText || ""); if (t.length > last) { log.sse.push({ ts: Date.now(), chunk: t.slice(last), via: "xhr" }); last = t.length; } } catch (e) {}
        });
      }
      return oSend.apply(this, arguments);
    };
  } catch (e) { log.err.push("xhr:" + e.message); }
  document.addEventListener("visibilitychange", () => log.vis.push({ ts: Date.now(), hidden: document.hidden }));
})();
