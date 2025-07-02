
// Scripts for firebase and firebase messaging
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

console.log("Service worker script loaded.");

let app;

// Initialize the Firebase app in the service worker
// by fetching the configuration from the server.
const firebaseAppPromise = fetch('/api/firebase-config')
  .then((response) => response.json())
  .then((firebaseConfig) => {
    if (!firebaseConfig.apiKey) {
        console.error("Firebase config not found in service worker, notifications will not work.");
        return null;
    }
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized in service worker.");
    return app;
  })
  .catch(err => {
      console.error("Failed to initialize Firebase in service worker", err);
      return null;
  });


onBackgroundMessage(getMessaging(), (payload) => {
    console.log("[firebase-messaging-sw.js] Received background message: ", payload);

    if (!payload.data || !payload.data.title) {
        console.log("[firebase-messaging-sw.js] No data to display a notification.");
        return;
    }
  
    const notificationTitle = payload.data.title;
    const notificationOptions = {
      body: payload.data.body,
      icon: payload.data.icon,
      data: {
        url: payload.data.url, // Pass the URL to the notification data
      },
    };
  
    self.registration.showNotification(notificationTitle, notificationOptions);
});


// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);

  event.notification.close();

  const urlToOpen = event.notification.data?.url;
  if (!urlToOpen) {
      console.log("No URL in notification data to open.");
      return;
  }

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then((clientsArr) => {
      // If a window is already open, focus it
      const hadWindowToFocus = clientsArr.some((windowClient) =>
        windowClient.url === urlToOpen ? (windowClient.focus(), true) : false
      );

      // Otherwise, open a new window
      if (!hadWindowToFocus) {
        clients.openWindow(urlToOpen)
          .then((windowClient) => (windowClient ? windowClient.focus() : null));
      }
    })
  );
});
