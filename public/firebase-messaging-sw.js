
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

console.log('[firebase-messaging-sw.js] Service worker starting...');

// This function fetches config from our API endpoint
const fetchFirebaseConfig = async () => {
    console.log('[firebase-messaging-sw.js] Fetching Firebase config...');
    try {
        const response = await fetch('/api/firebase-config');
        if (!response.ok) {
            console.error('[firebase-messaging-sw.js] Failed to fetch config, response not OK.');
            return null;
        }
        const config = await response.json();
        console.log('[firebase-messaging-sw.js] Successfully fetched Firebase config.');
        return config;
    } catch (error) {
        console.error('[firebase-messaging-sw.js] Error fetching Firebase config:', error);
        return null;
    }
};

const appPromise = fetchFirebaseConfig().then(config => {
    if (config) {
        console.log('[firebase-messaging-sw.js] Initializing Firebase app...');
        return initializeApp(config);
    }
    console.error('[firebase-messaging-sw.js] No config returned, Firebase app not initialized.');
    return null;
});


appPromise.then(app => {
    if (app) {
        console.log('[firebase-messaging-sw.js] Firebase app initialized. Setting up background message handler.');
        const messaging = getMessaging(app);
        onBackgroundMessage(messaging, (payload) => {
            console.log('[firebase-messaging-sw.js] Received background message: ', payload);

            if (!payload.data || !payload.data.title) {
                console.error('[firebase-messaging-sw.js] Payload data or title is missing.', payload);
                return;
            }

            const notificationTitle = payload.data.title;
            const notificationOptions = {
                body: payload.data.body,
                icon: payload.data.icon,
                data: {
                    click_action: payload.data.link
                }
            };

            console.log('[firebase-messaging-sw.js] Showing notification with title:', notificationTitle, 'and options:', notificationOptions);
            
            try {
                self.registration.showNotification(notificationTitle, notificationOptions);
                console.log('[firebase-messaging-sw.js] Notification shown successfully.');
            } catch (error) {
                console.error('[firebase-messaging-sw.js] Error showing notification:', error);
            }
        });
    } else {
        console.error('[firebase-messaging-sw.js] Firebase app is null, cannot set up background message handler.');
    }
});


self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
    event.notification.close();
    
    if (!event.notification.data || !event.notification.data.click_action) {
        console.error('[firebase-messaging-sw.js] No click_action found on notification data.');
        return;
    }
    
    const urlToOpen = event.notification.data.click_action;
    console.log('[firebase-messaging-sw.js] Opening window:', urlToOpen);

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    console.log('[firebase-messaging-sw.js] Found existing window, focusing it.');
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                console.log('[firebase-messaging-sw.js] No existing window, opening new one.');
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

console.log('[firebase-messaging-sw.js] Service worker script loaded and event listeners added.');
