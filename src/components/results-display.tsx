import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { PredictCancerRiskOutput } from "@/ai/flows/predict-cancer-risk";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertCircle } from "lucide-react";

interface ResultsDisplayProps {
  result: PredictCancerRiskOutput;
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
  const confidenceValue = result.confidenceScore * 100;

  const getRiskVariant = () => {
    if (isHighRisk) return "destructive";
    if (isMediumRisk) return "secondary";
    return "default";
  }

  return (
    <div className="mt-12 animate-in fade-in-50 duration-500">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl text-center font-headline">
            Analysis Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Cancer Type
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
          <div className="space-y-2 pt-4">
            <p className="text-sm font-medium text-muted-foreground">
              Confidence Score
            </p>
            <div className="flex items-center justify-center gap-4">
              <Progress
                value={confidenceValue}
                className="w-3/4 mx-auto h-3"
              />
              <span className="font-bold text-lg tabular-nums">
                {confidenceValue.toFixed(0)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
