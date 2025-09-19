import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { AnalyzeMedicalDataForRiskOutput } from "@/ai/flows/analyze-medical-data-for-risk";

interface ResultsDisplayProps {
  result: AnalyzeMedicalDataForRiskOutput;
}

export function ResultsDisplay({ result }: ResultsDisplayProps) {
  const isHighRisk = result.riskAssessment.toLowerCase().includes("high");
  const confidenceValue = result.confidenceScore * 100;

  return (
    <div className="mt-12 animate-in fade-in-50 duration-500">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-2xl text-center font-headline">
            Analysis Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Risk Assessment
            </p>
            <Badge
              variant={isHighRisk ? "destructive" : "default"}
              className="text-xl px-4 py-1"
            >
              {result.riskAssessment}
            </Badge>
          </div>
          <div className="space-y-2">
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
