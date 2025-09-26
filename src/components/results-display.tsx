import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertCircle, Target, ShieldCheck } from "lucide-react";
import type { DemoResult } from "@/lib/demo-data";


interface ResultsDisplayProps {
  result: DemoResult;
}

export function ResultsDisplay({ result }: ResultsDisplayProps) {

  if (result.error) {
    return (
      <div className="mt-12 animate-in fade-in-50 duration-500">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Analysis Error</AlertTitle>
          <AlertDescription>
            <p className="font-semibold mb-2">The analysis could not be completed. Here is the technical reason:</p>
            <pre className="text-xs whitespace-pre-wrap bg-destructive-foreground/10 p-2 rounded-md font-mono">
              {result.error}
            </pre>
          </AlertDescription>
        </Alert>
      </div>
    );
  }


  const isHighRisk = result.riskAssessment.toLowerCase().includes("high");
  const isMediumRisk = result.riskAssessment.toLowerCase().includes("medium");
  const isLowRisk = result.riskAssessment.toLowerCase().includes("low");

  const getRiskVariant = () => {
    if (isHighRisk) return "destructive";
    if (isMediumRisk) return "secondary";
    return "default";
  }
  
  const getRiskColor = () => {
    if (isHighRisk) return "text-destructive";
    if (isMediumRisk) return "text-yellow-600 dark:text-yellow-400";
    if (isLowRisk) return "text-primary";
    return "text-foreground";
  }

  return (
    <div className="mt-12 animate-in fade-in-50 duration-500">
      <Card className="border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">
            Analysis Results for {result.patientName}
          </CardTitle>
          <CardDescription>This is a simulated result for demonstration purposes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 text-center">
          <div className="flex flex-col md:flex-row justify-around items-center gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Diagnosis
              </p>
              <Badge
                variant="outline"
                className="text-lg px-3 py-1"
              >
                {result.cancerType}
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Risk Assessment
              </p>
              <Badge
                variant={getRiskVariant()}
                className="text-lg px-4 py-1"
              >
                {result.riskAssessment}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-4 text-left">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-500"/>
                  <p className="text-md font-medium text-muted-foreground">
                    Sensitivity
                  </p>
              </div>
              <div className="flex items-center justify-start gap-4">
                <Progress
                  value={result.sensitivity * 100}
                  className="w-full h-3"
                  indicatorClassName="bg-blue-500"
                />
                <span className="font-bold text-lg tabular-nums text-blue-500">
                  {(result.sensitivity * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">The model's ability to correctly identify true positive cases.</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-500"/>
                  <p className="text-md font-medium text-muted-foreground">
                    Specificity
                  </p>
              </div>
              <div className="flex items-center justify-start gap-4">
                <Progress
                  value={result.specificity * 100}
                  className="w-full h-3"
                  indicatorClassName="bg-green-500"
                />
                <span className="font-bold text-lg tabular-nums text-green-500">
                  {(result.specificity * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">The model's ability to correctly identify true negative cases.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Re-exporting the type for use in analysis-form
export type { DemoResult } from "@/lib/demo-data";
