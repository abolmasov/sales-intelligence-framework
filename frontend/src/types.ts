export interface Stakeholder {
  name: string;
  title: string;
  focusArea: string;
}

export interface CaseStudy {
  title: string;
  industry: string;
  technologies: string[];
  description: string;
  url: string;
  relevanceScore: number;
}

export interface SharePointDocument {
  id: string;
  name: string;
  webUrl: string;
  size?: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  mimeType?: string;
  contentType: string;
  isFolder?: boolean;
  path: string;
  displayName: string;
  relevanceScore?: number;
}

export interface SalesIntelligenceData {
  companyName: string;
  executiveSummary: string;
  financialPerformance: string;
  leadershipOrganization: string;
  strategicInitiatives: string;
  challengesPainPoints: string;
  marketPosition: string;
  salesOpportunities: string;
  riskFactors: string;
  keyStakeholders: Stakeholder[];
  recommendedApproach: string;
  integratorCaseStudies: CaseStudy[];
  libraryCaseStudies: CaseStudy[];
  sharepointDocuments?: SharePointDocument[];
  confidenceScore: number;
  citations: string[];
}

export interface ResearchNodeProgress {
  external_research: 'pending' | 'running' | 'completed';
  integrator_cases: 'pending' | 'running' | 'completed';
  library_cases: 'pending' | 'running' | 'completed';
  report_generation: 'pending' | 'running' | 'completed';
}