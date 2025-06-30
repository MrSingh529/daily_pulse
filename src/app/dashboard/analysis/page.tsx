
'use client';

import * as React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { collection, query, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Report, UserProfile, RAEntry, Region } from '@/lib/types';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { Clock, TrendingUp, CheckCircle, Package, Warehouse, Plane, Building } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const regions: Region[] = ['North', 'South', 'East', 'West']; // Exclude HQ

function AnalysisSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-96" />
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                <Card className="lg:col-span-2"><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
                <Card className="lg:col-span-2"><CardHeader><Skeleton className="h-6 w-32 mb-2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
            </div>
        </div>
    )
}

export default function AnalysisPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [allReports, setAllReports] = React.useState<Report[]>([]);
  const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]);
  const [allRaEntries, setAllRaEntries] = React.useState<RAEntry[]>([]);
  const [dataLoading, setDataLoading] = React.useState(true);
  
  const [filterType, setFilterType] = React.useState<'region' | 'user'>('region');
  const [selectedRegion, setSelectedRegion] = React.useState<Region | 'All'>('All');
  const [selectedUser, setSelectedUser] = React.useState<string | 'All'>('All');

  React.useEffect(() => {
    if (!authLoading && user?.role !== 'Admin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  React.useEffect(() => {
    if (user?.role === 'Admin') {
      const qReports = query(collection(db, 'reports'));
      const qUsers = query(collection(db, 'users'), where('role', 'in', ['ASM', 'RSM']));
      const qRaEntries = query(collection(db, 'ra_entries'));
      
      let reportsLoaded = false, usersLoaded = false, raEntriesLoaded = false;
      const checkLoading = () => {
        if (reportsLoaded && usersLoaded && raEntriesLoaded) {
            setDataLoading(false);
        }
      }
      
      const unsubReports = onSnapshot(qReports, snap => {
          setAllReports(snap.docs.map(d => ({ id: d.id, ...d.data(), date: (d.data().date as Timestamp).toDate() } as Report)));
          reportsLoaded = true; checkLoading();
        });
      const unsubUsers = onSnapshot(qUsers, snap => {
          setAllUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
          usersLoaded = true; checkLoading();
        });
      const unsubRaEntries = onSnapshot(qRaEntries, snap => {
          setAllRaEntries(snap.docs.map(d => ({ id: d.id, ...d.data(), date: (d.data().date as Timestamp).toDate() } as RAEntry)));
          raEntriesLoaded = true; checkLoading();
        });

      return () => { unsubReports(); unsubUsers(); unsubRaEntries(); };
    }
  }, [user]);

  const analysisData = React.useMemo(() => {
    if (dataLoading) return null;

    let targetUserIds: string[] = [];
    if (filterType === 'region' && selectedRegion !== 'All') {
        targetUserIds = allUsers.filter(u => u.region === selectedRegion).map(u => u.uid);
    } else if (filterType === 'user' && selectedUser !== 'All') {
        targetUserIds = [selectedUser];
    }
    
    const reports = targetUserIds.length > 0 ? allReports.filter(r => targetUserIds.includes(r.submittedBy)) : allReports;
    const raEntries = targetUserIds.length > 0 ? allRaEntries.filter(r => r.userId && targetUserIds.includes(r.userId)) : allRaEntries;

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const monthlyReports = reports.filter(r => r.date >= currentMonthStart && r.date <= currentMonthEnd);
    const monthlyRaEntries = raEntries.filter(r => r.date >= currentMonthStart && r.date <= currentMonthEnd);

    const reportedCollection = monthlyReports.reduce((acc, r) => acc + (r.oowCollection || 0), 0);
    const verifiedCollection = monthlyRaEntries.reduce((acc, r) => acc + (r.oowCollected || 0), 0);
    const totalConsumed = monthlyRaEntries.reduce((acc, r) => acc + (r.oowConsumed || 0), 0);
    const outstandingAmount = raEntries.reduce((acc, r) => acc + ((r.oowConsumed || 0) - (r.oowCollected || 0)), 0);

    const inventory = monthlyReports.reduce((acc, r) => {
        acc.good += r.goodInventoryRealme || 0;
        acc.defective += r.defectiveInventoryRealme || 0;
        acc.agreement += r.realmeAgreementDispatch || 0;
        return acc;
    }, { good: 0, defective: 0, agreement: 0 });
    
    const daysInMonth = eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd });
    const submittedDates = monthlyReports.map(r => r.date);
    
    const visitLog = monthlyReports
      .map(r => ({ ascName: r.ascName, date: r.date, submittedByName: r.submittedByName }))
      .sort((a,b) => b.date.getTime() - a.date.getTime());

    return { reportedCollection, verifiedCollection, outstandingAmount, inventory, daysInMonth, submittedDates, visitLog };
  }, [filterType, selectedRegion, selectedUser, allReports, allUsers, allRaEntries, dataLoading]);

  const handleFilterTypeChange = (type: 'region' | 'user') => {
      setFilterType(type);
      setSelectedRegion('All');
      setSelectedUser('All');
  }

  if (authLoading || dataLoading) return <AnalysisSkeleton />;
  if (user?.role !== 'Admin') return <div>Access Denied.</div>;
  
  const profile = filterType === 'user' && selectedUser !== 'All' ? allUsers.find(u => u.uid === selectedUser) : null;
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const submittedDays = analysisData?.submittedDates.map(d => new Date(d)) || [];
  
  return (
    <div className="flex flex-col gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Analysis Hub</CardTitle>
                <CardDescription>Filter by region or user to see detailed performance metrics for the current month.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
                <Select value={filterType} onValueChange={(v) => handleFilterTypeChange(v as any)}>
                    <SelectTrigger><SelectValue placeholder="Filter by..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="region">Region</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                </Select>
                {filterType === 'region' ? (
                    <Select value={selectedRegion} onValueChange={(v) => setSelectedRegion(v as any)}>
                        <SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Regions</SelectItem>
                            {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                    </Select>
                ) : (
                    <Select value={selectedUser} onValueChange={(v) => setSelectedUser(v)}>
                        <SelectTrigger><SelectValue placeholder="Select User" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Users</SelectItem>
                            {allUsers.map(u => <SelectItem key={u.uid} value={u.uid}>{u.name} ({u.role})</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
            </CardContent>
        </Card>

        {profile && (
            <Card>
                <CardContent className="pt-6 flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={profile.photoURL} alt={profile.name} data-ai-hint="person" />
                        <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="text-xl font-bold">{profile.name}</h3>
                        <p className="text-muted-foreground">{profile.role} - {profile.region}</p>
                    </div>
                </CardContent>
            </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader><CardTitle>Financial Performance</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-primary" /><span className="font-medium">OOW Collection (Reported):</span><span className="ml-auto font-bold"><AnimatedCounter value={analysisData?.reportedCollection || 0} prefix="₹" /></span></div>
                    <div className="flex items-center"><CheckCircle className="mr-2 h-5 w-5 text-green-500" /><span className="font-medium">OOW Collection (RA Verified):</span><span className="ml-auto font-bold"><AnimatedCounter value={analysisData?.verifiedCollection || 0} prefix="₹" /></span></div>
                    <div className="flex items-center"><Clock className="mr-2 h-5 w-5 text-destructive" /><span className="font-medium">Outstanding (RA Verified):</span><span className="ml-auto font-bold"><AnimatedCounter value={analysisData?.outstandingAmount || 0} prefix="₹" /></span></div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Submission Consistency</CardTitle></CardHeader>
                <CardContent>
                    <Calendar
                        month={currentMonth}
                        className="rounded-md border p-0"
                        classNames={{
                            day: "h-9 w-9 rounded-md",
                        }}
                        modifiers={{
                            submitted: submittedDays,
                            missed: day => {
                                if (day >= new Date().setHours(0,0,0,0) || day < startOfMonth(currentMonth)) return false;
                                return !submittedDays.some(d => isSameDay(d, day));
                            }
                        }}
                        modifiersClassNames={{
                            submitted: "bg-green-500 text-white",
                            missed: "bg-destructive/80 text-white"
                        }}
                        disabled
                    />
                    <div className="mt-4 text-center text-sm">
                        <Badge variant="default" className="bg-green-500 mr-2">Submitted</Badge>
                        <Badge variant="destructive" className="bg-destructive/80">Missed</Badge>
                    </div>
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Inventory Movement Summary</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4">
                    <div className="flex items-center p-4 bg-muted/50 rounded-lg"><Package className="mr-3 h-6 w-6 text-primary" /><div><p className="font-bold text-lg"><AnimatedCounter value={analysisData?.inventory.good || 0} /></p><p className="text-sm text-muted-foreground">Good to Realme</p></div></div>
                    <div className="flex items-center p-4 bg-muted/50 rounded-lg"><Warehouse className="mr-3 h-6 w-6 text-primary" /><div><p className="font-bold text-lg"><AnimatedCounter value={analysisData?.inventory.defective || 0} /></p><p className="text-sm text-muted-foreground">Defective to Realme</p></div></div>
                    <div className="flex items-center p-4 bg-muted/50 rounded-lg"><Plane className="mr-3 h-6 w-6 text-primary" /><div><p className="font-bold text-lg"><AnimatedCounter value={analysisData?.inventory.agreement || 0} /></p><p className="text-sm text-muted-foreground">Agreement to HO</p></div></div>
                </CardContent>
            </Card>
            
            <Card className="lg:col-span-2">
                 <CardHeader><CardTitle>Visit Log</CardTitle></CardHeader>
                 <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {filterType === 'region' && <TableHead>Submitted By</TableHead>}
                                <TableHead>ASC Name</TableHead>
                                <TableHead className="text-right">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {analysisData && analysisData.visitLog.length > 0 ? (
                                analysisData.visitLog.slice(0,10).map((log, i) => (
                                <TableRow key={i}>
                                    {filterType === 'region' && <TableCell>{log.submittedByName}</TableCell>}
                                    <TableCell className="font-medium">{log.ascName}</TableCell>
                                    <TableCell className="text-right">{format(log.date, 'PPP')}</TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={filterType === 'region' ? 3: 2} className="text-center">No visits recorded this month.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </CardContent>
            </Card>
        </div>
    </div>
  );
}
