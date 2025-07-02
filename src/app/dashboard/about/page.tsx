'use client';

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ArrowRight, ChevronRight, Globe, Mail, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function AboutPage() {
  const features = [
    {
      icon: <Activity className="w-5 h-5 text-primary" />,
      title: "Real-time Analytics",
      description: "Track performance metrics with live updates"
    },
    {
      icon: <Smartphone className="w-5 h-5 text-primary" />,
      title: "Mobile Friendly",
      description: "Access from any device, Anywhere"
    },
    {
      icon: <Globe className="w-5 h-5 text-primary" />,
      title: "Regional Coverage",
      description: "Manage multiple regions seamlessly"
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4 sm:p-6">
      <div className="w-full max-w-4xl space-y-8">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-3xl bg-primary/10 -rotate-6"></div>
            <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl bg-primary/5 backdrop-blur-sm border border-primary/10">
              <Activity className="w-12 h-12 text-primary" />
            </div>
          </div>
          
          <CardTitle className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Daily Pulse
          </CardTitle>

          <CardDescription className="mt-3 text-lg text-muted-foreground">
            Simplified reporting and management for regional teams
          </CardDescription>
        </div>

        {/* Features Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((feature, index) => (
            <Card key={index} className="overflow-hidden rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {feature.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardDescription className="px-6 pb-4 text-sm">
                {feature.description}
              </CardDescription>
            </Card>
          ))}
        </div>

        {/* Description Card */}
        <Card className="overflow-hidden rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50">
          <CardHeader>
            <CardTitle className="text-xl">About Daily Pulse</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4 space-y-4">
            <p className="text-muted-foreground">
              Daily Pulse is a comprehensive internal tool designed to streamline daily reporting, 
              team management, and performance analysis. It empowers regional teams to stay connected, 
              track progress, and drive success with real-time data and insights, all in one centralized platform.
            </p>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">harpinder.singh@rvsolutions.in</span>
              </div>
              <Button variant="ghost" size="sm" className="text-primary">
                Learn more <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <CardFooter className="flex flex-col items-center justify-center p-6 rounded-2xl bg-muted/50 border border-neutral-200/70 dark:border-neutral-700/50">
          <p className="text-sm font-medium text-muted-foreground text-center">
            Engineered with care in the CEO Office's lab
          </p>
          <Badge variant="secondary" className="mt-2 px-3 py-1 rounded-full text-primary bg-primary/10 border-primary/10">
            Harpinder Singh
          </Badge>
        </CardFooter>
      </div>
    </div>
  );
}