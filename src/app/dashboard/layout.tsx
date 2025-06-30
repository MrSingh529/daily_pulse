
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  LogOut,
  Activity,
  Search,
  Users,
  Bell,
  Coins,
  BarChartBig,
  CalendarCheck,
  Route,
  ClipboardList,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notification } from '@/lib/types';
import { PageTransition } from '@/components/page-transition';


function NotificationsDisplay() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  
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
      // This is often due to a missing Firestore index. 
      // The browser console will have a link to create it.
    });

    return () => unsubscribe();
  }, [user]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!db) return;
    if (!notification.isRead) {
        const notifRef = doc(db, 'notifications', notification.id);
        await updateDoc(notifRef, { isRead: true });
    }
    router.push(`/dashboard/reports?view=${notification.reportId}`);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{unreadCount}</Badge>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
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
    </Popover>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const isActive = (path: string) => pathname.startsWith(path);

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
       <div className="flex items-center justify-center min-h-screen">
         <div className="flex flex-col items-center gap-4">
            <Activity className="w-12 h-12 text-primary animate-pulse" />
            <p className="text-muted-foreground">Loading your dashboard...</p>
         </div>
       </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push('/');
  }
  
  const p = user.permissions || {};

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent className="flex flex-col">
          <SidebarHeader>
            <Link href="/dashboard" className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold">Daily Pulse</h1>
            </Link>
          </SidebarHeader>

          <SidebarMenu className="flex-1">
            <SidebarMenuItem>
              <Link href="/dashboard" passHref>
                <SidebarMenuButton
                  isActive={pathname === '/dashboard'}
                  tooltip="Dashboard"
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            
            {(p.viewReports ?? true) && (
              <SidebarMenuItem>
                <Link href="/dashboard/reports" passHref>
                  <SidebarMenuButton
                    isActive={isActive('/dashboard/reports')}
                    tooltip="Reports"
                  >
                    <FileText />
                    <span>Reports</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}

            {(p.viewAttendance ?? true) && (
               <SidebarMenuItem>
                <Link href="/dashboard/attendance" passHref>
                  <SidebarMenuButton
                    isActive={isActive('/dashboard/attendance')}
                    tooltip="Attendance"
                  >
                    <CalendarCheck />
                    <span>Attendance</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}

            {(p.submitPjp ?? (user.role === 'Admin' || user.role === 'RSM' || user.role === 'ASM')) && (
              <SidebarMenuItem>
                <Link href="/dashboard/submit-pjp" passHref>
                  <SidebarMenuButton
                    isActive={isActive('/dashboard/submit-pjp')}
                    tooltip="Submit PJP"
                  >
                    <Route />
                    <span>Submit PJP</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}

            {(p.submitReport ?? true) && (
              <SidebarMenuItem>
                <Link href="/dashboard/submit-report" passHref>
                  <SidebarMenuButton
                    isActive={isActive('/dashboard/submit-report')}
                    tooltip="Submit Report"
                  >
                    <PlusCircle />
                    <span>Submit Report</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}

             {(p.viewPjp ?? (user.role === 'Admin' || user.reportVisibility === 'Region' || user.reportVisibility === 'All')) && (
                <SidebarMenuItem>
                  <Link href="/dashboard/pjp" passHref>
                    <SidebarMenuButton
                      isActive={isActive('/dashboard/pjp')}
                      tooltip="PJP Plans"
                    >
                      <ClipboardList />
                      <span>PJP Plans</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )}
              
            {(p.viewAnalysis ?? user.role === 'Admin') && (
               <SidebarMenuItem>
                <Link href="/dashboard/analysis" passHref>
                  <SidebarMenuButton
                    isActive={isActive('/dashboard/analysis')}
                    tooltip="Analysis"
                  >
                    <BarChartBig />
                    <span>Analysis</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}

            {(p.doRaEntry ?? user.role === 'Admin') && (
              <SidebarMenuItem>
                <Link href="/dashboard/ra-entry" passHref>
                  <SidebarMenuButton
                    isActive={isActive('/dashboard/ra-entry')}
                    tooltip="RA Entry"
                  >
                    <Coins />
                    <span>RA Entry</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}

            {(p.manageUsers ?? user.role === 'Admin') && (
              <SidebarMenuItem>
                <Link href="/dashboard/admin" passHref>
                  <SidebarMenuButton
                    isActive={isActive('/dashboard/admin')}
                    tooltip="User Management"
                  >
                    <Users />
                    <span>Users</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}
          </SidebarMenu>

          <SidebarFooter>
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                 <AvatarImage src={user.photoURL || undefined} alt={user.name || 'User'} data-ai-hint="person" />
                <AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col truncate">
                <span className="text-sm font-medium truncate">{user.name || 'User'}</span>
                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
              </div>
            </div>
            <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-2">
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-xl sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <SidebarTrigger className="sm:hidden" />
          <div className="relative ml-auto flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full rounded-lg bg-secondary pl-8 md:w-[200px] lg:w-[320px]"
            />
          </div>
          <NotificationsDisplay />
        </header>
        <main className="p-4 sm:px-6 sm:py-0">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
