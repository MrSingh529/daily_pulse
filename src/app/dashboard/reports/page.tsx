
'use client';
import * as React from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, arrayUnion, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Report, UserProfile, Region } from '@/lib/types';

import { File, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSearchParams } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const regions: Region[] = ['North', 'South', 'East', 'West', 'HQ'];

export default function ReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = React.useState<Report[]>([]);
  const [allUsers, setAllUsers] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedReport, setSelectedReport] = React.useState<Report | null>(null);
  const [filters, setFilters] = React.useState({ name: '', region: 'All', submittedBy: 'All' });
  const [newComment, setNewComment] = React.useState('');
  const [isAddingComment, setIsAddingComment] = React.useState(false);
  const searchParams = useSearchParams();


  React.useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reportsData: Report[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        reportsData.push({
          id: doc.id,
          ...data,
          date: (data.date as any)?.toDate(), // Convert Firestore Timestamp to JS Date
        } as Report);
      });
      setReports(reportsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (db && user?.reportVisibility === 'All' || user?.reportVisibility === 'Region') {
      const usersQuery = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
        const usersData: UserProfile[] = [];
        snapshot.forEach(doc => usersData.push({ uid: doc.id, ...doc.data() } as UserProfile));
        setAllUsers(usersData);
      });
      return () => unsubscribe();
    }
  }, [user]);

    React.useEffect(() => {
    const viewReportId = searchParams.get('view');
    if (viewReportId && reports.length > 0) {
      const reportToView = reports.find(r => r.id === viewReportId);
      if (reportToView) {
        setSelectedReport(reportToView);
      }
    }
  }, [searchParams, reports]);


  const filteredReports = React.useMemo(() => {
    if (!user) return [];

    let reportsToShow = reports;

    // First, filter by visibility rules based on the logged-in user's profile
    if (user.reportVisibility === 'Own') {
      reportsToShow = reports.filter(r => r.submittedBy === user.uid);
    } else if (user.reportVisibility === 'Region') {
      reportsToShow = reports.filter(r => r.submittedByRegion === user.region);
    }
    // If 'All', no initial filter is applied, they see everything.

    // Then, apply the user-selected filters from the UI
    return reportsToShow.filter(report => {
        const nameMatch = filters.name ? report.submittedByName.toLowerCase().includes(filters.name.toLowerCase()) : true;
        const regionMatch = filters.region === 'All' || report.submittedByRegion === filters.region;
        const userMatch = filters.submittedBy === 'All' || report.submittedBy === filters.submittedBy;
        return nameMatch && regionMatch && userMatch;
    });
  }, [reports, user, filters]);

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    setFilters(prev => ({...prev, [filterName]: value }));
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!db || user?.role !== 'Admin') {
      toast({ variant: 'destructive', title: "Permission Denied", description: "You don't have permission to delete reports." });
      return;
    }
    try {
      await deleteDoc(doc(db, "reports", reportId));
      toast({ title: "Report Deleted", description: "The report has been successfully deleted." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: "Failed to delete the report." });
      console.error("Error deleting report: ", error);
    }
  };
  
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedReport || !user || !db) return;
    setIsAddingComment(true);

    const comment = {
      text: newComment,
      byName: user.name!,
      byId: user.uid,
      date: Timestamp.now(),
    };
    
    // Optimistically update UI
    const updatedRemarks = [...(selectedReport.remarks || []), comment];
    setSelectedReport(prev => prev ? { ...prev, remarks: updatedRemarks } : null);
    setNewComment('');


    try {
      const reportRef = doc(db, 'reports', selectedReport.id!);
      await updateDoc(reportRef, {
        remarks: arrayUnion(comment)
      });
      
      // Create notifications for relevant users
      const participants = new Set<string>();
      participants.add(selectedReport.submittedBy);
      updatedRemarks.forEach(remark => participants.add(remark.byId));
      
      // Don't notify the user who just commented
      participants.delete(user.uid);

      const notificationMessage = `${user.name} commented on the report for "${selectedReport.ascName}"`;
      for (const participantId of participants) {
        await addDoc(collection(db, 'notifications'), {
          userId: participantId,
          message: notificationMessage,
          reportId: selectedReport.id!,
          createdAt: Timestamp.now(),
          isRead: false,
        });
      }

      toast({ title: "Comment added!" });
    } catch (error) {
      console.error("Error adding comment: ", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not add comment." });
      // Revert optimistic update on error
      setSelectedReport(prev => prev ? { ...prev, remarks: prev.remarks?.slice(0, -1) || [] } : null);
    } finally {
      setIsAddingComment(false);
    }
  };

  const exportToCSV = () => {
    if (filteredReports.length === 0) {
        toast({ variant: 'destructive', title: "No Data", description: "There are no reports to export." });
        return;
    }

    const headers = [
        "Report ID", "Date", "ASC Name", "Submitted By", "Role", "Region", 
        "Outstanding Amount (₹)", "OOW Collection (₹)", "Good Inventory to Realme (QTY)",
        "Defective Inventory to Realme (QTY)", "Realme Agreement Dispatch (QTY)",
        "Realme SD Collection (₹)", "Multibrand STNs Dispatched (QTY)", "Pending STNs (3+ Days) (QTY)"
    ];

    const csvRows = [headers.join(',')];

    for (const report of filteredReports) {
        const values = [
            report.id,
            report.date ? new Date(report.date).toLocaleDateString() : 'N/A',
            report.ascName,
            report.submittedByName,
            report.submittedByRole,
            report.submittedByRegion,
            report.outstandingAmount,
            report.oowCollection,
            report.goodInventoryRealme,
            report.defectiveInventoryRealme,
            report.realmeAgreementDispatch,
            report.realmeSdCollection,
            report.multibrandStnDispatched,
            report.multibrandPendingStns
        ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
        csvRows.push(values);
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_pulse_reports_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
              <div>
                  <CardTitle>Reports</CardTitle>
                  <CardDescription>
                  Manage and review all submitted reports.
                  </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={exportToCSV}>
                  <File className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Export
                  </span>
                  </Button>
              </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
                placeholder="Filter by ASM/RSM Name..."
                value={filters.name}
                onChange={(e) => handleFilterChange('name', e.target.value)}
            />
            <Select value={filters.region} onValueChange={(value) => handleFilterChange('region', value)}>
                <SelectTrigger>
                    <SelectValue placeholder="Filter by Region" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="All">All Regions</SelectItem>
                    {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={filters.submittedBy} onValueChange={(value) => handleFilterChange('submittedBy', value)}>
                <SelectTrigger disabled={user?.reportVisibility === 'Own'}>
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
                <TableHead>ASC Name</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
              ) : filteredReports.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center">No reports found matching your filters.</TableCell></TableRow>
              ) : (
                filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.ascName}</TableCell>
                    <TableCell>
                      {report.submittedByName} ({report.submittedByRole})
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.submittedByRegion || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{report.date ? new Date(report.date).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell className="text-right">₹{(report.outstandingAmount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => setSelectedReport(report)}>View Details</DropdownMenuItem>
                          {user?.role === 'Admin' && (
                            <>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Delete</DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the report.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteReport(report.id!)} className="bg-destructive hover:bg-destructive/90">
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Report Details</DialogTitle>
              <DialogDescription>
                Full details for report from {selectedReport.ascName} on {selectedReport.date ? new Date(selectedReport.date).toLocaleDateString() : 'N/A'}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 py-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">ASC Name</span>
                <span className="font-semibold">{selectedReport.ascName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">Date</span>
                <span className="font-semibold">{selectedReport.date ? new Date(selectedReport.date).toLocaleDateString() : 'N/A'}</span>
              </div>
               <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">Submitted By</span>
                <span className="font-semibold">{selectedReport.submittedByName} ({selectedReport.submittedByRole})</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">Region</span>
                <span className="font-semibold">{selectedReport.submittedByRegion || 'N/A'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">Total Remaining Outstanding</span>
                <span className="font-semibold">₹{(selectedReport.outstandingAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">OOW Collection</span>
                <span className="font-semibold">₹{(selectedReport.oowCollection || 0).toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">Good Inventory to Realme</span>
                <span className="font-semibold">{selectedReport.goodInventoryRealme || 0}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">Defective Inventory to Realme</span>
                <span className="font-semibold">{selectedReport.defectiveInventoryRealme || 0}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">Realme SD Collection</span>
                <span className="font-semibold">₹{(selectedReport.realmeSdCollection || 0).toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">Multibrand STNs Dispatched</span>
                <span className="font-semibold">{selectedReport.multibrandStnDispatched || 0}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">Pending STNs (3+ Days)</span>
                <span className="font-semibold">{selectedReport.multibrandPendingStns || 0}</span>
              </div>
               <div className="flex flex-col">
                <span className="text-sm font-medium text-muted-foreground">After Sign Off Realme Agreement Dispatch to HO (QTY)</span>
                <span className="font-semibold">{selectedReport.realmeAgreementDispatch}</span>
              </div>
            </div>
             <div className="border-t pt-4">
                <h4 className="font-semibold mb-4 text-base">Remarks Timeline</h4>
                <div className="space-y-4 max-h-48 overflow-y-auto pr-4 mb-4 relative">
                    {selectedReport.remarks && selectedReport.remarks.length > 0 ? (
                        <>
                          <div className="absolute left-3 top-0 h-full w-px bg-border -translate-x-1/2"></div>
                          {selectedReport.remarks.sort((a,b) => a.date.toMillis() - b.date.toMillis()).map((remark, index) => {
                              const remarkUser = allUsers.find(u => u.uid === remark.byId);
                              return (
                                  <div key={index} className="relative pl-8">
                                      <div className="absolute -left-[1px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-background border-2 border-primary">
                                          <Avatar className="h-6 w-6">
                                              <AvatarImage src={remarkUser?.photoURL || undefined} alt={remark.byName} />
                                              <AvatarFallback>{remark.byName.charAt(0).toUpperCase()}</AvatarFallback>
                                          </Avatar>
                                      </div>
                                      <div className="ml-3">
                                          <div className="rounded-lg border bg-muted/40 p-3">
                                              <div className="flex items-center justify-between">
                                                  <p className="font-semibold text-sm text-foreground">{remark.byName}</p>
                                                  <p className="text-xs text-muted-foreground">{remark.date.toDate().toLocaleString()}</p>
                                              </div>
                                              <p className="mt-1 text-sm text-foreground/80">{remark.text}</p>
                                          </div>
                                      </div>
                                  </div>
                              )
                          })}
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground pl-2">No remarks yet.</p>
                    )}
                </div>
                <div className="mt-2 flex items-start gap-2">
                    <Textarea 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a new remark..."
                        className="flex-1"
                        rows={2}
                    />
                    <Button onClick={handleAddComment} disabled={isAddingComment || !newComment.trim()}>
                        {isAddingComment ? "Adding..." : "Add"}
                    </Button>
                </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
