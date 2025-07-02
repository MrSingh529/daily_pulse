'use client';

import { useEffect } from 'react';
import { getMessaging, onMessage } from 'firebase/messaging';
import { useToast } from '@/hooks/use-toast';
import { isFirebaseConfigured, app } from '@/lib/firebase';

function FcmHandler() {
  const { toast } = useToast();

  useEffect(() => {
    if (!isFirebaseConfigured || !app || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }
    
    // This check is important. We only set up foreground listeners if permission is already granted.
    if ('Notification' in window && Notification.permission === 'granted') {
      const messaging = getMessaging(app);

      // Handle messages that are received while the app is in the foreground
      const unsubscribe = onMessage(messaging, (payload) => {
          console.log('Foreground message received:', payload);
          toast({
              title: payload.notification?.title,
              description: payload.notification?.body,
          });
      });

      return () => unsubscribe();
    }
    
  }, [toast]);

  return null; // This component doesn't render anything
}

export default FcmHandler;
