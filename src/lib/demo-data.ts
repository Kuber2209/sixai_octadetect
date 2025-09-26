export type DemoResult = {
  patientName: string;
  cancerType: string;
  riskAssessment: 'Low Risk' | 'Medium Risk' | 'High Risk';
  sensitivity: number;
  specificity: number;
  error?: string;
};

export const DEMO_RESULTS: DemoResult[] = [
  {
    patientName: 'John Doe',
    cancerType: 'Oral Cancer',
    riskAssessment: 'High Risk',
    sensitivity: 0.98,
    specificity: 0.99,
  },
  {
    patientName: 'Jane Smith',
    cancerType: 'Oral Cancer',
    riskAssessment: 'High Risk',
    sensitivity: 0.99,
    specificity: 0.98,
  },
  {
    patientName: 'Robert Johnson',
    cancerType: 'Oral Cancer',
    riskAssessment: 'High Risk',
    sensitivity: 0.99,
    specificity: 0.99,
  },
  {
    patientName: 'Emily Williams',
    cancerType: 'Oral Cancer',
    riskAssessment: 'High Risk',
    sensitivity: 0.98,
    specificity: 0.98,
  },
  {
    patientName: 'Michael Brown',
    cancerType: 'Oral Cancer',
    riskAssessment: 'High Risk',
    sensitivity: 0.99,
    specificity: 0.99,
  }
];
