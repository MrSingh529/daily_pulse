
'use client';

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { Report, Region } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const regions: Region[] = ['North', 'South', 'East', 'West', 'HQ'];

const reportFormSchema = z.object({
  date: z.date({ required_error: "A date for the report is required." }),
  region: z.enum(regions, { required_error: "Region is required." }),
  ascName: z.string().min(2, { message: "ASC Name must be at least 2 characters." }),
  outstandingAmount: z.coerce.number().min(0, "Amount must be a positive number."),
  oowCollection: z.coerce.number().min(0, "Amount must be a positive number."),
  goodInventoryRealme: z.coerce.number().int().min(0, "Quantity must be a positive number."),
  defectiveInventoryRealme: z.coerce.number().int().min(0, "Quantity must be a positive number."),
  realmeAgreementDispatch: z.coerce.number().int().min(0, "Quantity must be a positive number."),
  realmeSdCollection: z.coerce.number().min(0, "Amount must be a positive number."),
  multibrandStnDispatched: z.coerce.number().int().min(0, "Quantity must be a positive number."),
  multibrandPendingStns: z.coerce.number().int().min(0, "Quantity must be a positive number."),
  remarks: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

const defaultValues: Partial<ReportFormValues> = {
  ascName: "",
  outstandingAmount: 0,
  oowCollection: 0,
  goodInventoryRealme: 0,
  defectiveInventoryRealme: 0,
  realmeAgreementDispatch: 0,
  realmeSdCollection: 0,
  multibrandStnDispatched: 0,
  multibrandPendingStns: 0,
  remarks: "",
};

export default function SubmitReportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (user?.regions?.length === 1) {
      form.setValue('region', user.regions[0]);
    }
  }, [user, form]);

  async function onSubmit(data: ReportFormValues) {
    if (!user) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to submit a report." });
        return;
    }
    setIsSubmitting(true);
    try {
        const { remarks, region, ...restOfData } = data;

        const newReportData: Omit<Report, 'id'> = {
            ...restOfData,
            date: Timestamp.fromDate(data.date),
            submittedBy: user.uid,
            submittedByName: user.name!,
            submittedByRole: user.role!,
            submittedByRegion: region,
            remarks: [],
        };

        if (remarks && remarks.trim() !== '') {
            newReportData.remarks = [{
                text: remarks,
                byName: user.name!,
                byId: user.uid,
                date: Timestamp.now(),
            }];
        }

        await addDoc(collection(db, "reports"), newReportData);

        toast({
            title: "Report Submitted!",
            description: "Your report has been successfully submitted.",
        });
        form.reset();
        router.push('/dashboard/reports');
    } catch (error) {
        console.error("Error submitting report:", error);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: "There was an error submitting your report. Please try again.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit New Report</CardTitle>
        <CardDescription>Fill out the form below to submit a new daily report.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid md:grid-cols-3 gap-8">
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
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
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
                          disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
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
                name="ascName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visited ASC Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., TechFix Central" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {user?.regions && user.regions.length > 1 && (
                <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Region</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a region" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {user.regions?.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormDescription>
                            Select the region this report is for.
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <FormField
                control={form.control}
                name="outstandingAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Remaining Outstanding Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="oowCollection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OOW Collection Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <FormField
                control={form.control}
                name="goodInventoryRealme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Good Inventory QTY Shipped to Realme</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defectiveInventoryRealme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Defective Inventory QTY Shipped to Realme</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <FormField
                control={form.control}
                name="realmeSdCollection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Realme SD Collection Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="multibrandStnDispatched"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Multibrand Spare’s STNs Dispatched to RV WH</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
               <FormField
                control={form.control}
                name="multibrandPendingStns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pending STNs QTY of Multibrand Spares (3+ Days)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="realmeAgreementDispatch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>After Sign Off Realme Agreement Dispatch to HO (QTY)</FormLabel>
                    <FormControl>
                       <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add any initial comments or remarks for this report..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}