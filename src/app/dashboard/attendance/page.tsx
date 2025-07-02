
'use client';

import * as React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Report, UserProfile } from '@/lib/types';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isPast, isToday, isWeekend, getDay } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp } from 'lucide-react';

function AttendanceSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <Card className="shadow-sm">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-96" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-10 w-full md:w-1/3" />
                </CardContent>
            </Card>
            <Card className="shadow-sm">
                <CardHeader>
                     <Skeleton className="h-6 w-32 mb-2" />
                </CardHeader>
                <CardContent className="flex justify-center">
                    <Skeleton className="h-96 w-full max-w-md" />
                </CardContent>
            </Card>
        </div>
    )
}

export default function AttendancePage() {
    const { user, loading: authLoading } = useAuth();
    
    const [allReports, setAllReports] = React.useState<Report[]>([]);
    const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]);
    const [dataLoading, setDataLoading] = React.useState(true);

    const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());

    React.useEffect(() => {
        if (user) {
            setSelectedUserId(user.uid);
        }
    }, [user]);

    React.useEffect(() => {
        if (!user) return;

        let reportsLoaded = false, usersLoaded = false;
        const checkLoading = () => {
            if (reportsLoaded && usersLoaded) {
                setDataLoading(false);
            }
        };

        const qReports = query(collection(db, 'reports'));
        const unsubReports = onSnapshot(qReports, snap => {
            setAllReports(snap.docs.map(d => ({ ...d.data(), date: (d.data().date as Timestamp).toDate() } as Report)));
            reportsLoaded = true; checkLoading();
        });

        // Fetch users based on visibility
        let usersQuery;
        const rolesToView = ['ASM', 'RSM'];

        if (user.role === 'Admin' || user.reportVisibility === 'All') {
             usersQuery = query(collection(db, 'users'), where('role', 'in', rolesToView));
        } else if (user.reportVisibility === 'Region' && user.regions && user.regions.length > 0) {
            usersQuery = query(collection(db, 'users'), where('regions', 'array-contains-any', user.regions), where('role', 'in', rolesToView));
        } else {
            // Only show self if they are ASM/RSM, otherwise empty list for this page.
             if (rolesToView.includes(user.role as string)) {
                setAllUsers([user]);
            } else {
                setAllUsers([]);
            }
            usersLoaded = true; checkLoading();
            return () => { unsubReports() };
        }
        
        const unsubUsers = onSnapshot(usersQuery, snap => {
            const usersData = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
            setAllUsers(usersData);
            usersLoaded = true; checkLoading();
        }, (error) => {
            console.error("Error fetching users for attendance:", error);
            setAllUsers([]);
            usersLoaded = true; checkLoading();
        });
        
        return () => { unsubReports(); unsubUsers && unsubUsers(); };
    }, [user]);

    const viewableUsers = React.useMemo(() => {
        if (!user) return [];
        // Add self to the list if not already present, to allow viewing own attendance
        const userList = [...allUsers];
        const rolesForAttendance = ['Admin', 'RSM', 'ASM'];
        if (rolesForAttendance.includes(user.role) && !userList.find(u => u.uid === user.uid)) {
            userList.unshift(user);
        }

        if (user.role === 'Admin' || user.reportVisibility === 'All') {
            return userList;
        }
        if (user.reportVisibility === 'Region') {
            return userList.filter(u => u.uid === user.uid || (u.regions && u.regions.length > 0 && u.regions.some(r => user.regions?.includes(r))));
        }
        return [user];
    }, [user, allUsers]);

    const attendanceData = React.useMemo(() => {
        if (!selectedUserId) return { present: [], absent: [], stats: { presentDays: 0, absentDays: 0, totalWorkingDays: 0, attendanceRate: 0 } };

        const userReports = allReports.filter(r => r.submittedBy === selectedUserId);
        const reportDates = userReports.map(r => r.date);

        const present: Date[] = [];
        const absent: Date[] = [];
        const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
        
        daysInMonth.forEach(day => {
            if (!isPast(day) && !isToday(day)) return;
            if (isWeekend(day)) return;

            const hasSubmitted = reportDates.some(reportDate => isSameDay(day, reportDate));
            if (hasSubmitted) {
                present.push(day);
            } else {
                absent.push(day);
            }
        });

        const totalWorkingDays = present.length + absent.length;
        const attendanceRate = totalWorkingDays > 0 ? Math.round((present.length / totalWorkingDays) * 100) : 0;
        
        return { 
            present, 
            absent, 
            stats: {
                presentDays: present.length,
                absentDays: absent.length,
                totalWorkingDays,
                attendanceRate
            }
        };

    }, [selectedUserId, allReports, currentMonth]);
    
    const selectedUser = viewableUsers.find(u => u.uid === selectedUserId);

    const goToPreviousMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };
    const goToNextMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    if (authLoading || dataLoading) return <AttendanceSkeleton />;

    return (
        <div className="space-y-6">
            <Card className="shadow-sm border-0 bg-primary/5 dark:bg-primary/10">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <CalendarDays className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl text-foreground">Attendance Tracker</CardTitle>
                            <CardDescription className="text-muted-foreground mt-1">
                                Monitor daily report submissions and attendance patterns
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    {viewableUsers.length > 1 && (
                         <Select value={selectedUserId || ''} onValueChange={setSelectedUserId}>
                            <SelectTrigger className="w-full md:w-1/3 shadow-sm">
                                <SelectValue placeholder="Select User" />
                            </SelectTrigger>
                            <SelectContent>
                                {viewableUsers.map(u => (
                                    <SelectItem key={u.uid} value={u.uid}>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{u.name}</span>
                                            <span className="text-xs text-muted-foreground">({u.role})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </CardContent>
            </Card>

            {selectedUser && (
                <>
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16 border-4 border-background shadow-md">
                                        <AvatarImage src={selectedUser.photoURL} alt={selectedUser.name} data-ai-hint="person" />
                                        <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xl font-semibold">
                                            {selectedUser.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="text-xl font-bold text-foreground">{selectedUser.name}</h3>
                                        <p className="font-medium text-muted-foreground">{selectedUser.role}</p>
                                        <p className="text-sm text-muted-foreground">{selectedUser.regions?.join(', ')}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-center gap-6">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-500">{attendanceData.stats.presentDays}</div>
                                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Present</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-red-500">{attendanceData.stats.absentDays}</div>
                                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Absent</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center gap-1 text-primary">
                                            <TrendingUp className="h-4 w-4" />
                                            <span className="text-2xl font-bold">{attendanceData.stats.attendanceRate}%</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Rate</div>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-lg font-semibold text-foreground">Monthly Overview</h4>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="icon"
                                        onClick={goToPreviousMonth}
                                        className="h-8 w-8"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="min-w-[140px] text-center">
                                        <span className="text-lg font-semibold text-foreground">
                                            {format(currentMonth, 'MMMM yyyy')}
                                        </span>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="icon"
                                        onClick={goToNextMonth} 
                                        disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
                                        className="h-8 w-8"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-6">
                            <div className="w-full max-w-md">
                                <Calendar
                                    month={currentMonth}
                                    onMonthChange={setCurrentMonth}
                                    className="rounded-xl border"
                                    modifiers={{
                                        present: attendanceData.present,
                                        absent: attendanceData.absent,
                                        weekend: day => getDay(day) === 0 || getDay(day) === 6,
                                        today: new Date(),
                                    }}
                                    modifiersClassNames={{
                                        present: "bg-green-500 text-primary-foreground hover:bg-green-600 font-semibold",
                                        absent: "bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold",
                                        weekend: "text-muted-foreground opacity-50",
                                        today: "bg-accent text-accent-foreground ring-2 ring-ring ring-offset-1",
                                    }}
                                    showOutsideDays={false}
                                    disabled
                                />
                            </div>
                            
                            <div className="flex items-center justify-center gap-6 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 rounded bg-green-500 shadow-sm"></div>
                                    <span className="text-sm font-medium text-muted-foreground">Present</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 rounded bg-destructive shadow-sm"></div>
                                    <span className="text-sm font-medium text-muted-foreground">Absent</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 rounded bg-muted border"></div>
                                    <span className="text-sm font-medium text-muted-foreground">Weekend</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 rounded border-2 border-accent bg-background"></div>
                                    <span className="text-sm font-medium text-muted-foreground">Today</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
