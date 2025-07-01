
'use client';

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, PlusCircle, Trash2 } from "lucide-react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { PJP, Region } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const regions: Region[] = ['North', 'South', 'East', 'West', 'HQ'];

const pjpFormSchema = z.object({
  region: z.enum(regions, { required_error: "You must select a region for this plan." }),
  plans: z.array(
    z.object({
      planDate: z.date({ required_error: "A date is required." }),
      scName: z.string().min(1, "SC Name cannot be empty."),
      remarks: z.string().optional(),
    })
  ).min(1, "You must add at least one plan entry."),
});

type PJPFormValues = z.infer<typeof pjpFormSchema>;

export default function SubmitPJPPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PJPFormValues>({
    resolver: zodResolver(pjpFormSchema),
    defaultValues: {
      plans: [{ planDate: new Date(), scName: "", remarks: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "plans",
  });
  
  React.useEffect(() => {
    if (user?.regions?.length === 1) {
      form.setValue('region', user.regions[0]);
    }
  }, [user, form]);


  async function onSubmit(data: PJPFormValues) {
    if (!user) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in." });
        return;
    }
    setIsSubmitting(true);
    try {
      const submissionPromises = data.plans.map(plan => {
        const newPJPData: Omit<PJP, 'id'> = {
            ...plan,
            planDate: Timestamp.fromDate(plan.planDate),
            userId: user.uid,
            userName: user.name!,
            userRegion: data.region,
            createdAt: Timestamp.now(),
        };
        return addDoc(collection(db, "pjp_plans"), newPJPData);
      });

      await Promise.all(submissionPromises);

      toast({
          title: "PJP Submitted!",
          description: "Your plan has been successfully submitted.",
      });
      form.reset({
        plans: [{ planDate: new Date(), scName: "", remarks: "" }]
      });
      router.push('/dashboard/pjp');
    } catch (error) {
        console.error("Error submitting PJP:", error);
        toast({
            variant: "destructive",
            title: "Submission Failed",
            description: "There was an error submitting your plan. Please try again.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Personal Journey Plan (PJP)</CardTitle>
        <CardDescription>Add your planned visits. If you manage multiple regions, select the correct region for this set of plans.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {user?.regions && user.regions.length > 1 && (
                 <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                        <FormItem className="max-w-xs">
                        <FormLabel>Region for this Plan</FormLabel>
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
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}
            
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-7 gap-4 items-start p-4 border rounded-lg relative">
                    <FormField
                      control={form.control}
                      name={`plans.${index}.planDate`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col col-span-2">
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
                        name={`plans.${index}.scName`}
                        render={({ field }) => (
                            <FormItem className="col-span-2">
                                <FormLabel>SC Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Service Center Name" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField
                        control={form.control}
                        name={`plans.${index}.remarks`}
                        render={({ field }) => (
                            <FormItem className="col-span-2">
                                <FormLabel>Remarks</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Purpose of visit..." {...field} rows={1} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                   <div className="col-span-1 flex items-end h-full">
                     <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove</span>
                    </Button>
                   </div>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-4">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ planDate: new Date(), scName: "", remarks: "" })}
                >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Another Visit
                </Button>

                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isSubmitting ? 'Submitting...' : 'Submit Plan'}
                </Button>
            </div>
             <FormMessage>{form.formState.errors.plans?.message}</FormMessage>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}