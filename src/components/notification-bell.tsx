'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getMessaging, getToken } from 'firebase/messaging';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { db, isFirebaseConfigured, app } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Notification } from '@/lib/types';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';


function NotificationsList({ notifications, handleNotificationClick }: { notifications: Notification[], handleNotificationClick: (n: Notification) => void }) {
    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <PopoverContent className="w-80" align="end">
            <div className="flex items-center justify-between p-2 border-b">
                <h4 className="font-medium text-sm">Notifications</h4>
                {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
            </div>
            <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
                notifications.map(n => (
                <div 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n)}
                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 rounded-md ${!n.isRead ? 'bg-primary/5' : ''}`}
                >
                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className={`flex-1 text-sm ${!n.isRead ? 'ml-0' : 'ml-4'}`}>
                    <p>{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.createdAt.toDate()).toLocaleString()}
                    </p>
                    </div>
                </div>
                ))
            )}
            </div>
        </PopoverContent>
    );
}

export default function NotificationBell() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [permission, setPermission] = React.useState<NotificationPermission>('default');
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
  
    React.useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    React.useEffect(() => {
        if (!user || !db) return;

        const q = query(
        collection(db, 'notifications'), 
        where('userId', '==', user.uid), 
        orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(notifs);
        }, (error) => {
            console.error("Error fetching notifications:", error);
        });

        return () => unsubscribe();
    }, [user]);

    const saveToken = async () => {
        if (!isFirebaseConfigured || !app || !user || !db) return;
        try {
            const messaging = getMessaging(app);
            const currentToken = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                if (!user.fcmTokens || !user.fcmTokens.includes(currentToken)) {
                    const userRef = doc(db, 'users', user.uid);
                    await updateDoc(userRef, { fcmTokens: arrayUnion(currentToken) });
                    console.log('FCM token successfully saved.');
                    toast({ title: "Notifications Enabled!", description: "You'll now receive updates." });
                }
            }
        } catch(error) {
            console.error('An error occurred while retrieving token. ', error);
            toast({ variant: 'destructive', title: "Could not get token", description: "Please ensure your browser settings allow notifications." });
        }
    };
    
    const requestPermission = async () => {
        if (!('Notification' in window)) return;
        
        const permissionStatus = await Notification.requestPermission();
        setPermission(permissionStatus);

        if (permissionStatus === 'granted') {
            await saveToken();
        } else {
            toast({
                variant: 'destructive',
                title: "Permission Denied",
                description: "You have disabled notifications. To enable them, check your browser and system settings."
            });
        }
    };
    
    const handleNotificationClick = async (notification: Notification) => {
        if (!db) return;
        if (notification.type === 'reminder') {
            router.push('/dashboard/submit-report');
            return;
        }
        if (!notification.isRead) {
            const notifRef = doc(db, 'notifications', notification.id);
            await updateDoc(notifRef, { isRead: true });
        }
        if (notification.reportId) {
            router.push(`/dashboard/reports?view=${notification.reportId}`);
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (permission === 'denied') {
        return (
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" className="relative rounded-full h-12 w-12" disabled>
                            <BellOff className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Notifications blocked</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
    
    if (permission === 'default') {
         return (
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" className="relative rounded-full h-12 w-12" onClick={requestPermission}>
                            <Bell className="h-5 w-5 animate-pulse" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Enable Notifications</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
    
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full h-12 w-12">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge className="absolute top-2 right-2 h-5 w-5 justify-center p-0">{unreadCount}</Badge>
                    )}
                    <span className="sr-only">Toggle notifications</span>
                </Button>
            </PopoverTrigger>
            <NotificationsList notifications={notifications} handleNotificationClick={handleNotificationClick} />
        </Popover>
    );
}