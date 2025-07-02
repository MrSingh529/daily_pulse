importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// We need to fetch the config from our own API endpoint
fetch('/api/firebase-config')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(firebaseConfig => {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        const messaging = firebase.messaging();

        // This is the handler for background messages.
        // It's triggered when a push message is received and the app is not in the foreground.
        messaging.onBackgroundMessage((payload) => {
            console.log('[firebase-messaging-sw.js] Received background message ', payload);
            
            // The data payload from the function
            const notificationData = payload.data;
            if (!notificationData) {
                console.log("Message did not have a data payload, skipping custom notification.");
                return;
            }
            
            const notificationTitle = notificationData.title;
            const notificationOptions = {
                body: notificationData.body,
                icon: notificationData.icon,
                data: {
                    link: notificationData.link // Store the link to open on click
                }
            };

            // Display the notification to the user
            return self.registration.showNotification(notificationTitle, notificationOptions);
        });

    }).catch(err => {
        console.error('Failed to initialize Firebase messaging service worker', err);
    });

// This handler is for when the user clicks the notification itself
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);
    
    // Close the notification
    event.notification.close();

    // Get the URL to open from the notification's data
    const link = event.notification.data?.link;

    // Tell the browser to open the link in a new tab/window
    if (clients.openWindow && link) {
        event.waitUntil(clients.openWindow(link));
    }
});
