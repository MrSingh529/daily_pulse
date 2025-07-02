
// Import the Firebase app and messaging packages
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// This holds the promise for the initialized Firebase app.
let firebaseAppPromise = null;

function getFirebaseApp() {
    if (firebaseAppPromise) {
        return firebaseAppPromise;
    }

    // Fetch the config from our secure API endpoint
    firebaseAppPromise = fetch('/api/firebase-config')
        .then(response => {
            if (!response.ok) {
                throw new Error('SW: Failed to fetch Firebase config');
            }
            return response.json();
        })
        .then(config => {
            if (config.apiKey && firebase.apps.length === 0) {
                console.log("SW: Initializing Firebase with config:", config);
                return firebase.initializeApp(config);
            } else if (firebase.apps.length > 0) {
                console.log("SW: Using existing Firebase app.");
                return firebase.app();
            } else {
                throw new Error('SW: Fetched config is invalid.');
            }
        })
        .catch(error => {
            console.error("SW: Firebase initialization error:", error);
            firebaseAppPromise = null; // Reset promise on error to allow retry
            return null;
        });

    return firebaseAppPromise;
}

// Ensure the SW takes control immediately without waiting.
self.addEventListener('install', event => {
    console.log('SW: install event, skipping waiting.');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    console.log('SW: activate event, claiming clients.');
    event.waitUntil(self.clients.claim());
});

// This is the main event for receiving push messages.
self.addEventListener('push', event => {
    console.log('SW: push event received.', event);
    
    let notificationData = {};
    try {
        // Our function sends the payload in `data`
        notificationData = event.data.json().data;
    } catch (e) {
        console.error("SW: Could not parse push data", e);
        // Create a fallback notification if parsing fails
        notificationData = {
            title: "New Notification",
            body: "You have a new message.",
            icon: "/icons/icon-192x192.png",
            url: "/"
        };
    }

    console.log("SW: Showing notification with data:", notificationData);

    const title = notificationData.title;
    const options = {
        body: notificationData.body,
        icon: notificationData.icon,
        // Store the URL to open when the notification is clicked
        data: {
            url: notificationData.url,
        },
    };

    // Show the notification
    event.waitUntil(self.registration.showNotification(title, options));
});

// This event handles the user clicking on the notification.
self.addEventListener('notificationclick', event => {
    console.log('SW: notificationclick event.', event.notification);
    event.notification.close();

    const urlToOpen = event.notification.data.url;

    // This looks for an open app window and focuses it, or opens a new one.
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Initialize the app as soon as the service worker starts
getFirebaseApp();
