'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  LogOut,
  BarChartBig,
  CalendarCheck,
  Route,
  ClipboardList,
  Info,
  Coins,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from './theme-toggle';

interface BottomDockProps {
  notificationsComponent: React.ReactNode;
}

export function BottomDock({ notificationsComponent }: BottomDockProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const p = user?.permissions || {};

  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', shouldRender: true },
    { href: '/dashboard/reports', icon: FileText, label: 'Reports', shouldRender: p.viewReports ?? true },
    { href: '/dashboard/attendance', icon: CalendarCheck, label: 'Attendance', shouldRender: p.viewAttendance ?? true },
    { href: '/dashboard/submit-pjp', icon: Route, label: 'Submit PJP', shouldRender: (p.submitPjp ?? (user?.role === 'Admin' || user?.role === 'RSM' || user?.role === 'ASM')) },
    { href: '/dashboard/submit-report', icon: PlusCircle, label: 'Submit Report', shouldRender: p.submitReport ?? true },
    { href: '/dashboard/pjp', icon: ClipboardList, label: 'PJP Plans', shouldRender: (p.viewPjp ?? (user?.role === 'Admin' || user?.reportVisibility === 'Region' || user?.reportVisibility === 'All')) },
    { href: '/dashboard/analysis', icon: BarChartBig, label: 'Analysis', shouldRender: p.viewAnalysis ?? user?.role === 'Admin' },
    { href: '/dashboard/ra-entry', icon: Coins, label: 'RA Entry', shouldRender: p.doRaEntry ?? user?.role === 'Admin' },
    { href: '/dashboard/admin', icon: Users, label: 'Users', shouldRender: p.manageUsers ?? user?.role === 'Admin' },
    { href: '/dashboard/about', icon: Info, label: 'About', shouldRender: true },
  ].filter(item => item.shouldRender);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const vibrate = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(5);
    }
  };

  if (!user) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ 
            type: 'spring', 
            stiffness: 400,
            damping: 25,
            mass: 0.5
          }}
          className="fixed inset-x-0 bottom-4 z-50 flex justify-center pointer-events-none px-4"
        >
          <div className="flex items-center h-16 rounded-full bg-background/80 dark:bg-background/90 backdrop-blur-md border border-muted/50 shadow-lg shadow-black/5 dark:shadow-black/30 px-6 pointer-events-auto">
            <nav className="flex items-center gap-1 flex-1 justify-center">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link href={item.href} passHref>
                        <motion.div
                          whileHover={{ 
                            scale: 1.15,
                            transition: { type: "spring", stiffness: 400, damping: 10 }
                          }}
                          whileTap={{ scale: 0.95 }}
                          className="relative"
                        >
                          {/* Glow Effect Container */}
                          {isActive && (
                            <motion.span
                              className="absolute inset-0 rounded-full bg-primary/10"
                              initial={{ opacity: 0 }}
                              animate={{ 
                                opacity: 1,
                                scale: 1.3
                              }}
                              transition={{
                                repeat: Infinity,
                                repeatType: "reverse",
                                duration: 1.5
                              }}
                            />
                          )}

                          {/* Icon Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`relative rounded-full h-12 w-12 transition-all duration-300 ${
                              isActive 
                                ? 'bg-primary text-primary-foreground shadow-lg' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <item.icon 
                              className="h-5 w-5" 
                              {...(isActive && {
                                animate: { y: [0, -3, 0] },
                                transition: { repeat: Infinity, duration: 1.5 }
                              })}
                            />
                            
                            {/* Subtle Pulse Ring */}
                            {isActive && (
                              <motion.span
                                className="absolute inset-0 rounded-full border-2 border-primary"
                                animate={{
                                  scale: [1, 1.2, 1],
                                  opacity: [0.7, 0]
                                }}
                                transition={{
                                  repeat: Infinity,
                                  duration: 2
                                }}
                              />
                            )}
                          </Button>
                        </motion.div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="top" 
                      align="center"
                      className="bg-foreground text-background px-3 py-1 text-xs font-medium"
                    >
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>

            <Separator orientation="vertical" className="h-8 mx-2" />

            {/* Right-aligned controls with proper spacing */}
            <div className="flex items-center gap-2 pl-2">
              <ThemeToggle />
              {notificationsComponent}
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <button 
                      className="rounded-full transition-transform hover:scale-105"
                      onClick={vibrate}
                    >
                      <Avatar className="h-10 w-10 border-2 hover:border-primary transition-all relative">
                        <AvatarImage src={user.photoURL || undefined} alt={user.name || 'User'} />
                        <AvatarFallback className="bg-accent">
                          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </AvatarFallback>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></span>
                      </Avatar>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 mb-2" align="end" side="top">
                    <div className="flex flex-col gap-3 p-2">
                      <div className="text-center">
                        <p className="text-sm font-semibold truncate">{user.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Separator />
                      <Button 
                        onClick={handleLogout} 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-center gap-2 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </TooltipProvider>
  );
}