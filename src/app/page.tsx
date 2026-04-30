import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, GraduationCap, FileCheck, Layers } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-headline font-bold text-primary tracking-tight">Academia Flow</h1>
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl font-headline font-bold leading-tight">
              Enterprise Academic Management for <span className="text-accent">NEP 2020</span>.
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg">
              A robust platform for technical universities to manage schemes, syllabi, 
              and AICTE compliance with advanced RBAC and audit tracking.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <FeatureCard 
              icon={<GraduationCap className="text-accent" />}
              title="Scheme Lifecycle"
              desc="Draft to Approval workflow"
            />
            <FeatureCard 
              icon={<FileCheck className="text-accent" />}
              title="AICTE Compliant"
              desc="Automatic credit validation"
            />
            <FeatureCard 
              icon={<Layers className="text-accent" />}
              title="Equivalence Engine"
              desc="Manage transition mappings"
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-accent" />}
              title="RBAC & Audit"
              desc="Secure hierarchy & logs"
            />
          </div>
        </div>

        <div className="flex justify-center">
          <Card className="w-full max-w-md shadow-2xl border-primary/10">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center font-headline">Secure Login</CardTitle>
              <CardDescription className="text-center">
                Enter your university credentials to access the AMS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="dean@university.edu" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" />
              </div>
              <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all">
                <Link href="/dashboard">Sign In</Link>
              </Button>
              <div className="text-center text-sm text-muted-foreground pt-4">
                Forgot password? Contact system administrator.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-2">{icon}</div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
