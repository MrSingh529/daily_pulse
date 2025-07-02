'use client';

import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { db, isFirebaseConfigured, app } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

function FcmHandler() {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !isFirebaseConfigured || typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
        return;
    }
    
    const messaging = getMessaging(app!);

    // Handle messages that are received while the app is in the foreground
    onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        toast({
            title: payload.notification?.title,
            description: payload.notification?.body,
        });
    });

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          await saveToken(messaging);
        } else {
          console.log('Unable to get permission to notify.');
        }
      } catch (error) {
        console.error('An error occurred while requesting notification permission.', error);
      }
    };

    const saveToken = async (messaging: any) => {
        try {
            const currentToken = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                // Check if token already exists for the user
                if (!user.fcmTokens || !user.fcmTokens.includes(currentToken)) {
                    const userRef = doc(db!, 'users', user.uid);
                    await updateDoc(userRef, {
                        fcmTokens: arrayUnion(currentToken),
                    });
                    console.log('FCM token successfully saved.');
                }
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } catch(error) {
            console.error('An error occurred while retrieving token. ', error);
        }
    }

    // Check permission status on load
    if (Notification.permission === 'granted') {
        saveToken(messaging);
    } else if (Notification.permission === 'default') {
        // In a real app, this should be tied to a user action for better UX.
        requestPermission();
    }

  }, [user, toast]);

  return null; // This component doesn't render anything
}

export default FcmHandler;