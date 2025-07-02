'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useIsMobile } from '@/hooks/use-mobile';

// UI Components
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
import { BottomDock } from '@/components/bottom-dock';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Icons
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  LogOut,
  Activity,
  Coins,
  BarChartBig,
  CalendarCheck,
  Route,
  ClipboardList,
  Info,
  Users,
} from 'lucide-react';

// Firebase
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageTransition } from '@/components/page-transition';
import { ThemeToggle } from '@/components/theme-toggle';
import { startOfDay } from 'date-fns';
import FcmHandler from '@/components/fcm-handler';
import NotificationBell from '@/components/notification-bell';


function MobileLayout({ children, user, handleLogout, p, pathname, isActive }: any) {
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
                <SidebarMenuButton isActive={pathname === '/dashboard'} tooltip="Dashboard">
                  <LayoutDashboard /><span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            {(p.viewReports ?? true) && (
              <SidebarMenuItem><Link href="/dashboard/reports" passHref><SidebarMenuButton isActive={isActive('/dashboard/reports')} tooltip="Reports"><FileText /><span>Reports</span></SidebarMenuButton></Link></SidebarMenuItem>
            )}
            {(p.viewAttendance ?? true) && (
               <SidebarMenuItem><Link href="/dashboard/attendance" passHref><SidebarMenuButton isActive={isActive('/dashboard/attendance')} tooltip="Attendance"><CalendarCheck /><span>Attendance</span></SidebarMenuButton></Link></SidebarMenuItem>
            )}
            {(p.submitPjp ?? (user.role === 'Admin' || user.role === 'RSM' || user.role === 'ASM')) && (
              <SidebarMenuItem><Link href="/dashboard/submit-pjp" passHref><SidebarMenuButton isActive={isActive('/dashboard/submit-pjp')} tooltip="Submit PJP"><Route /><span>Submit PJP</span></SidebarMenuButton></Link></SidebarMenuItem>
            )}
            {(p.submitReport ?? true) && (
              <SidebarMenuItem><Link href="/dashboard/submit-report" passHref><SidebarMenuButton isActive={isActive('/dashboard/submit-report')} tooltip="Submit Report"><PlusCircle /><span>Submit Report</span></SidebarMenuButton></Link></SidebarMenuItem>
            )}
             {(p.viewPjp ?? (user.role === 'Admin' || user.reportVisibility === 'Region' || user.reportVisibility === 'All')) && (
                <SidebarMenuItem><Link href="/dashboard/pjp" passHref><SidebarMenuButton isActive={isActive('/dashboard/pjp')} tooltip="PJP Plans"><ClipboardList /><span>PJP Plans</span></SidebarMenuButton></Link></SidebarMenuItem>
              )}
            {(p.viewAnalysis ?? user.role === 'Admin') && (
               <SidebarMenuItem><Link href="/dashboard/analysis" passHref><SidebarMenuButton isActive={isActive('/dashboard/analysis')} tooltip="Analysis"><BarChartBig /><span>Analysis</span></SidebarMenuButton></Link></SidebarMenuItem>
            )}
            {(p.doRaEntry ?? user.role === 'Admin') && (
              <SidebarMenuItem><Link href="/dashboard/ra-entry" passHref><SidebarMenuButton isActive={isActive('/dashboard/ra-entry')} tooltip="RA Entry"><Coins /><span>RA Entry</span></SidebarMenuButton></Link></SidebarMenuItem>
            )}
            {(p.manageUsers ?? user.role === 'Admin') && (
              <SidebarMenuItem><Link href="/dashboard/admin" passHref><SidebarMenuButton isActive={isActive('/dashboard/admin')} tooltip="User Management"><Users /><span>Users</span></SidebarMenuButton></Link></SidebarMenuItem>
            )}
            <SidebarMenuItem><Link href="/dashboard/about" passHref><SidebarMenuButton isActive={isActive('/dashboard/about')} tooltip="About App"><Info /><span>About</span></SidebarMenuButton></Link></SidebarMenuItem>
          </SidebarMenu>

          <SidebarFooter>
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9"><AvatarImage src={user.photoURL || undefined} alt={user.name || 'User'} data-ai-hint="person" /><AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback></Avatar>
              <div className="flex flex-col truncate"><span className="text-sm font-medium truncate">{user.name || 'User'}</span><span className="text-xs text-muted-foreground truncate">{user.email}</span></div>
            </div>
            <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-2"><LogOut className="w-4 h-4" /><span>Logout</span></Button>
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-xl sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <SidebarTrigger />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main className="p-4 sm:px-6 sm:py-0 pb-32"><PageTransition>{children}</PageTransition></main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full">
      <main className="p-4 sm:px-6 sm:py-0 pb-32">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
      <BottomDock notificationsComponent={<NotificationBell />} />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const isMobile = useIsMobile();
  const isActive = (path: string) => pathname.startsWith(path);
  
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);
  
  React.useEffect(() => {
    const checkAndCreateReminder = async () => {
      if (!db || !user || (user.role !== 'ASM' && user.role !== 'RSM')) {
        return;
      }

      const now = new Date();
      const istHour = new Date(now.toLocaleString('en-US', {timeZone: 'Asia/Kolkata'})).getHours();
      
      if (istHour < 19) { // 7 PM IST
          return;
      }

      const todayStart = startOfDay(new Date());
      const todayStartTimestamp = Timestamp.fromDate(todayStart);

      const reportsRef = collection(db, 'reports');
      const reportsQuery = query(
        reportsRef, 
        where('submittedBy', '==', user.uid), 
        where('date', '>=', todayStartTimestamp)
      );
      const reportSnapshot = await getDocs(reportsQuery);
      if (!reportSnapshot.empty) {
        return;
      }

      const notificationsRef = collection(db, 'notifications');
      const reminderQuery = query(
        notificationsRef, 
        where('userId', '==', user.uid), 
        where('type', '==', 'reminder'),
        where('createdAt', '>=', todayStartTimestamp)
      );
      const reminderSnapshot = await getDocs(reminderQuery);
      if (!reminderSnapshot.empty) {
        return;
      }

      await addDoc(notificationsRef, {
        userId: user.uid,
        message: "The day's wrapping up! Time to share your progress. Please submit your daily report.",
        createdAt: Timestamp.now(),
        isRead: false,
        type: 'reminder',
      });
    };

    if (user) {
      checkAndCreateReminder();
    }
  }, [user]);

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

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
           <Activity className="w-12 h-12 text-primary animate-pulse" />
        </div>
      </div>
    );
  }

  if (isMobile) {
    return <MobileLayout user={user} handleLogout={handleLogout} p={p} pathname={pathname} isActive={isActive}>{children}</MobileLayout>;
  }

  return (
    <>
      <FcmHandler />
      <DesktopLayout>{children}</DesktopLayout>
    </>
  );
}
