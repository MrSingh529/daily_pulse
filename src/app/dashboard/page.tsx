
'use client';

import * as React from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Report, UserProfile, Region, RAEntry } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, Package, TrendingUp, Users, CheckCircle } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { ChartConfig } from '@/components/ui/chart';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { startOfDay, endOfDay } from 'date-fns';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { useAuth } from '@/contexts/auth-context';

const raChartConfig = {
  consumed: {
    label: 'OOW Consumed',
    color: 'hsl(var(--muted))',
  },
  collected: {
    label: 'OOW Collected',
    color: 'hsl(var(--primary))',
  },
  recoveryRate: {
    label: 'Recovery Rate',
  },
} satisfies ChartConfig;

const regionalChartConfig = {
  recovery: {
    label: 'Recovery Rate',
    color: 'hsl(var(--accent))',
  },
} satisfies ChartConfig;

export default function DashboardPage() {
  const { user } = useAuth();
  const [reports, setReports] = React.useState<Report[]>([]);
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [raEntries, setRaEntries] = React.useState<RAEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingUsers, setLoadingUsers] = React.useState(true);
  const [loadingRa, setLoadingRa] = React.useState(true);

  React.useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reportsData: Report[] = [];
      querySnapshot.forEach((doc) => {
        reportsData.push({ id: doc.id, ...doc.data() } as Report);
      });
      setReports(reportsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  React.useEffect(() => {
    const q = query(collection(db, 'ra_entries'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const raData: RAEntry[] = [];
      querySnapshot.forEach((doc) => {
        raData.push({ id: doc.id, ...doc.data() } as RAEntry);
      });
      setRaEntries(raData);
      setLoadingRa(false);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['ASM', 'RSM']));
     const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(usersData);
      setLoadingUsers(false);
    });
    return () => unsubscribe();
  }, []);

  const { totalOutstanding, thisMonthOOW, thisMonthVerifiedOOW, chartData, submissionStatus, regionalPerformanceData } = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalOutstanding = raEntries.reduce((acc, entry) => acc + (entry.oowConsumed || 0) - (entry.oowCollected || 0), 0);
    
    const thisMonthOOW = reports.reduce((acc, report) => {
      const reportDate = (report.date as Timestamp)?.toDate();
      if (reportDate && reportDate.getMonth() === currentMonth && reportDate.getFullYear() === currentYear) {
        acc += report.oowCollection || 0;
      }
      return acc;
    }, 0);

    const thisMonthVerifiedOOW = raEntries.reduce((acc, entry) => {
      const entryDate = (entry.date as Timestamp)?.toDate();
      if(entryDate && entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
        acc += entry.oowCollected || 0;
      }
      return acc;
    }, 0);


    const monthlyRaData: { [key: string]: { consumed: number; collected: number; } } = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const monthName = d.toLocaleString('default', { month: 'long' });
        monthlyRaData[monthName] = { consumed: 0, collected: 0 };
    }

    raEntries.forEach(entry => {
        const entryDate = (entry.date as Timestamp)?.toDate();
        if (entryDate) {
          const monthName = entryDate.toLocaleString('default', { month: 'long' });
          if (monthlyRaData.hasOwnProperty(monthName)) {
              monthlyRaData[monthName].consumed += entry.oowConsumed || 0;
              monthlyRaData[monthName].collected += entry.oowCollected || 0;
          }
        }
    });

    const chartData = Object.keys(monthlyRaData).map(month => ({
        month,
        consumed: monthlyRaData[month].consumed,
        collected: monthlyRaData[month].collected,
        recoveryRate: monthlyRaData[month].consumed > 0 
            ? `${((monthlyRaData[month].collected / monthlyRaData[month].consumed) * 100).toFixed(2)}%`
            : '0.00%'
    }));


    // Daily Submission Status Logic
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const todaysReports = reports.filter(r => {
        const reportDate = (r.date as Timestamp)?.toDate();
        return reportDate >= todayStart && reportDate <= todayEnd;
    });

    const submittedTodayUserIds = new Set(todaysReports.map(r => r.submittedBy));

    const usersByRegion = users.reduce((acc, user) => {
        (user.regions || ['HQ']).forEach(region => {
            if (!acc[region]) {
                acc[region] = [];
            }
            acc[region].push(user);
        });
        return acc;
    }, {} as Record<Region, UserProfile[]>);


    const submissionStatus = Object.entries(usersByRegion).map(([region, regionUsers]) => {
        const uniqueUsers = Array.from(new Set(regionUsers.map(u => u.uid))).map(uid => regionUsers.find(u => u.uid === uid)!);
        const submittedCount = uniqueUsers.filter(u => submittedTodayUserIds.has(u.uid)).length;
        return {
            region,
            users: uniqueUsers,
            submittedCount,
            totalCount: uniqueUsers.length,
        };
    }).sort((a,b) => a.region.localeCompare(b.region));

     // Regional Performance Logic
    const regionalPerformance: Record<string, { oowCollection: number, outstandingAmount: number }> = {};
    reports.forEach(report => {
        const region = report.submittedByRegion || 'HQ';
        if (!regionalPerformance[region]) {
            regionalPerformance[region] = { oowCollection: 0, outstandingAmount: 0 };
        }
        regionalPerformance[region].oowCollection += report.oowCollection || 0;
        regionalPerformance[region].outstandingAmount += report.outstandingAmount || 0;
    });

    const regionalPerformanceData = Object.entries(regionalPerformance).map(([region, data]) => ({
        region,
        recovery: data.outstandingAmount > 0 ? (data.oowCollection / data.outstandingAmount) * 100 : 0,
    }))
    .filter(item => item.region !== 'HQ')
    .sort((a, b) => b.recovery - a.recovery);

    return { totalOutstanding, thisMonthOOW, thisMonthVerifiedOOW, chartData, submissionStatus, regionalPerformanceData };
  }, [reports, users, raEntries]);

  if (loading || loadingUsers || loadingRa || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.name}!</h1>
        <p className="text-muted-foreground">
          Here's a look at what's happening with your teams today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Outstanding Amount (RA Verified)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedCounter value={totalOutstanding} prefix="₹" decimals={2} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Reporting Staff
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
               <AnimatedCounter value={users.length} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Reports Submitted
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
               <AnimatedCounter value={reports.length} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              OOW Collection (Reported)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedCounter value={thisMonthOOW} prefix="₹" decimals={2} />
            </div>
             <p className="text-xs text-muted-foreground">
              This Month by ASMs/RSMs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              OOW Collection (RA Verified)
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedCounter value={thisMonthVerifiedOOW} prefix="₹" decimals={2} />
            </div>
            <p className="text-xs text-muted-foreground">
              This Month by RA Team
            </p>
          </CardContent>
        </Card>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>RA Verified: Consumption vs. Collection</CardTitle>
            <CardDescription>
             Monthly OOW amount consumed vs. the amount collected, as verified by the RA team. Hover over the bars to see the recovery percentage.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={raChartConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                 <YAxis
                  tickFormatter={(value) => `₹${Number(value) / 1000}k`}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="consumed" fill="var(--color-consumed)" radius={4} animationDuration={800} />
                <Bar dataKey="collected" fill="var(--color-collected)" radius={4} animationDuration={800} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Reports</CardTitle>
            <CardDescription>
              A quick look at the latest submitted reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ASC Name</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={2}>Loading reports...</TableCell></TableRow>
                ) : reports.slice(0, 5).length === 0 ? (
                  <TableRow><TableCell colSpan={2}>No reports found.</TableCell></TableRow>
                ) : (
                  reports.slice(0, 5).map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="font-medium">{report.ascName}</div>
                        <div className="hidden text-sm text-muted-foreground md:inline">
                          {report.submittedByName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">₹{(report.outstandingAmount || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Daily Submission Status</CardTitle>
            <CardDescription>
                Report submission status for today, grouped by region.
            </CardDescription>
        </CardHeader>
        <CardContent>
            {loadingUsers ? <p>Loading user status...</p> : (
            <Accordion type="single" collapsible className="w-full">
                {submissionStatus.map(({ region, users, submittedCount, totalCount }) => (
                     <AccordionItem value={region} key={region}>
                        <AccordionTrigger>
                           <div className="flex items-center gap-4">
                                <span className="font-semibold text-base">{region}</span>
                                <Badge variant={submittedCount === totalCount ? 'default' : 'secondary'} className="bg-green-600 text-white">
                                    {submittedCount} / {totalCount} Submitted
                                </Badge>
                           </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map(u => {
                                        const hasSubmitted = reports.some(r => r.submittedBy === u.uid && (r.date as Timestamp)?.toDate() >= startOfDay(new Date()));
                                        return (
                                            <TableRow key={u.uid}>
                                                <TableCell className="font-medium">{u.name}</TableCell>
                                                <TableCell>{u.role}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={hasSubmitted ? 'default' : 'destructive'} className={hasSubmitted ? 'bg-green-500' : ''}>
                                                        {hasSubmitted ? 'Submitted' : 'Not Submitted'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            )}
        </CardContent>
       </Card>

       <Card>
          <CardHeader>
            <CardTitle>Regional Recovery Performance</CardTitle>
            <CardDescription>
              Recovery rate (OOW Collection vs. Outstanding Amount) by region based on team reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={regionalChartConfig} className="h-[300px] w-full">
               <BarChart data={regionalPerformanceData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="region"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  width={80}
                />
                <XAxis dataKey="recovery" type="number" tickFormatter={(value) => `${value.toFixed(0)}%`} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" formatter={(value, name) => `${name}: ${Number(value).toFixed(2)}%`}/>}
                />
                <Bar dataKey="recovery" fill="var(--color-recovery)" radius={4} animationDuration={800} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
    </div>
  );
}