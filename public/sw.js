/* myXapp — service worker de notifications */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }

  const titre = d.titre || "Agenda";
  const options = {
    body: d.corps || "Nouvelle activité",
    icon: "/icone-192.png",
    badge: "/badge-72.png",
    tag: d.tag || "myxapp",
    renotify: true,
    vibrate: [40, 60, 40],
    data: { url: d.url || "/chat" },
  };

  event.waitUntil(
    (async () => {
      // Si l'app est deja sous les yeux, on ne notifie pas : le message
      // arrive de toute facon en direct dans la conversation.
      const fenetres = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // « focused » n'est pas renseigne de facon fiable sur iOS :
      // la visibilite seule suffit comme critere.
      const active = fenetres.some((c) => c.visibilityState === "visible");
      if (active) return;

      await self.registration.showNotification(titre, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.url) || "/chat";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((liste) => {
        for (const c of liste) {
          if ("focus" in c) {
            c.navigate(cible);
            return c.focus();
          }
        }
        return self.clients.openWindow(cible);
      })
  );
});
