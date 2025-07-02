
// These scripts are a fallback for browsers that don't support ES6 modules in Service Workers.
// They expose a global `firebase` object.
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// This self.firebaseConfig promise is used to delay initialization until the config is fetched.
self.firebaseConfig = fetch('/api/firebase-config')
  .then((response) => response.json())
  .catch((err) => {
    console.error('SW: Failed to fetch Firebase config.', err);
  });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.firebaseConfig.then((config) => {
      if (config && config.apiKey) {
        firebase.initializeApp(config);
        const messaging = firebase.messaging();
        console.log('Firebase Messaging Service Worker initialized.');

        // This is the handler for background notifications.
        messaging.onBackgroundMessage((payload) => {
          console.log('[firebase-messaging-sw.js] Received background message ', payload);
          
          const notificationTitle = payload.notification.title;
          const notificationOptions = {
            body: payload.notification.body,
            icon: '/icons/icon-192x192.png',
          };

          self.registration.showNotification(notificationTitle, notificationOptions);
        });
      }
    })
  );
});

// The fetch listener is required for the service worker to be considered for PWA installability.
self.addEventListener('fetch', (event) => {
  // We are not caching anything here, just fulfilling the requirement.
});
