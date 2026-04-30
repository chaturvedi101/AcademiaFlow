import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Academic Overview</h1>
        <p className="text-muted-foreground">Welcome back, Convenor. Here is what is happening across your programs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Active Schemes" 
          value="12" 
          trend="+2 this month" 
          icon={<FileText className="text-primary" />} 
        />
        <StatsCard 
          title="Pending Approval" 
          value="4" 
          trend="2 overdue" 
          icon={<Clock className="text-accent" />} 
          variant="warning"
        />
        <StatsCard 
          title="Approved Syllabi" 
          value="248" 
          trend="8 new additions" 
          icon={<CheckCircle2 className="text-green-500" />} 
        />
        <StatsCard 
          title="Audit Alerts" 
          value="0" 
          trend="System healthy" 
          icon={<AlertCircle className="text-muted-foreground" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Recent Schemes</CardTitle>
              <CardDescription>Latest academic schemes in draft or pending status.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/schemes">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <SchemeRow 
                name="B.Tech Computer Science" 
                batch="2024-28" 
                status="Draft" 
                updated="2h ago" 
              />
              <SchemeRow 
                name="MBA Finance" 
                batch="2024-26" 
                status="Pending Dean" 
                updated="1d ago" 
              />
              <SchemeRow 
                name="B.Tech Civil Engineering" 
                batch="2024-28" 
                status="Approved" 
                updated="3d ago" 
              />
              <SchemeRow 
                name="M.Tech Data Science" 
                batch="2024-26" 
                status="Pending Academics" 
                updated="5d ago" 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline">Quick Actions</CardTitle>
            <CardDescription>Frequent administrative tasks.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ActionLink href="/dashboard/schemes/new" label="New Scheme Layout" />
            <ActionLink href="/dashboard/equivalence" label="Equivalence Mapping" />
            <ActionLink href="/dashboard/reports" label="Accreditation Reports" />
            <ActionLink href="/dashboard/programs" label="Program Catalog" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({ title, value, trend, icon, variant = 'default' }: any) {
  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden relative group">
      <div className={`absolute top-0 left-0 w-1 h-full ${variant === 'warning' ? 'bg-accent' : 'bg-primary'}`}></div>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 rounded-lg bg-muted group-hover:bg-muted/80 transition-colors">
            {icon}
          </div>
          <span className="text-xs font-medium text-muted-foreground">{trend}</span>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold font-headline">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SchemeRow({ name, batch, status, updated }: any) {
  const statusColors: any = {
    'Draft': 'bg-slate-100 text-slate-700',
    'Pending Dean': 'bg-amber-100 text-amber-700',
    'Pending Academics': 'bg-blue-100 text-blue-700',
    'Approved': 'bg-emerald-100 text-emerald-700'
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
      <div className="space-y-1">
        <p className="font-medium">{name}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Batch: {batch}</span>
          <span className="w-1 h-1 rounded-full bg-border"></span>
          <span>Updated {updated}</span>
        </div>
      </div>
      <Badge variant="outline" className={`${statusColors[status]} border-none font-medium`}>
        {status}
      </Badge>
    </div>
  );
}

function ActionLink({ href, label }: { href: string, label: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-primary hover:text-white group transition-all"
    >
      <span className="text-sm font-medium">{label}</span>
      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
