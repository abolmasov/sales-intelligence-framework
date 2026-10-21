import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiGet, apiPost, apiPostForm, apiDelete } from '../utils/api';

type AnalysisType = 'quick' | 'enhanced';

// RFP Research Types
export interface RFPQuestion {
  id: string;
  questionText: string;
  category: 'technical' | 'business' | 'compliance' | 'timeline' | 'pricing' | 'general';
  section?: string;
  originalContext?: string;
  /** Main keywords extracted from the question */
  keywords: string[];
  /** Brief summary of what the question is asking about */
  summary: string;
}

export interface AnswerSource {
  type: 'internal-kb' | 'case_study';
  title: string;
  excerpt: string;
  url?: string;
  relevanceScore?: number;
}

export interface RFPAnswer {
  questionId: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  sources: AnswerSource[];
}

export interface RFPResearchResult {
  rfpSummary: string;
  companyName?: string;
  questions: RFPQuestion[];
  answers: RFPAnswer[];
  metadata: {
    totalQuestions: number;
    answeredQuestions: number;
    averageConfidence: number;
    processingTimeMs: number;
    fileName?: string;
    sheetProcessed?: string;
  };
  // Excel-specific data
  columnMapping?: {
    questionColumn: number | null;
    answerColumn: number | null;
    headers: string[];
  };
  answeredExcel?: string | null; // Base64 encoded Excel file
  isExcel?: boolean;
}

// Log entry for RFP research progress
export interface RFPLogEntry {
  timestamp: Date | string;
  level: 'info' | 'success' | 'warning' | 'error' | 'progress';
  stage: 'upload' | 'extraction' | 'knowledge_search' | 'answer_generation' | 'complete';
  message: string;
  details?: any;
}

// RFP Research History Types
export interface RFPResearchHistoryItem {
  researchId: string;
  fileName?: string | null;
  fileType?: string | null;
  companyName?: string | null;
  rfpSummary?: string | null;
  totalQuestions: number;
  answeredQuestions: number;
  averageConfidence: number;
  processingTimeMs: number;
  status: string;
  createdAt: string;
  customPrompt?: string | null;
  isSaved?: boolean;
}

export interface RFPResearchDetail extends RFPResearchHistoryItem {
  questions: RFPQuestion[];
  answers: RFPAnswer[];
  requestedBy?: string | null;
  updatedAt: string;
}

export type ProposalJobStatus = 'processing' | 'completed' | 'error' | 'cancelled';

export interface ProposalJobSummary {
  jobId: string;
  analysisType: string;
  status: ProposalJobStatus;
  currentStep?: string | null;
  requestedBy?: string | null;
  meetingId?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  metadata?: Record<string, any> | null;
  rfpSummary?: string | null;
  errorMessage?: string | null;
  linkedDealId?: string | null;
  linkedDealName?: string | null;
  linkedAccountName?: string | null;
}

export interface ProposalJobDetail extends ProposalJobSummary {
  proposalData?: any;
}

interface ProposalState {
  selectedFile: File | null;
  loading: boolean;
  analysisType: AnalysisType | null;
  error: string | null;

  jobs: ProposalJobSummary[];
  jobsLoading: boolean;
  jobDetailLoading: boolean;
  selectedJobId: string | null;
  selectedJob: ProposalJobDetail | null;

  // RFP Research state
  rfpResearchResult: RFPResearchResult | null;
  rfpResearchLoading: boolean;
  rfpResearchError: string | null;
  rfpResearchLogs: RFPLogEntry[];

  // RFP Research History state
  rfpResearchHistory: RFPResearchHistoryItem[];
  rfpResearchHistoryLoading: boolean;
  selectedResearchId: string | null;
  selectedResearch: RFPResearchDetail | null;
  selectedResearchLoading: boolean;

  setSelectedFile: (file: File | null) => void;
  setError: (message: string | null) => void;
  clearSelectedJob: () => void;
  fetchJobs: () => Promise<void>;
  fetchJobDetail: (jobId: string) => Promise<void>;
  createJob: (analysisType: AnalysisType, options?: { meetingId?: string }) => Promise<{ jobId: string } | null>;

  // RFP Research actions
  startRFPResearch: (file: File, customPrompt?: string) => Promise<RFPResearchResult | null>;
  startRFPResearchWithLogs: (file: File, customPrompt?: string) => Promise<RFPResearchResult | null>;
  addRFPLog: (log: RFPLogEntry) => void;
  clearRFPResearch: () => void;

  // RFP Research History actions
  saveRFPResearch: (result: RFPResearchResult, fileName?: string, customPrompt?: string) => Promise<string | null>;
  fetchRFPResearchHistory: () => Promise<void>;
  fetchRFPResearchDetail: (researchId: string) => Promise<void>;
  deleteRFPResearch: (researchId: string) => Promise<boolean>;
  clearSelectedResearch: () => void;

  // Job management
  cancelJob: (jobId: string) => Promise<boolean>;
  deleteJob: (jobId: string) => Promise<boolean>;
}

const normalizeJob = (job: any): ProposalJobDetail => ({
  jobId: job.jobId,
  analysisType: job.analysisType,
  status: job.status,
  currentStep: job.currentStep,
  requestedBy: job.requestedBy,
  meetingId: job.meetingId || null,
  fileName: job.fileName,
  fileSize: job.fileSize,
  mimeType: job.mimeType,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  completedAt: job.completedAt,
  metadata: job.metadata || null,
  rfpSummary: job.rfpSummary,
  errorMessage: job.errorMessage,
  linkedDealId: job.linkedDealId || job.metadata?.linkedDealId || null,
  linkedDealName: job.linkedDealName || job.metadata?.linkedDealName || null,
  linkedAccountName: job.linkedAccountName || job.metadata?.linkedAccountName || null,
  proposalData: job.proposalData || null,
});

const serializeJobsResponse = (jobs: any[]): ProposalJobSummary[] =>
  (jobs || []).map((job) => normalizeJob(job));

export const useProposalStore = create<ProposalState>()(
  persist(
    (set, get) => ({
      selectedFile: null,
      loading: false,
      analysisType: null,
      error: null,

      jobs: [],
      jobsLoading: false,
      jobDetailLoading: false,
      selectedJobId: null,
      selectedJob: null,

      // RFP Research state
      rfpResearchResult: null,
      rfpResearchLoading: false,
      rfpResearchError: null,
      rfpResearchLogs: [],

      // RFP Research History state
      rfpResearchHistory: [],
      rfpResearchHistoryLoading: false,
      selectedResearchId: null,
      selectedResearch: null,
      selectedResearchLoading: false,

      setSelectedFile: (file) => set({ selectedFile: file }),
      setError: (message) => set({ error: message }),
      clearSelectedJob: () => set({ selectedJob: null, selectedJobId: null }),

      fetchJobs: async () => {
        set({ jobsLoading: true });
        try {
          const response = await apiGet('/api/proposal/jobs');
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to load jobs');
          }
          const jobs = serializeJobsResponse(response.data || []);
          set({ jobs, jobsLoading: false });

          const { selectedJobId } = get();
          if (selectedJobId && !jobs.some((job) => job.jobId === selectedJobId)) {
            set({ selectedJobId: null, selectedJob: null });
          }
        } catch (error) {
          console.error('Failed to fetch jobs', error);
          set({ jobsLoading: false, error: error instanceof Error ? error.message : 'Failed to load jobs' });
        }
      },

      fetchJobDetail: async (jobId: string) => {
        set({ jobDetailLoading: true, selectedJobId: jobId });
        try {
          const response = await apiGet(`/api/proposal/jobs/${jobId}`);
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to load job');
          }
          set({
            selectedJob: normalizeJob(response.data),
            jobDetailLoading: false,
          });
        } catch (error) {
          console.error('Failed to fetch job detail', error);
          set({
            jobDetailLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load job detail',
          });
        }
      },

      createJob: async (analysisType: AnalysisType, options?: { meetingId?: string }) => {
        const { selectedFile } = get();

        if (!selectedFile) {
          set({ error: 'Please select a file first.' });
          return null;
        }

        set({ loading: true, analysisType, error: null });

        try {
          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('analysisType', analysisType);
          if (options?.meetingId) {
            formData.append('meetingId', options.meetingId);
          }

          const response = await apiPostForm('/api/proposal/jobs', formData);
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to submit proposal job');
          }

          set({ selectedFile: null });
          await get().fetchJobs();
          return response.data || null;
        } catch (error) {
          console.error('Job submission failed', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to submit proposal job',
          });
          return null;
        } finally {
          set({ loading: false, analysisType: null });
        }
      },

      // RFP Research actions
      startRFPResearch: async (file: File, customPrompt?: string) => {
        set({ rfpResearchLoading: true, rfpResearchError: null, rfpResearchResult: null });

        try {
          const formData = new FormData();
          formData.append('file', file);
          if (customPrompt && customPrompt.trim()) {
            formData.append('customPrompt', customPrompt.trim());
          }

          // Check if file is Excel
          const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
          const endpoint = isExcel ? '/api/proposal/research-rfp-excel' : '/api/proposal/research-rfp';

          const response = await apiPostForm(endpoint, formData);

          if (!response?.success) {
            throw new Error(response?.error || 'Failed to research RFP');
          }

          // Transform Excel response to match RFPResearchResult format
          let result: RFPResearchResult;

          if (isExcel && response.data) {
            const excelData = response.data;
            result = {
              rfpSummary: `Excel RFP Analysis: ${excelData.metadata?.fileName || file.name}`,
              questions: (excelData.questions || []).map((q: any, idx: number) => ({
                id: `excel-q-${idx}`,
                questionText: q.question,
                category: q.category || 'general',
                section: q.section,
              })),
              answers: (excelData.questions || []).map((q: any, idx: number) => ({
                questionId: `excel-q-${idx}`,
                answer: q.answer,
                confidence: q.confidence || 'medium',
                confidenceScore: q.confidence === 'high' ? 0.85 : q.confidence === 'low' ? 0.4 : 0.65,
                sources: q.sources || [],
              })),
              metadata: {
                totalQuestions: excelData.metadata?.totalQuestions || 0,
                answeredQuestions: excelData.metadata?.answeredQuestions || 0,
                averageConfidence: 0.65,
                processingTimeMs: excelData.metadata?.processingTimeMs || 0,
                fileName: excelData.metadata?.fileName,
                sheetProcessed: excelData.metadata?.sheetProcessed,
              },
              columnMapping: excelData.columnMapping,
              answeredExcel: excelData.answeredExcel,
              isExcel: true,
            };
          } else {
            result = response.data as RFPResearchResult;
          }

          set({ rfpResearchResult: result, rfpResearchLoading: false });
          return result;
        } catch (error) {
          console.error('RFP Research failed', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to research RFP';
          set({
            rfpResearchError: errorMessage,
            rfpResearchLoading: false,
          });
          return null;
        }
      },

      // Add a single log entry
      addRFPLog: (log: RFPLogEntry) => set((state) => ({
        rfpResearchLogs: [...state.rfpResearchLogs, log],
      })),

      // Start RFP Research with live streaming logs via SSE
      startRFPResearchWithLogs: async (file: File, customPrompt?: string) => {
        set({
          rfpResearchLoading: true,
          rfpResearchError: null,
          rfpResearchResult: null,
          rfpResearchLogs: [],
        });

        // Add initial upload log
        const uploadLog: RFPLogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          stage: 'upload',
          message: `Uploading file: ${file.name}`,
          details: { fileName: file.name, fileSize: file.size, hasCustomPrompt: !!customPrompt },
        };
        set((state) => ({ rfpResearchLogs: [...state.rfpResearchLogs, uploadLog] }));

        try {
          const formData = new FormData();
          formData.append('file', file);
          if (customPrompt && customPrompt.trim()) {
            formData.append('customPrompt', customPrompt.trim());
          }

          const queueResponse = await apiPostForm('/api/proposal/research-rfp-jobs', formData);
          if (!queueResponse?.success || !queueResponse?.data?.jobId) {
            throw new Error(queueResponse?.error || 'Failed to queue RFP research job');
          }
          const jobId = queueResponse.data.jobId as string;

          set((state) => ({
            rfpResearchLogs: [
              ...state.rfpResearchLogs,
              {
                timestamp: new Date().toISOString(),
                level: 'info',
                stage: 'upload',
                message: `RFP research job queued (${jobId})`,
              },
            ],
          }));

          const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
          const start = Date.now();
          const timeoutMs = 15 * 60 * 1000;
          let lastStep = '';

          while (Date.now() - start < timeoutMs) {
            const statusResponse = await apiGet(`/api/proposal/jobs/${jobId}`);
            if (!statusResponse?.success || !statusResponse?.data) {
              throw new Error(statusResponse?.error || 'Failed to fetch RFP research job status');
            }

            const job = statusResponse.data as ProposalJobDetail;
            const currentStep = (job.currentStep || '').toString();
            if (currentStep && currentStep !== lastStep) {
              lastStep = currentStep;
              set((state) => ({
                rfpResearchLogs: [
                  ...state.rfpResearchLogs,
                  {
                    timestamp: new Date().toISOString(),
                    level: 'progress',
                    stage: 'answer_generation',
                    message: `Processing step: ${currentStep}`,
                  },
                ],
              }));
            }

            if (job.status === 'completed') {
              const result = job.proposalData as RFPResearchResult | null;
              if (!result) {
                throw new Error('RFP research completed but no result payload found');
              }

              const completeLog: RFPLogEntry = {
                timestamp: new Date().toISOString(),
                level: 'success',
                stage: 'complete',
                message: 'RFP analysis completed successfully',
                details: {
                  totalQuestions: result.metadata?.totalQuestions,
                  answeredQuestions: result.metadata?.answeredQuestions,
                },
              };
              set((state) => ({
                rfpResearchLogs: [...state.rfpResearchLogs, completeLog],
                rfpResearchResult: result,
                rfpResearchLoading: false,
              }));
              return result;
            }

            if (job.status === 'error') {
              throw new Error(job.errorMessage || 'RFP research failed');
            }
            if (job.status === 'cancelled') {
              throw new Error('RFP research job was cancelled');
            }

            await sleep(2000);
          }

          throw new Error('RFP research timed out while waiting for completion');
        } catch (error) {
          console.error('RFP Research with logs failed', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to research RFP';

          // Add error log
          const errorLog: RFPLogEntry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            stage: 'complete',
            message: errorMessage,
          };
          set((state) => ({
            rfpResearchLogs: [...state.rfpResearchLogs, errorLog],
            rfpResearchError: errorMessage,
            rfpResearchLoading: false,
          }));
          return null;
        }
      },

      clearRFPResearch: () => set({
        rfpResearchResult: null,
        rfpResearchError: null,
        rfpResearchLoading: false,
        rfpResearchLogs: [],
      }),

      // RFP Research History actions
      saveRFPResearch: async (result: RFPResearchResult, fileName?: string, customPrompt?: string) => {
        try {
          const response = await apiPost('/api/proposal/rfp-research', {
            fileName: fileName || result.metadata?.fileName,
            fileType: result.isExcel ? 'excel' : 'pdf',
            companyName: result.companyName,
            rfpSummary: result.rfpSummary,
            totalQuestions: result.metadata?.totalQuestions || result.questions?.length || 0,
            answeredQuestions: result.metadata?.answeredQuestions || result.answers?.length || 0,
            averageConfidence: result.metadata?.averageConfidence || 0,
            processingTimeMs: result.metadata?.processingTimeMs || 0,
            questions: result.questions,
            answers: result.answers,
            customPrompt,
          });

          if (!response?.success) {
            throw new Error(response?.error || 'Failed to save RFP research');
          }

          // Refresh history after saving
          await get().fetchRFPResearchHistory();
          return response.data?.researchId || null;
        } catch (error) {
          console.error('Failed to save RFP research', error);
          return null;
        }
      },

      fetchRFPResearchHistory: async () => {
        set({ rfpResearchHistoryLoading: true });
        try {
          const response = await apiGet('/api/proposal/rfp-research');
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to load RFP research history');
          }
          set({
            rfpResearchHistory: response.data || [],
            rfpResearchHistoryLoading: false,
          });
        } catch (error) {
          console.error('Failed to fetch RFP research history', error);
          set({ rfpResearchHistoryLoading: false });
        }
      },

      fetchRFPResearchDetail: async (researchId: string) => {
        set({ selectedResearchLoading: true, selectedResearchId: researchId });
        try {
          const response = await apiGet(`/api/proposal/rfp-research/${researchId}`);
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to load RFP research detail');
          }
          set({
            selectedResearch: response.data as RFPResearchDetail,
            selectedResearchLoading: false,
          });
        } catch (error) {
          console.error('Failed to fetch RFP research detail', error);
          set({ selectedResearchLoading: false });
        }
      },

      deleteRFPResearch: async (researchId: string) => {
        try {
          const response = await apiDelete(`/api/proposal/rfp-research/${researchId}`);
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to delete RFP research');
          }
          // Refresh history after deletion
          await get().fetchRFPResearchHistory();
          // Clear selected if it was deleted
          const { selectedResearchId } = get();
          if (selectedResearchId === researchId) {
            set({ selectedResearch: null, selectedResearchId: null });
          }
          return true;
        } catch (error) {
          console.error('Failed to delete RFP research', error);
          return false;
        }
      },

      clearSelectedResearch: () => set({
        selectedResearch: null,
        selectedResearchId: null,
      }),

      cancelJob: async (jobId: string) => {
        try {
          const response = await apiPost(`/api/proposal/jobs/${jobId}/cancel`, {});
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to cancel job');
          }
          // Refresh jobs list after cancellation
          await get().fetchJobs();
          // Clear selected job if it was the cancelled one
          const { selectedJobId } = get();
          if (selectedJobId === jobId) {
            set({ selectedJob: null, selectedJobId: null });
          }
          return true;
        } catch (error) {
          console.error('Failed to cancel job', error);
          set({ error: error instanceof Error ? error.message : 'Failed to cancel job' });
          return false;
        }
      },

      deleteJob: async (jobId: string) => {
        try {
          const response = await apiDelete(`/api/proposal/jobs/${jobId}`);
          if (!response?.success) {
            throw new Error(response?.error || 'Failed to delete job');
          }
          await get().fetchJobs();
          const { selectedJobId } = get();
          if (selectedJobId === jobId) {
            set({ selectedJob: null, selectedJobId: null });
          }
          return true;
        } catch (error) {
          console.error('Failed to delete job', error);
          set({ error: error instanceof Error ? error.message : 'Failed to delete job' });
          return false;
        }
      },
    }),
    {
      name: 'proposal-workflow-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        jobs: state.jobs,
        selectedJobId: state.selectedJobId,
        selectedJob: state.selectedJob,
        rfpResearchResult: state.rfpResearchResult,
      }),
    }
  )
);
