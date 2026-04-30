"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { CREDIT_RULES } from "@/lib/mock-data";

interface CreditValidatorProps {
  currentCredits: {
    DSC: number;
    DSE: number;
    OFE: number;
    CPF: number;
    total: number;
  };
}

export function CreditValidator({ currentCredits }: CreditValidatorProps) {
  const rules = CREDIT_RULES.UG;
  
  const dseOfeTotal = currentCredits.DSE + currentCredits.OFE;
  const isDscValid = currentCredits.DSC >= rules.categories.DSC.min && currentCredits.DSC <= rules.categories.DSC.max;
  const isDseOfeValid = dseOfeTotal >= rules.categories.DSE_OFE.min && dseOfeTotal <= rules.categories.DSE_OFE.max;
  const isCpfValid = currentCredits.CPF === rules.categories.CPF.total;
  const isTotalValid = currentCredits.total === rules.total;

  return (
    <Card className="shadow-sm border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-headline flex items-center gap-2">
          Credit Compliance Tracker
          <Badge variant="outline" className={isTotalValid ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
            {currentCredits.total} / {rules.total} Credits
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <div className="space-y-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium flex items-center gap-2">
              DSC & Experiential
              {isDscValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Info className="w-4 h-4 text-amber-500" />}
            </span>
            <span className="text-muted-foreground">{currentCredits.DSC} / {rules.categories.DSC.min}-{rules.categories.DSC.max}</span>
          </div>
          <Progress value={(currentCredits.DSC / rules.categories.DSC.max) * 100} className="h-2" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium flex items-center gap-2">
              Electives (DSE + OFE)
              {isDseOfeValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Info className="w-4 h-4 text-amber-500" />}
            </span>
            <span className="text-muted-foreground">{dseOfeTotal} / {rules.categories.DSE_OFE.min}-{rules.categories.DSE_OFE.max}</span>
          </div>
          <Progress value={(dseOfeTotal / rules.categories.DSE_OFE.max) * 100} className="h-2" />
          <div className="flex gap-4 pt-1">
             <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">DSE</span>
                <span className="text-xs font-bold">{currentCredits.DSE} Credits</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">OFE</span>
                <span className="text-xs font-bold">{currentCredits.OFE} Credits</span>
             </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium flex items-center gap-2">
              Common Pool (CPF)
              {isCpfValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Info className="w-4 h-4 text-amber-500" />}
            </span>
            <span className="text-muted-foreground">{currentCredits.CPF} / {rules.categories.CPF.total}</span>
          </div>
          <Progress value={(currentCredits.CPF / rules.categories.CPF.total) * 100} className="h-2" />
        </div>

        {!isTotalValid && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 text-amber-800 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>The total credits must equal exactly {rules.total} for degree eligibility. Please adjust your scheme distribution.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
