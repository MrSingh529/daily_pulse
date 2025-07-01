
'use client';

import * as React from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PJP, UserProfile, Region } from '@/lib/types';

import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';


const regions: Region[] = ['North', 'South', 'East', 'West', 'HQ'];

export default function PJPPlansPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pjpPlans, setPjpPlans] = React.useState<PJP[]>([]);
  const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filters, setFilters] = React.useState({ name: '', region: 'All', user: 'All' });
  
  React.useEffect(() => {
    if (!user) return;
    if (user.reportVisibility === 'Own') {
      // Redirect or show access denied if they shouldn't be here
      // For now, they'll just see an empty list.
    }

    const q = query(collection(db, 'pjp_plans'), orderBy('planDate', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const plansData: PJP[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        plansData.push({
          id: doc.id,
          ...data,
          planDate: (data.planDate as any)?.toDate(),
        } as PJP);
      });
      setPjpPlans(plansData);
      setLoading(false);
    });
    
    // Fetch users for filtering
    if (user.reportVisibility === 'All' || user.reportVisibility === 'Region') {
      const usersQuery = query(collection(db, 'users'));
      const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      });
       return () => { unsubscribe(); unsubUsers() };
    }

    return () => unsubscribe();
  }, [user]);

  const filteredPlans = React.useMemo(() => {
    if (!user) return [];

    let plansToShow = pjpPlans;

    if (user.reportVisibility === 'Own') {
      plansToShow = plansToShow.filter(p => p.userId === user.uid);
    } else if (user.reportVisibility === 'Region' && user.regions) {
      plansToShow = plansToShow.filter(p => p.userRegion && user.regions?.includes(p.userRegion));
    }

    return plansToShow.filter(plan => {
        const nameMatch = filters.name ? plan.userName.toLowerCase().includes(filters.name.toLowerCase()) : true;
        const regionMatch = filters.region === 'All' || plan.userRegion === filters.region;
        const userMatch = filters.user === 'All' || plan.userId === filters.user;
        return nameMatch && regionMatch && userMatch;
    });

  }, [pjpPlans, user, filters]);

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({...prev, [filterName]: value }));
  }

  const handleDeletePlan = async (planId: string) => {
    if (!db || (user?.role !== 'Admin' && !pjpPlans.find(p => p.id === planId && p.userId === user?.uid))) {
      toast({ variant: 'destructive', title: "Permission Denied", description: "You don't have permission to delete this plan." });
      return;
    }
    try {
      await deleteDoc(doc(db, "pjp_plans", planId));
      toast({ title: "Plan Entry Deleted", description: "The PJP entry has been successfully deleted." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: "Failed to delete the plan entry." });
      console.error("Error deleting PJP entry: ", error);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>PJP Plans</CardTitle>
          <CardDescription>
            Review all submitted Personal Journey Plans from the team.
          </CardDescription>
           <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
                placeholder="Filter by Name..."
                value={filters.name}
                onChange={(e) => handleFilterChange('name', e.target.value)}
                disabled={user?.reportVisibility === 'Own'}
            />
            <Select value={filters.region} onValueChange={(value) => handleFilterChange('region', value)} disabled={user?.reportVisibility !== 'All'}>
                <SelectTrigger>
                    <SelectValue placeholder="Filter by Region" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="All">All Regions</SelectItem>
                    {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={filters.user} onValueChange={(value) => handleFilterChange('user', value)} disabled={user?.reportVisibility === 'Own'}>
                <SelectTrigger>
                    <SelectValue placeholder="Filter by User" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="All">All Users</SelectItem>
                    {allUsers.map(u => <SelectItem key={u.uid} value={u.uid}>{u.name}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Planned Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>SC Name</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
              ) : filteredPlans.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center">No PJP entries found matching your filters.</TableCell></TableRow>
              ) : (
                filteredPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>{format(plan.planDate, 'PPP')}</TableCell>
                    <TableCell className="font-medium">{plan.userName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{plan.userRegion || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>{plan.scName}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{plan.remarks}</TableCell>
                    <TableCell>
                      {(user?.role === 'Admin' || user?.uid === plan.userId) && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete this PJP entry.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePlan(plan.id!)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
