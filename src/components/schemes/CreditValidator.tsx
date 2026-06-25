
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
    CPF: number;
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
  
  const isDscValid = currentCredits.DSC >= rules.dscMin && currentCredits.DSC <= rules.dscMax;
  const isDseValid = currentCredits.DSE >= (rules.dseMin || 8) && currentCredits.DSE <= (rules.dseMax || 16);
  const isOfeValid = currentCredits.OFE >= (rules.ofeMin || 12) && currentCredits.OFE <= (rules.ofeMax || 24);
  const isElectiveValid = electiveTotal >= (rules.electiveMin || 24) && electiveTotal <= (rules.electiveMax || 32);
  const isProjectValid = currentCredits.PRJ >= (rules.projectMin || 16) && currentCredits.PRJ <= (rules.projectMax || 32);
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
        <CreditSection 
          label="DSC (Core)" 
          current={currentCredits.DSC} 
          min={rules.dscMin} 
          max={rules.dscMax} 
          isValid={isDscValid} 
        />

        <CreditSection 
          label="DSE (Discipline Elective)" 
          current={currentCredits.DSE} 
          min={rules.dseMin || 8} 
          max={rules.dseMax || 16} 
          isValid={isDseValid} 
        />

        <CreditSection 
          label="Open Elective (OFE)" 
          current={currentCredits.OFE} 
          min={rules.ofeMin || 12} 
          max={rules.ofeMax || 24} 
          isValid={isOfeValid} 
        />

        <CreditSection 
          label="Total Electives (DSE + OFE)" 
          current={electiveTotal} 
          min={rules.electiveMin || 24} 
          max={rules.electiveMax || 32} 
          isValid={isElectiveValid} 
        />

        <CreditSection 
          label="Project/Internship" 
          current={currentCredits.PRJ} 
          min={rules.projectMin || 16} 
          max={rules.projectMax || 32} 
          isValid={isProjectValid} 
        />

        <div className="grid grid-cols-2 gap-4">
          <CompactCheck label="VAC" current={currentCredits.VAC} target={rules.vacTotal || 8} isValid={isVacValid} />
          <CompactCheck label="AEC" current={currentCredits.AEC} target={rules.aecTotal || 8} isValid={isAecValid} />
          <CompactCheck label="SEC" current={currentCredits.SEC} target={rules.secTotal || 8} isValid={isSecValid} />
          <CompactCheck label="MDC" current={currentCredits.MDC} target={rules.mdcTotal || 8} isValid={isMdcValid} />
        </div>

        {!isTotalValid && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 text-amber-800 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>The total credits must equal exactly {rules.totalRequired} for degree eligibility.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreditSection({ label, current, min, max, isValid }: any) {
  const percentage = Math.min((current / max) * 100, 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium flex items-center gap-2">
          {label}
          {isValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Info className="w-4 h-4 text-amber-500" />}
        </span>
        <span className="text-muted-foreground">{current} / {min}-{max}</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}

function CompactCheck({ label, current, target, isValid }: any) {
  return (
    <div className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 ${isValid ? 'bg-green-50 border-green-100' : 'bg-muted/30 border-border'}`}>
      <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-bold ${isValid ? 'text-green-700' : 'text-foreground'}`}>{current}/{target}</span>
        {isValid ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <div className="w-3 h-3 rounded-full border border-dashed border-muted-foreground/50" />}
      </div>
    </div>
  );
}
