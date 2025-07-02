
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
    color: 'hsl(var(--muted-foreground))',
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
    color: 'hsl(var(--primary))',
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
    <div className="flex flex-col gap-6 p-4">
      <div className="px-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user.name}!</h1>
        <p className="text-muted-foreground mt-1">
          Here's a look at what's happening with your teams today.
        </p>
      </div>
  
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Total Outstanding Amount (RA Verified)",
            value: totalOutstanding,
            icon: DollarSign,
            prefix: "₹",
            decimals: 2,
            className: "lg:col-span-2"
          },
          {
            title: "Reporting Staff",
            value: users.length,
            icon: Users
          },
          {
            title: "Total Reports Submitted",
            value: reports.length,
            icon: Package
          },
          {
            title: "OOW Collection (Reported)",
            value: thisMonthOOW,
            icon: TrendingUp,
            prefix: "₹",
            decimals: 2,
            description: "This Month by ASMs/RSMs"
          },
          {
            title: "OOW Collection (RA Verified)",
            value: thisMonthVerifiedOOW,
            icon: CheckCircle,
            prefix: "₹",
            decimals: 2,
            description: "This Month by RA Team"
          }
        ].map((stat, i) => (
          <div key={i} className={`ios-card ${stat.className || ""}`}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">{stat.title}</h3>
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-2">
                <p className="text-2xl font-semibold">
                  <AnimatedCounter 
                    value={stat.value} 
                    prefix={stat.prefix} 
                    decimals={stat.decimals} 
                  />
                </p>
                {stat.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
  
      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="ios-card col-span-4">
          <div className="p-6 ios-card-header">
            <h2 className="text-xl font-semibold">RA Verified: Consumption vs. Collection</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Monthly OOW amount consumed vs. the amount collected, as verified by the RA team.
            </p>
          </div>
          <div className="p-6 pt-0">
            <ChartContainer config={raChartConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} stroke="hsl(var(--muted))" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickFormatter={(value) => `₹${Number(value) / 1000}k`}
                  stroke="hsl(var(--muted-foreground))"
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar 
                  dataKey="consumed" 
                  fill="hsl(var(--muted-foreground))" 
                  radius={[4, 4, 0, 0]} 
                  animationDuration={800} 
                />
                <Bar 
                  dataKey="collected" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]} 
                  animationDuration={800} 
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
  
        <div className="ios-card col-span-4 lg:col-span-3">
          <div className="p-6 ios-card-header">
            <h2 className="text-xl font-semibold">Recent Reports</h2>
            <p className="text-muted-foreground text-sm mt-1">
              A quick look at the latest submitted reports.
            </p>
          </div>
          <div className="p-0">
            <Table>
              <TableHeader className="bg-neutral-100/50 dark:bg-neutral-800/50">
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
                    <TableRow key={report.id} className="hover:bg-neutral-100/30 dark:hover:bg-neutral-800/30">
                      <TableCell>
                        <div className="font-medium">{report.ascName}</div>
                        <div className="text-sm text-muted-foreground">
                          {report.submittedByName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{(report.outstandingAmount || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
  
      {/* Daily Submission Status */}
      <div className="ios-card">
        <div className="p-6 ios-card-header">
          <h2 className="text-xl font-semibold">Daily Submission Status</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Report submission status for today, grouped by region.
          </p>
        </div>
        <div className="p-6 pt-0">
          {loadingUsers ? <p>Loading user status...</p> : (
            <Accordion type="single" collapsible className="w-full">
              {submissionStatus.map(({ region, users, submittedCount, totalCount }) => (
                <AccordionItem value={region} key={region} className="border-b border-neutral-200/70 dark:border-neutral-700/50 last:border-0">
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-base">{region}</span>
                      <span className={`ios-pill ${submittedCount === totalCount ? 'bg-green-500 text-white' : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'}`}>
                        {submittedCount} / {totalCount} Submitted
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <Table>
                      <TableHeader className="bg-transparent">
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
                            <TableRow key={u.uid} className="hover:bg-neutral-100/30 dark:hover:bg-neutral-800/30">
                              <TableCell className="font-medium">{u.name}</TableCell>
                              <TableCell>{u.role}</TableCell>
                              <TableCell className="text-right">
                                <span className={`ios-pill ${hasSubmitted ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                  {hasSubmitted ? 'Submitted' : 'Not Submitted'}
                                </span>
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
        </div>
      </div>
  
      {/* Regional Performance */}
      <div className="ios-card">
        <div className="p-6 ios-card-header">
          <h2 className="text-xl font-semibold">Regional Recovery Performance</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Recovery rate (OOW Collection vs. Outstanding Amount) by region based on team reports.
          </p>
        </div>
        <div className="p-6 pt-0">
          <ChartContainer config={regionalChartConfig} className="h-[300px] w-full">
            <BarChart data={regionalPerformanceData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--muted))" />
              <YAxis
                dataKey="region"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                width={80}
                stroke="hsl(var(--muted-foreground))"
              />
              <XAxis 
                dataKey="recovery" 
                type="number" 
                tickFormatter={(value) => `${value.toFixed(0)}%`} 
                stroke="hsl(var(--muted-foreground))"
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" formatter={(value, name) => `${name}: ${Number(value).toFixed(2)}%`}/>}
              />
              <Bar 
                dataKey="recovery" 
                fill="hsl(var(--primary))" 
                radius={[0, 4, 4, 0]} 
                animationDuration={800} 
              />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}