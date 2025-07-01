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
import { DollarSign, Package, TrendingUp, Users, CheckCircle, ChevronRight } from 'lucide-react';
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
        const region = user.region || 'HQ';
        if (!acc[region]) {
            acc[region] = [];
        }
        acc[region].push(user);
        return acc;
    }, {} as Record<Region, UserProfile[]>);

    const submissionStatus = Object.entries(usersByRegion).map(([region, regionUsers]) => {
        const submittedCount = regionUsers.filter(u => submittedTodayUserIds.has(u.uid)).length;
        return {
            region,
            users: regionUsers,
            submittedCount,
            totalCount: regionUsers.length,
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-purple-400 rounded-full animate-spin animate-reverse" style={{ animationDelay: '-0.5s' }}></div>
          </div>
          <p className="text-slate-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* iOS-style Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
                Welcome back, {user.name}! 👋
              </h1>
              <p className="text-slate-600 mt-1">Here's what's happening with your teams today</p>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full text-white text-sm font-medium shadow-lg">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              Live Dashboard
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Cards - iOS Style */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Primary Stat Card */}
          <Card className="lg:col-span-2 bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 backdrop-blur-xl bg-white/90">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-2xl shadow-lg">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-700">Total Outstanding</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">RA Verified Amount</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                <AnimatedCounter value={totalOutstanding} prefix="₹" decimals={2} />
              </div>
              <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full animate-pulse"></div>
              </div>
            </CardContent>
          </Card>

          {/* Secondary Stats */}
          <div className="space-y-6">
            <Card className="group bg-gradient-to-br from-white to-purple-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Staff</p>
                      <div className="text-2xl font-bold text-slate-800">
                        <AnimatedCounter value={users.length} />
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
                    <div className="text-xs font-bold text-purple-600">{users.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group bg-gradient-to-br from-white to-amber-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Reports</p>
                      <div className="text-2xl font-bold text-slate-800">
                        <AnimatedCounter value={reports.length} />
                      </div>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center">
                    <div className="text-xs font-bold text-amber-600">{reports.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Collection Stats */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-white via-green-50 to-emerald-50 border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl shadow-lg">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-700">OOW Collection</CardTitle>
                  <p className="text-sm text-slate-500">Reported by Teams</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                <AnimatedCounter value={thisMonthOOW} prefix="₹" decimals={2} />
              </div>
              <p className="text-sm text-slate-500">This month by ASMs/RSMs</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white via-blue-50 to-cyan-50 border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-700">OOW Collection</CardTitle>
                  <p className="text-sm text-slate-500">RA Verified</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">
                <AnimatedCounter value={thisMonthVerifiedOOW} prefix="₹" decimals={2} />
              </div>
              <p className="text-sm text-slate-500">This month by RA Team</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Chart */}
          <Card className="lg:col-span-2 bg-white/90 backdrop-blur-xl border-0 shadow-2xl hover:shadow-3xl transition-all duration-500">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3">
                <div className="w-3 h-8 bg-gradient-to-b from-blue-400 to-indigo-600 rounded-full"></div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-800">Consumption vs Collection Analysis</CardTitle>
                  <CardDescription className="text-slate-600 mt-1">
                    Monthly OOW trends verified by RA team with recovery insights
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-8">
              <ChartContainer config={raChartConfig} className="h-[350px] w-full">
                <BarChart accessibilityLayer data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => `₹${Number(value) / 1000}k`}
                  />
                  <ChartTooltip
                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar 
                    dataKey="consumed" 
                    fill="url(#consumedGradient)" 
                    radius={[8, 8, 0, 0]} 
                    animationDuration={1200}
                  />
                  <Bar 
                    dataKey="collected" 
                    fill="url(#collectedGradient)" 
                    radius={[8, 8, 0, 0]} 
                    animationDuration={1200}
                    animationDelay={300}
                  />
                  <defs>
                    <linearGradient id="consumedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#94a3b8" />
                      <stop offset="100%" stopColor="#cbd5e1" />
                    </linearGradient>
                    <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Recent Reports */}
          <Card className="bg-white/90 backdrop-blur-xl border-0 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-8 bg-gradient-to-b from-purple-400 to-pink-600 rounded-full"></div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-800">Recent Activity</CardTitle>
                  <CardDescription className="text-slate-600">Latest report submissions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : reports.slice(0, 5).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No reports found</p>
                </div>
              ) : (
                reports.slice(0, 5).map((report, index) => (
                  <div 
                    key={report.id} 
                    className="group p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-100 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                          {report.ascName}
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          by {report.submittedByName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-slate-800">
                          ₹{(report.outstandingAmount || 0).toFixed(2)}
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors ml-auto" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submission Status */}
        <Card className="bg-white/90 backdrop-blur-xl border-0 shadow-xl">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 bg-gradient-to-b from-emerald-400 to-green-600 rounded-full"></div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-800">Daily Submission Status</CardTitle>
                <CardDescription className="text-slate-600 mt-1">
                  Real-time report submission tracking by region
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse p-4 bg-slate-100 rounded-2xl">
                    <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {submissionStatus.map(({ region, users, submittedCount, totalCount }) => {
                  const completionRate = (submittedCount / totalCount) * 100;
                  return (
                    <div key={region} className="group">
                      <div className="p-6 bg-gradient-to-r from-slate-50 via-white to-blue-50 rounded-2xl border border-slate-100 hover:shadow-lg transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                                <span className="font-bold text-blue-600">{region.slice(0, 2)}</span>
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-slate-800">{region}</h3>
                                <p className="text-sm text-slate-500">Regional Performance</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-slate-800">
                                {submittedCount}/{totalCount}
                              </div>
                              <div className="text-sm text-slate-500">
                                {completionRate.toFixed(0)}% Complete
                              </div>
                            </div>
                            <Badge 
                              variant={submittedCount === totalCount ? 'default' : 'secondary'} 
                              className={`px-4 py-2 rounded-full font-semibold ${
                                submittedCount === totalCount 
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                                  : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md'
                              }`}
                            >
                              {submittedCount === totalCount ? '✓ Complete' : '⏳ Pending'}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${completionRate}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* User List */}
                        <div className="grid gap-3 md:grid-cols-2">
                          {users.map(u => {
                            const hasSubmitted = reports.some(r => r.submittedBy === u.uid && (r.date as Timestamp)?.toDate() >= startOfDay(new Date()));
                            return (
                              <div key={u.uid} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                                    hasSubmitted ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-slate-400 to-gray-500'
                                  }`}>
                                    {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-800">{u.name}</div>
                                    <div className="text-sm text-slate-500">{u.role}</div>
                                  </div>
                                </div>
                                <Badge 
                                  variant={hasSubmitted ? 'default' : 'destructive'} 
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    hasSubmitted 
                                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                                      : 'bg-gradient-to-r from-red-400 to-pink-500 text-white'
                                  }`}
                                >
                                  {hasSubmitted ? '✓ Submitted' : '○ Pending'}
                                </Badge>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Regional Performance Chart */}
        <Card className="bg-white/90 backdrop-blur-xl border-0 shadow-xl">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 bg-gradient-to-b from-indigo-400 to-purple-600 rounded-full"></div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-800">Regional Recovery Performance</CardTitle>
                <CardDescription className="text-slate-600 mt-1">
                  Recovery rate analysis across all regions based on team reports
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-8">
            <ChartContainer config={regionalChartConfig} className="h-[400px] w-full">
              <BarChart data={regionalPerformanceData} layout="vertical" margin={{ left: 80, right: 20, top: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <YAxis
                  dataKey="region"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={15}
                  width={70}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                />
                <XAxis 
                  dataKey="recovery" 
                  type="number" 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`} 
                />
                <ChartTooltip
                  cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                  content={<ChartTooltipContent 
                    indicator="dot" 
                    formatter={(value, name) => [
                      `${Number(value).toFixed(2)}%`, 
                      'Recovery Rate'
                    ]}
                    labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                  />}
                />
                <Bar 
                  dataKey="recovery" 
                  fill="url(#recoveryGradient)" 
                  radius={[0, 12, 12, 0]} 
                  animationDuration={1500}
                />
                <defs>
                  <linearGradient id="recoveryGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-100 to-blue-100 rounded-full border border-white/50 shadow-lg backdrop-blur-xl">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-slate-700">Dashboard updated in real-time</span>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes animate-reverse {
          to {
            transform: rotate(-360deg);
          }
        }
        .animate-reverse {
          animation: animate-reverse 1s linear infinite;
        }
        
        /* Custom scrollbar for iOS feel */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #cbd5e1, #94a3b8);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #94a3b8, #64748b);
        }

        /* Smooth animations */
        * {
          transition-property: transform, opacity, box-shadow, background-color, border-color;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Glass morphism effect */
        .backdrop-blur-xl {
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        /* Enhanced shadows */
        .shadow-3xl {
          box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25);
        }

        /* Gradient text animation */
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .bg-gradient-animate {
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
        }
      `}</style>
    </div>
  );
}