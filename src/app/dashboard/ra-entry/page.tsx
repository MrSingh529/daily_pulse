
'use client';

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { addDoc, collection, Timestamp, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RAEntry, UserProfile } from '@/lib/types';


const raEntryFormSchema = z.object({
  date: z.date({ required_error: "A date for the entry is required." }),
  oowConsumed: z.coerce.number().min(0, "Amount must be a positive number."),
  oowCollected: z.coerce.number().min(0, "Amount must be a positive number."),
  userId: z.string().optional(),
});

type RAEntryFormValues = z.infer<typeof raEntryFormSchema>;

const defaultValues: Partial<RAEntryFormValues> = {
  oowConsumed: 0,
  oowCollected: 0,
};

export default function RAEntryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [entries, setEntries] = React.useState<RAEntry[]>([]);
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  
  React.useEffect(() => {
    if (!loading && user?.role !== 'Admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  React.useEffect(() => {
    if (user?.role === 'Admin') {
      const q = query(collection(db, 'ra_entries'), orderBy('date', 'desc'));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const entriesData: RAEntry[] = [];
        querySnapshot.forEach((doc) => {
          entriesData.push({ id: doc.id, ...doc.data() } as RAEntry);
        });
        setEntries(entriesData);
      });

      const usersQuery = query(collection(db, 'users'), where('role', 'in', ['ASM', 'RSM']));
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
            const usersData: UserProfile[] = [];
            snapshot.forEach(doc => usersData.push({ uid: doc.id, ...doc.data() } as UserProfile));
            setUsers(usersData);
        });

      return () => {
          unsubscribe();
          unsubscribeUsers();
      };
    }
  }, [user]);

  const form = useForm<RAEntryFormValues>({
    resolver: zodResolver(raEntryFormSchema),
    defaultValues,
  });

  async function onSubmit(data: RAEntryFormValues) {
    if (!user) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." });
        return;
    }
    setIsSubmitting(true);
    try {
        const newEntryData: Omit<RAEntry, 'id'> = {
            date: Timestamp.fromDate(data.date),
            oowConsumed: data.oowConsumed,
            oowCollected: data.oowCollected,
            submittedBy: user.uid,
            createdAt: Timestamp.now(),
        };

        if (data.userId && data.userId !== 'general') {
            const selectedUser = users.find(u => u.uid === data.userId);
            if (selectedUser) {
                newEntryData.userId = selectedUser.uid;
                newEntryData.userName = selectedUser.name;
                newEntryData.userRole = selectedUser.role;
            }
        }

        await addDoc(collection(db, "ra_entries"), newEntryData);

        toast({
            title: "RA Entry Submitted!",
            description: "The financial data has been recorded.",
        });
        form.reset();
    } catch (error) {
        console.error("Error submitting RA entry:", error);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: "There was an error submitting the entry. Please try again.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (loading || user?.role !== 'Admin') {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Submit RA Entry</CardTitle>
          <CardDescription>Enter the reconciled financial data for a specific day.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to User (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user for this entry" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="general">General / Unassigned</SelectItem>
                          {users.map(u => (
                              <SelectItem key={u.uid} value={u.uid}>{u.name} ({u.role})</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Assign this entry to a specific user or leave as General.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="oowConsumed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OOW Consumed by SCs (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="oowCollected"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verified OOW Collection (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isSubmitting ? 'Submitting...' : 'Submit Entry'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
            <CardTitle>Recent RA Entries</CardTitle>
            <CardDescription>A list of the most recent financial entries.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead className="text-right">Consumed</TableHead>
                        <TableHead className="text-right">Collected</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center">No entries found.</TableCell></TableRow>
                    ) : (
                        entries.slice(0, 10).map(entry => (
                            <TableRow key={entry.id}>
                                <TableCell>{(entry.date as Timestamp).toDate().toLocaleDateString()}</TableCell>
                                <TableCell>{entry.userName || 'General'}</TableCell>
                                <TableCell className="text-right">₹{entry.oowConsumed.toFixed(2)}</TableCell>
                                <TableCell className="text-right">₹{entry.oowCollected.toFixed(2)}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
