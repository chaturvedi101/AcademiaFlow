
"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { CreditRules } from "@/lib/types";

interface CreditValidatorProps {
  currentCredits: {
    DSC: number;
    DSE: number;
    OFE: number;
    VAC: number;
    AEC: number;
    SEC: number;
    MDC: number;
    PRJ: number;
    total: number;
  };
  rules?: CreditRules;
}

export function CreditValidator({ currentCredits, rules }: CreditValidatorProps) {
  if (!rules) return null;

  const electiveTotal = currentCredits.DSE + currentCredits.OFE;
  const dscProjectTotal = currentCredits.DSC + currentCredits.PRJ;
  
  // Specific Institutional Checks
  const isDscIndividualValid = currentCredits.DSC >= (rules.dscMin || 0) && currentCredits.DSC <= (rules.dscMax || 200);
  const isProjectValid = currentCredits.PRJ >= (rules.projectMin || 16) && currentCredits.PRJ <= (rules.projectMax || 32);
  const isDscProjectAggregateValid = dscProjectTotal >= 96 && dscProjectTotal <= 104;

  const isDseValid = currentCredits.DSE >= (rules.dseMin || 8) && currentCredits.DSE <= (rules.dseMax || 16);
  const isOfeValid = currentCredits.OFE >= (rules.ofeMin || 12) && currentCredits.OFE <= (rules.ofeMax || 24);
  const isElectiveValid = electiveTotal >= (rules.electiveMin || 24) && electiveTotal <= (rules.electiveMax || 32);
  
  // Fixed institutional checks
  const isVacValid = currentCredits.VAC === (rules.vacTotal || 8);
  const isAecValid = currentCredits.AEC === (rules.aecTotal || 8);
  const isSecValid = currentCredits.SEC === (rules.secTotal || 8);
  const isMdcValid = currentCredits.MDC === (rules.mdcTotal || 8);
  const isTotalValid = currentCredits.total === rules.totalRequired;

  return (
    <Card className="shadow-sm border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-headline flex items-center gap-2">
          Credit Compliance Tracker
          <Badge variant="outline" className={isTotalValid ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
            {currentCredits.total} / {rules.totalRequired} Credits
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <div className="space-y-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
          <p className="text-[10px] font-bold uppercase text-primary tracking-widest">Core Requirements</p>
          <CreditSection 
            label="Individual DSC (Core)" 
            current={currentCredits.DSC} 
            min={rules.dscMin} 
            max={rules.dscMax} 
            isValid={isDscIndividualValid} 
          />
          <CreditSection 
            label="Individual Project (PRJ)" 
            current={currentCredits.PRJ} 
            min={rules.projectMin || 16} 
            max={rules.projectMax || 32} 
            isValid={isProjectValid} 
          />
          <CreditSection 
            label="Aggregate (DSC + PRJ)" 
            current={dscProjectTotal} 
            min={96} 
            max={104} 
            isValid={isDscProjectAggregateValid} 
          />
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Elective Pools</p>
          <div className="grid grid-cols-2 gap-4">
            <CreditSection 
              label="DSE (Elective)" 
              current={currentCredits.DSE} 
              min={rules.dseMin || 8} 
              max={rules.dseMax || 16} 
              isValid={isDseValid} 
            />
            <CreditSection 
              label="OFE (Open)" 
              current={currentCredits.OFE} 
              min={rules.ofeMin || 12} 
              max={rules.ofeMax || 24} 
              isValid={isOfeValid} 
            />
          </div>

          <CreditSection 
            label="Combined Electives (DSE+OFE)" 
            current={electiveTotal} 
            min={rules.electiveMin || 24} 
            max={rules.electiveMax || 32} 
            isValid={isElectiveValid} 
          />
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Institutional Targets (Fixed 8 Cr)</p>
          <div className="grid grid-cols-2 gap-3">
            <CompactCheck label="VAC" current={currentCredits.VAC} target={rules.vacTotal || 8} isValid={isVacValid} />
            <CompactCheck label="AEC" current={currentCredits.AEC} target={rules.aecTotal || 8} isValid={isAecValid} />
            <CompactCheck label="SEC" current={currentCredits.SEC} target={rules.secTotal || 8} isValid={isSecValid} />
            <CompactCheck label="MDC" current={currentCredits.MDC} target={rules.mdcTotal || 8} isValid={isMdcValid} />
          </div>
        </div>

        {!isTotalValid && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 text-amber-800 text-[11px] leading-tight">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Total credits must be exactly {rules.totalRequired}. Ensure DSC+PRJ aggregate is 96-104 and all institutional targets are met.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreditSection({ label, current, min, max, isValid }: any) {
  const percentage = Math.min((current / (max || 1)) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="font-semibold flex items-center gap-1.5">
          {label}
          {isValid ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Info className="w-3.5 h-3.5 text-amber-500" />}
        </span>
        <span className="text-muted-foreground font-mono">{current} / {min}-{max}</span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  );
}

function CompactCheck({ label, current, target, isValid }: any) {
  return (
    <div className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${isValid ? 'bg-green-50 border-green-100' : 'bg-muted/30 border-border'}`}>
      <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-tighter">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-bold ${isValid ? 'text-green-700' : 'text-foreground'}`}>{current}/{target}</span>
        {isValid ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <div className="w-3 h-3 rounded-full border border-dashed border-muted-foreground/30" />}
      </div>
    </div>
  );
}
