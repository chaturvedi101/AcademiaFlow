
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

  const isDscValid = currentCredits.DSC >= rules.dscMin && currentCredits.DSC <= rules.dscMax;
  const isDseValid = currentCredits.DSE >= rules.dseMin && currentCredits.DSE <= rules.dseMax;
  const isOfeValid = currentCredits.OFE >= rules.ofeMin && currentCredits.OFE <= rules.ofeMax;
  const isProjectValid = currentCredits.PRJ >= (rules.projectMin || 16) && currentCredits.PRJ <= (rules.projectMax || 32);
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
          label="DSE (Electives)" 
          current={currentCredits.DSE} 
          min={rules.dseMin} 
          max={rules.dseMax} 
          isValid={isDseValid} 
        />

        <CreditSection 
          label="OFE (Open Electives)" 
          current={currentCredits.OFE} 
          min={rules.ofeMin} 
          max={rules.ofeMax} 
          isValid={isOfeValid} 
        />

        <CreditSection 
          label="Project/Internship" 
          current={currentCredits.PRJ} 
          min={rules.projectMin || 16} 
          max={rules.projectMax || 32} 
          isValid={isProjectValid} 
        />

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span>Institutional & Experiential</span>
            <span>{currentCredits.total - (currentCredits.DSC + currentCredits.DSE + currentCredits.OFE + currentCredits.PRJ)} Credits</span>
          </div>
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
