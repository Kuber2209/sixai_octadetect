export type DemoResult = {
  patientName: string;
  cancerType: string;
  riskAssessment: 'Low Risk' | 'Medium Risk' | 'High Risk';
  sensitivity: number;
  specificity: number;
  diagnosisDetail: string;
  error?: string;
};

export const DEMO_RESULTS: DemoResult[] = [
  {
    patientName: 'John Doe',
    cancerType: 'Oral Squamous Cell Carcinoma',
    riskAssessment: 'High Risk',
    sensitivity: 0.98,
    specificity: 0.99,
    diagnosisDetail: 'Analysis indicates atypical squamous cells with features highly suggestive of malignancy. Irregular cell clusters and high nucleus-to-cytoplasm ratio observed.',
  },
  {
    patientName: 'Jane Smith',
    cancerType: 'Cervical Intraepithelial Neoplasia (CIN 2)',
    riskAssessment: 'Medium Risk',
    sensitivity: 0.99,
    specificity: 0.98,
    diagnosisDetail: 'Moderate dysplasia detected. Abnormal cell growth is confined to the basal two-thirds of the epithelium. Close monitoring and follow-up are recommended.',
  },
  {
    patientName: 'Robert Johnson',
    cancerType: 'Benign Leukoplakia',
    riskAssessment: 'Low Risk',
    sensitivity: 0.99,
    specificity: 0.99,
    diagnosisDetail: 'Image analysis shows thickened epithelial tissue, consistent with benign hyperkeratosis. No signs of malignant transformation are currently visible.',
  },
  {
    patientName: 'Emily Williams',
    cancerType: 'Oral Melanoma',
    riskAssessment: 'High Risk',
    sensitivity: 0.98,
    specificity: 0.98,
    diagnosisDetail: 'Atypical melanocytes with irregular pigmentation and morphology are present. The pattern is highly indicative of a malignant melanoma.',
  },
  {
    patientName: 'Michael Brown',
    cancerType: 'HPV-Negative Cells',
    riskAssessment: 'Low Risk',
    sensitivity: 0.99,
    specificity: 0.99,
    diagnosisDetail: 'The cellular morphology appears normal and consistent with healthy epithelial tissue. No dysplastic changes or viral cytopathic effects were detected.',
  }
];
