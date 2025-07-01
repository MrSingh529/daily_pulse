
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
        if (user.role === 'Admin' || user.reportVisibility === 'All') {
             usersQuery = query(collection(db, 'users'), where('role', 'in', ['ASM', 'RSM']));
        } else if (user.reportVisibility === 'Region' && user.regions && user.regions.length > 0) {
            // Can see users who are in any of the manager's regions.
             usersQuery = query(collection(db, 'users'), where('regions', 'array-contains-any', user.regions), where('role', 'in', ['ASM', 'RSM']));
        } else {
            // For 'Own' visibility, or if region manager has no regions assigned.
            setAllUsers([user]);
            usersLoaded = true; checkLoading();
            return () => { unsubReports() };
        }
        
        const unsubUsers = onSnapshot(usersQuery, snap => {
            const usersData = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
            // Additional client-side filtering if 'array-contains-any' is not precise enough (e.g. user in N, manager in [N,S])
            // This is actually not needed as firestore `array-contains-any` does what we need.
            setAllUsers(usersData);
            usersLoaded = true; checkLoading();
        }, (error) => {
            console.error("Error fetching users for attendance:", error);
            // This can happen if firestore indexes are not created. 
            // The console will provide a link to create them.
            setAllUsers([]);
            usersLoaded = true; checkLoading();
        });
        
        return () => { unsubReports(); unsubUsers && unsubUsers(); };
    }, [user]);

    const viewableUsers = React.useMemo(() => {
        if (!user) return [];
        if (user.role === 'Admin' || user.reportVisibility === 'All') {
            return allUsers;
        }
        if (user.reportVisibility === 'Region') {
            // We already filtered by Firestore query, but a double check doesn't hurt.
            return allUsers.filter(u => u.regions && u.regions.length > 0 && u.regions.some(r => user.regions?.includes(r)));
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
            // Don't mark future days as absent
            if (!isPast(day) && !isToday(day)) return;
            // Ignore weekends for absence calculation
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
    
    const selectedUser = allUsers.find(u => u.uid === selectedUserId);

    const goToPreviousMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };
    const goToNextMonth = () => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    if (authLoading || dataLoading) return <AttendanceSkeleton />;

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <Card className="shadow-sm border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <CalendarDays className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl text-gray-900">Attendance Tracker</CardTitle>
                            <CardDescription className="text-gray-600 mt-1">
                                Monitor daily report submissions and attendance patterns
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    {viewableUsers.length > 1 && (
                         <Select value={selectedUserId || ''} onValueChange={setSelectedUserId}>
                            <SelectTrigger className="w-full md:w-1/3 bg-white border-gray-200 shadow-sm">
                                <SelectValue placeholder="Select User" />
                            </SelectTrigger>
                            <SelectContent>
                                {viewableUsers.map(u => (
                                    <SelectItem key={u.uid} value={u.uid}>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{u.name}</span>
                                            <span className="text-xs text-gray-500">({u.role})</span>
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
                    {/* User Info & Stats Card */}
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                                {/* User Info */}
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16 border-4 border-white shadow-md">
                                        <AvatarImage src={selectedUser.photoURL} alt={selectedUser.name} data-ai-hint="person" />
                                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-semibold">
                                            {selectedUser.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{selectedUser.name}</h3>
                                        <p className="text-gray-600 font-medium">{selectedUser.role}</p>
                                        <p className="text-sm text-gray-500">{selectedUser.regions?.join(', ')}</p>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-600">{attendanceData.stats.presentDays}</div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide">Present</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-red-500">{attendanceData.stats.absentDays}</div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide">Absent</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center gap-1">
                                            <TrendingUp className="h-4 w-4 text-blue-500" />
                                            <span className="text-2xl font-bold text-blue-600">{attendanceData.stats.attendanceRate}%</span>
                                        </div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide">Rate</div>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* Calendar Card */}
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-lg font-semibold text-gray-900">Monthly Overview</h4>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={goToPreviousMonth}
                                        className="h-8 w-8 p-0"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="min-w-[140px] text-center">
                                        <span className="text-lg font-semibold text-gray-900">
                                            {format(currentMonth, 'MMMM yyyy')}
                                        </span>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={goToNextMonth} 
                                        disabled={currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()}
                                        className="h-8 w-8 p-0"
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
                                    className="rounded-xl border border-gray-200 bg-white shadow-sm"
                                    modifiers={{
                                        present: attendanceData.present,
                                        absent: attendanceData.absent,
                                        weekend: day => getDay(day) === 0 || getDay(day) === 6,
                                        today: [new Date()],
                                    }}
                                    modifiersClassNames={{
                                        present: "bg-green-500 text-white hover:bg-green-600 font-semibold shadow-sm border-green-600",
                                        absent: "bg-red-500 text-white hover:bg-red-600 font-semibold shadow-sm border-red-600",
                                        weekend: "bg-gray-100 text-gray-400 font-normal",
                                        today: "ring-2 ring-blue-500 ring-offset-1 font-bold",
                                    }}
                                    classNames={{
                                        months: "flex w-full",
                                        month: "space-y-4 w-full",
                                        caption: "flex justify-center pt-1 relative items-center px-4",
                                        caption_label: "text-lg font-semibold text-gray-900",
                                        nav: "space-x-1 flex items-center",
                                        nav_button: "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100",
                                        nav_button_previous: "absolute left-2",
                                        nav_button_next: "absolute right-2",
                                        table: "w-full border-collapse space-y-1",
                                        head_row: "flex w-full",
                                        head_cell: "text-gray-500 rounded-md w-12 font-medium text-sm uppercase tracking-wide text-center py-2",
                                        row: "flex w-full mt-2",
                                        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
                                        day: "h-12 w-12 p-0 font-normal aria-selected:opacity-100 rounded-lg border-2 border-transparent transition-all duration-200 hover:bg-gray-100 flex items-center justify-center",
                                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                                        day_today: "bg-accent text-accent-foreground",
                                        day_outside: "text-gray-300 opacity-50",
                                        day_disabled: "text-gray-300 opacity-50",
                                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                                        day_hidden: "invisible",
                                    }}
                                    showOutsideDays={false}
                                    disabled
                                />
                            </div>
                            
                            {/* Legend */}
                            <div className="flex items-center justify-center gap-6 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 rounded bg-green-500 shadow-sm"></div>
                                    <span className="text-sm font-medium text-gray-700">Present</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 rounded bg-red-500 shadow-sm"></div>
                                    <span className="text-sm font-medium text-gray-700">Absent</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 rounded bg-gray-100 border border-gray-200"></div>
                                    <span className="text-sm font-medium text-gray-700">Weekend</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 rounded border-2 border-blue-500 bg-white"></div>
                                    <span className="text-sm font-medium text-gray-700">Today</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
