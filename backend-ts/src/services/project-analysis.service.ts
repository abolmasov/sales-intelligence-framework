import { getSharePointService } from './sharepoint.service';
import { getPDFService } from './pdf.service';
import { getLangChainService } from './langchain.service';
 
export interface SharePointFile {
  id: string;
  name: string;
  webUrl: string;
  file?: {
    mimeType: string;
  };
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  path?: string;
}
 
export interface ProjectDocument {
  id: string;
  name: string;
  mimeType: string;
  content: string;
  extractedText?: string;
  metadata: {
    size?: string;
    createdTime: string;
    modifiedTime: string;
    webViewLink: string;
    folderPath?: string;
  };
  documentType:
    | 'rfp'
    | 'specification'
    | 'requirement'
    | 'design'
    | 'contract'
    | 'proposal'
    | 'other';
  relevanceScore: number;
  driveId?: string;
}
 
export interface ProjectContext {
  projectName: string;
  rfpDocument: ProjectDocument;
  relatedDocuments: ProjectDocument[];
  totalDocuments: number;
  projectSummary: string;
  keyRequirements: string[];
  technicalSpecifications: string[];
  businessObjectives: string[];
  constraints: string[];
  clientContext: Record<string, string>;
}
 
/**
 * Project Analysis Service
 * Analyzes SharePoint documents for proposal generation
 * Uses token-based authentication (Bearer tokens)
 */
export class ProjectAnalysisService {
  private sharePointService: any;
  private pdfService: any;
  private langChainService: any;
  private inMemoryDocCache: Map<string, { name: string; text: string }> = new Map();
  private sharePointFolderUrl: string;
 
  constructor() {
    this.sharePointService = getSharePointService();
    this.pdfService = getPDFService();
    this.langChainService = getLangChainService();
    this.sharePointFolderUrl = process.env.SHAREPOINT_FOLDER_URL || '';
   
    if (!this.sharePointFolderUrl) {
      console.warn('⚠️ SHAREPOINT_FOLDER_URL not configured in .env file');
    }
  }
 
  /**
   * Extract project name from RFP content
   */
  async extractProjectName(rfpContent: string): Promise<string> {
   
    try {
      console.log('📝 Client Context Questions we will analyze:');
      console.log('1. Who is the buyer and who are the key stakeholders?');
      console.log('2. What business problem is the client trying to solve?');
      console.log("3. What are the client's goals and desired outcomes?");
      console.log('4. Why now? What is driving urgency or budget availability?');
      console.log('5. What challenges will make this problem hard to solve?');
      console.log('6. What does the client seek in a partner?');
      console.log('7. What is the procurement process and evaluation criteria?');
      console.log('8. Who are our likely competitors and what will they emphasize?');
      console.log('9. Why would the client choose us?');
      console.log('10. Why might the client not choose us?\n');
 
     const projectNamePrompt = `
You are an AI that extracts opportunities and produces a proposal title for Northstar Integrators.
 
### Step-by-step tasks:
 
1. Extract the **company/client name** from the document.
 
2. Extract all **opportunities** and their descriptions.
 
3. For each opportunity, determine which **Northstar Integrators capability category** it belongs to.
   Northstar Integrators capability categories:
   - Digital Product Development
   - Atlassian Solutions
   - AI & Data Solutions
   - Learning & Training
   - Platform & Cloud Engineering
   - ServiceNow Solutions
 
4. Group opportunities by capability category.
 
5. Select the single **strongest** capability group:
   - The group with the most opportunities OR
   - The group most emphasized in the document.
   Only opportunities from this capability group will be used in the title.
 
6. Convert opportunity names into short, clean labels such as:
   - Workflow Automation
   - ITSM
   - Asset Management
   - CMDB
   - Change Enablement
   - Cloud Migration
   (Use whatever is appropriate based on the document.)
 
7. Generate the final proposal title using the following format:
 
### If multiple related opportunities exist:
CompanyName – CapabilityName (Opportunity1 & Opportunity2)
 
### If only one opportunity fits the capability:
CompanyName – CapabilityName (Opportunity1)
 
### IMPORTANT RULES:
- Do NOT mix unrelated capabilities.
- Do NOT output any segment that does not belong to the strongest capability group.
- Output only the final title.
- No explanations, no bullet points, no reasoning.
 
### RFP / Transcript Content:
${rfpContent}
 
### Proposal Title:
`;
 
      const response = await this.langChainService.generateProposal(projectNamePrompt);
      const projectName = response.trim().replace(/['"]/g, '').substring(0, 100);
 
      console.log('🏷️ Extracted Project Name:', projectName);
      return projectName;
    } catch (error) {
      console.error('Error extracting project name:', error);
      return 'Unknown Project';
    }
  }
 
  /**
   * Faster RFP title extraction tuned for quick workflows (multi-opportunity aware)
   */
  async extractProjectNameQuick(rfpContent: string): Promise<string> {
    const buildFallbackTitle = () => {
      try {
        const normalizedText = (rfpContent || '')
          .replace(/\r/g, '\n')
          .split(/\n+/)
          .map((line) => line.trim())
          .filter((line) => line.length > 4 && line.length < 120);
 
        const keywordMatch = normalizedText.find((line) =>
          /(project|program|initiative|proposal|engagement)/i.test(line)
        );
 
        if (keywordMatch) {
          const cleaned = keywordMatch.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
          if (cleaned) {
            return cleaned.substring(0, 120);
          }
        }
 
        const fallback = normalizedText[0] || rfpContent.substring(0, 120);
        return (fallback || 'Quick Engagement').substring(0, 120);
      } catch (err) {
        console.error('Error building fallback quick title:', err);
        return 'Quick Engagement';
      }
    };
 
    try {
      const projectNamePrompt = `
You are an AI that extracts opportunities and produces a proposal title for Northstar Integrators.
 
### Step-by-step tasks:
 
1. Extract the **company/client name** from the document.
 
2. Extract all **opportunities** and their descriptions.
 
3. For each opportunity, determine which **Northstar Integrators capability category** it belongs to.
   Northstar Integrators capability categories:
   - Digital Product Development
   - Atlassian Solutions
   - AI & Data Solutions
   - Learning & Training
   - Platform & Cloud Engineering
   - ServiceNow Solutions
 
4. Group opportunities by capability category.
 
5. Select the single **strongest** capability group:
   - The group with the most opportunities OR
   - The group most emphasized in the document.
   Only opportunities from this capability group will be used in the title.
 
6. Convert opportunity names into short, clean labels such as:
   - Workflow Automation
   - ITSM
   - Asset Management
   - CMDB
   - Change Enablement
   - Cloud Migration
   (Use whatever is appropriate based on the document.)
 
7. Generate the final proposal title using the following format:
 
### If multiple related opportunities exist:
CompanyName – CapabilityName (Opportunity1 & Opportunity2)
 
### If only one opportunity fits the capability:
CompanyName – CapabilityName (Opportunity1)
 
### IMPORTANT RULES:
- Do NOT mix unrelated capabilities.
- Do NOT output any segment that does not belong to the strongest capability group.
- Output only the final title.
- No explanations, no bullet points, no reasoning.
 
### RFP / Transcript Content:
${rfpContent}
 
### Proposal Title:
`;
 
      const response = await this.langChainService.generateProposal(projectNamePrompt);
      const cleanedResponse = response
        .split('\n')
        .map((line: string) => line.trim())
        .filter(Boolean)[0] || '';
 
      const projectTitle = cleanedResponse.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
 
      if (projectTitle) {
        return projectTitle.substring(0, 150);
      }
 
      return buildFallbackTitle();
    } catch (error) {
      console.error('Error extracting quick project name with LLM:', error);
      return buildFallbackTitle();
    }
  }
 
  /**
   * Find project documents from SharePoint
   * Uses semantic search for better relevance
   */
  async findProjectDocuments(
    projectName: string,
    accessToken: string,
    rfpFileId?: string
  ): Promise<ProjectDocument[]> {
    try {
      console.log('🔍 Starting project document search...');
      console.log(`📌 Project Name: ${projectName}`);
 
      await this.langChainService.init();
 
      console.log('📂 Fetching all files from SharePoint folder...');
     
      if (!this.sharePointFolderUrl) {
        throw new Error('SHAREPOINT_FOLDER_URL is not configured. Please set it in .env file.');
      }
     
      const allFiles = await this.sharePointService.getSharedFolderContents(
        this.sharePointFolderUrl,
        accessToken
      );
 
      console.log(`✅ [DEBUG] Retrieved ${allFiles.length} total files from SharePoint`);
 
      // STEP 1: Calculate relevance score for ALL files (semantic-first)
      const relevanceScores = await Promise.all(
        allFiles.map((file: SharePointFile) =>
          this.calculateRelevanceScore(projectName, file.name, '', accessToken)
        )
      );
 
      // STEP 2: Map each file with its score
      const scoredFiles: ProjectDocument[] = allFiles.map((file: any, index: number) => {
        const documentType = this.classifyDocumentType(file.name);
        const relevanceScore = relevanceScores[index] ?? 0;
 
        return {
          id: file.id || `sharepoint-${Date.now()}`,
          name: file.name,
          mimeType: file.file?.mimeType || 'application/octet-stream',
          content: '', // content will be fetched later
          metadata: {
            size: (file.size || 0).toString(),
            createdTime: file.createdDateTime || new Date().toISOString(),
            modifiedTime: file.lastModifiedDateTime || new Date().toISOString(),
            webViewLink: file.webUrl || '',
            folderPath: file.path || undefined,
          },
          documentType,
          relevanceScore,
          driveId: file.driveId,
        };
      });
 
      // STEP 3: Sort by relevance
      const sortedFiles = scoredFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);
 
      // STEP 4: Keep only top N results (for performance)
      const topFiles = sortedFiles.slice(0, 15);
 
      console.log(`📄 Found ${topFiles.length} most relevant project documents`);
      console.log('🔢 Top document scores:');
      topFiles.forEach((file, i) => {
        console.log(`   #${i + 1}: ${file.name} → ${file.relevanceScore.toFixed(4)}`);
      });
 
      return topFiles;
    } catch (error) {
      console.error('❌ Error searching for project documents:', error);
      return [];
    }
  }
 
  /**
   * Calculate relevance score with LLM refinement
   */
  private async calculateRelevanceScore(
    projectName: string,
    fileName: string,
    content: string,
    accessToken?: string
  ): Promise<number> {
    try {
      const fileNameLower = fileName.toLowerCase();
      const projectNameLower = projectName.toLowerCase();
      const documentText = fileNameLower + (content ? ' ' + content.toLowerCase() : '');
 
      // Step 1: Calculate base similarity
      const similarity = await this.langChainService.calculateSimilarity(
        projectNameLower,
        documentText
      );
      let score = similarity;
      console.log(`🔢 Initial similarity score for "${fileName}":`, similarity.toFixed(4));
 
      // Step 2: Manual boosts / penalties
      if (
        (fileNameLower.includes('rfp') || fileNameLower.includes('proposal')) &&
        projectNameLower.split(' ').some((word) => fileNameLower.includes(word))
      ) {
        score += 0.3;
      }
 
      if (fileNameLower.includes('evaluation')) {
        score = 0;
      }
 
      // Clamp 0–1
      const manualScore = Math.max(0, Math.min(1, score));
 
      // Step 3: Refine using LLM
      const refinedScore = await this.langChainService.refineRelevanceScore(
        projectName,
        fileName,
        content,
        manualScore
      );
 
      // Step 4: Blend both (60% manual + 40% refined)
      const finalScore = manualScore * 0.6 + refinedScore * 0.4;
 
      return Math.max(0, Math.min(1, finalScore));
    } catch (error) {
      console.error('Error calculating relevance score:', error);
      return 0.5;
    }
  }
 
  /**
   * Classify document type based on filename and content
   */
  classifyDocumentType(
    fileName: string,
    content?: string
  ):
    | 'rfp'
    | 'specification'
    | 'requirement'
    | 'design'
    | 'contract'
    | 'proposal'
    | 'other' {
    const nameLower = fileName.toLowerCase();
    const contentLower = content?.toLowerCase() || '';
 
    if (nameLower.includes('rfp') || nameLower.includes('request for proposal')) return 'rfp';
    if (
      nameLower.includes('spec') ||
      nameLower.includes('specification') ||
      contentLower.includes('technical specification')
    )
      return 'specification';
    if (nameLower.includes('requirement') || contentLower.includes('requirements'))
      return 'requirement';
    if (
      nameLower.includes('design') ||
      nameLower.includes('architecture') ||
      contentLower.includes('system design')
    )
      return 'design';
    if (
      nameLower.includes('contract') ||
      nameLower.includes('agreement') ||
      contentLower.includes('terms and conditions')
    )
      return 'contract';
    if (nameLower.includes('proposal') || contentLower.includes('business proposal'))
      return 'proposal';
 
    return 'other';
  }
 
  /**
   * Extract document content from SharePoint file
   */
  async extractDocumentContent(file: any, accessToken: string): Promise<string> {
    try {
      let content = '';
 
      if (file.file?.mimeType === 'application/pdf') {
        const arrayBuffer = await this.sharePointService.downloadFileById(file.id, accessToken);
        const fileBuffer = Buffer.from(arrayBuffer);
        const healthCheck = await this.pdfService.checkPDFHealth(fileBuffer);
 
        if (healthCheck.isHealthy) {
          content = await this.pdfService.extractTextFromPDF(fileBuffer);
          // Extract key sections instead of truncating
          content = await this.extractKeyContent(content);
        } else {
          console.warn(`PDF health issues for ${file.name}:`, healthCheck.issues);
          content = `[PDF extraction failed: ${healthCheck.issues.join(', ')}]`;
        }
      } else if (
        file.file?.mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const arrayBuffer = await this.sharePointService.downloadFileById(file.id, accessToken);
        content = await this.pdfService.extractTextFromDOCX(Buffer.from(arrayBuffer));
        content = await this.extractKeyContent(content);
      } else if (
        file.file?.mimeType === 'text/plain' ||
        file.file?.mimeType?.startsWith('text/')
      ) {
        const arrayBuffer = await this.sharePointService.downloadFileById(file.id, accessToken);
        content = Buffer.from(arrayBuffer).toString();
        content = await this.extractKeyContent(content);
      }
 
      return content;
    } catch (error) {
      console.error(`Error extracting content from ${file.name}:`, error);
      return `[Content extraction failed: ${error}]`;
    }
  }
 
  /**
   * Load and extract text from project documents
   * Caches results in-memory to avoid redownloading
   */
  async loadProjectDocuments(
    projectFiles: ProjectDocument[],
    accessToken: string
  ): Promise<{ id: string; name: string; text: string }[]> {
    if (!accessToken)
      throw new Error('Access token required to download project documents');
 
    console.log('🧠 [DEBUG] Entering loadProjectDocuments...');
    console.log('📁 [DEBUG] Files to process:', projectFiles.map((f) => f.name));
 
    const results: { id: string; name: string; text: string }[] = [];
 
    for (const file of projectFiles) {
      const cacheKey = file.id || file.name;
      try {
        // cache hit
        if (this.inMemoryDocCache.has(cacheKey)) {
          const cached = this.inMemoryDocCache.get(cacheKey)!;
          console.log(`⚡ [CACHE HIT] Using cached text for ${file.name}`);
          results.push({ id: file.id, name: file.name, text: cached.text });
          continue;
        }
 
        const fileUrl = file.metadata?.webViewLink || file.name;
        console.log(`📥 [DEBUG] Loading ${file.name} (${file.id}) from ${fileUrl}`);
 
        const arrayBuffer = await this.sharePointService.downloadFileById(
          file.id,
          accessToken,
          file.driveId
        );
        const buffer = Buffer.from(arrayBuffer);
 
        let rawText = '';
 
        if (file.name.toLowerCase().endsWith('.pdf')) {
          try {
            rawText = await this.pdfService.extractTextFromPDF(buffer);
            console.log(
              `📄 [DEBUG] Extracted ${rawText?.length || 0} chars from PDF ${file.name}`
            );
          } catch (err) {
            console.warn(`⚠️ [DEBUG] PDF extraction failed for ${file.name}:`, err);
            rawText = `[PDF extraction failed: ${err instanceof Error ? err.message : String(err)}]`;
          }
        } else if (file.name.toLowerCase().endsWith('.docx')) {
          try {
            rawText = await this.pdfService.extractTextFromDOCX(buffer);
            console.log(
              `📝 [DEBUG] Extracted ${rawText?.length || 0} chars from DOCX ${file.name}`
            );
          } catch (err) {
            console.warn(`⚠️ [DEBUG] DOCX extraction failed for ${file.name}:`, err);
            rawText = `[DOCX extraction failed: ${err instanceof Error ? err.message : String(err)}]`;
          }
        } else {
          rawText = `[Skipped: unsupported file type ${file.name}]`;
          console.log(`⚠️ [DEBUG] Skipping non-supported type: ${file.name}`);
        }
 
        // Extract key content
        let keyText = '';
        try {
          keyText = (await this.extractKeyContent(rawText || '')) || '';
        } catch (err) {
          console.warn(`⚠️ extractKeyContent failed for ${file.name}:`, err);
          keyText = '';
        }
 
        const safeSource =
          keyText && keyText.trim().length > 0 ? keyText : rawText || '[No text extracted]';
        const maxLen = 3000;
        const finalText =
          safeSource.length > maxLen ? safeSource.substring(0, maxLen) + '...' : safeSource;
 
        console.log(`🧾 [DEBUG] Final text length for ${file.name}: ${finalText.length}`);
 
        this.inMemoryDocCache.set(cacheKey, { name: file.name, text: finalText });
        results.push({ id: file.id, name: file.name, text: finalText });
      } catch (err) {
        console.error(`❌ Error loading document ${file.name}:`, err);
        results.push({
          id: file.id,
          name: file.name,
          text: `[Error loading document: ${err instanceof Error ? err.message : String(err)}]`,
        });
      }
    }
 
    console.log('✅ [DEBUG] loadProjectDocuments complete:', results.length, 'files processed');
    return results;
  }
 
  /**
   * Extract key content from document using LLM
   */
  private async extractKeyContent(content: string): Promise<string> {
    if (!content || content.trim().length === 0) {
      return '[No text available to extract key content]';
    }
 
    try {
      const extractionPrompt = `
Analyze this document content and extract the most relevant sections including:
 
For each heading:
- Extract or summarize the content **in detail** under that heading.
- Capture **complete context, examples, metrics, technical details, and explanations**.
- Keep the section long enough to reflect the true content (a few short paragraphs if needed).
- Use the document's **original language and tone** as much as possible.
- Avoid skipping sections or shortening excessively.
 
These are sideheadings to look for:
- Executive summaries
- Project scope
- Technical requirements
- Cost information
- Timeline details
- Key deliverables
 
Original content:
${content}
 
Return only the most relevant sections, preserving original wording where possible.
If you cannot extract anything meaningful, return an empty string.
`;
      const extractedContent = await this.langChainService.generateProposal(extractionPrompt);
      if (
        !extractedContent ||
        typeof extractedContent !== 'string' ||
        extractedContent.trim().length === 0
      ) {
        console.warn(
          '⚠️ [extractKeyContent] LangChain returned empty. Falling back to raw content preview.'
        );
        return content.substring(0, 2000) + (content.length > 2000 ? '...' : '');
      }
      return extractedContent;
    } catch (err) {
      console.error('❌ [extractKeyContent] failed:', err);
      return content.substring(0, 2000) + (content.length > 2000 ? '...' : '');
    }
  }
 
  /**
   * Extract client context from RFP (10 questions)
   */
  async extractClientContext(rfpContent: string): Promise<Record<string, string>> {
    console.log('🧠 extractClientContext() starting...');
    try {
      console.log('📋 Extracting client context from RFP...');
      const prompt = `
You are an RFP analysis expert. Analyze the following RFP content and extract concise answers
to each of these client context questions. Return results in strict JSON format.
 
Questions:
1. Who is the buyer and who are the key stakeholders?
2. What business problem is the client trying to solve?
3. What are the client's goals and desired outcomes?
4. Why now? What is driving urgency or budget availability?
5. What challenges will make this problem hard to solve?
6. What does the client seek in a partner?
7. What is the procurement process and evaluation criteria?
8. Who are our likely competitors and what will they emphasize?
9. Why would the client choose us?
10. Why might the client not choose us?
 
RFP Content:
${rfpContent}
 
Return only JSON, like:
{
  "1": "",
  "2": "",
  "3": "",
  "4": "",
  "5": "",
  "6": "",
  "7": "",
  "8": "",
  "9": "",
  "10": ""
}`;
 
      const response = await this.langChainService.generateProposal(prompt);
      const parsedResponse = JSON.parse(response);
 
      console.log('\n📊 Client Context Analysis Results:');
      console.log('1️⃣ Buyer and Key Stakeholders:', parsedResponse['1']);
      console.log('2️⃣ Business Problem:', parsedResponse['2']);
      console.log('3️⃣ Goals and Outcomes:', parsedResponse['3']);
      console.log('4️⃣ Timing and Urgency:', parsedResponse['4']);
      console.log('5️⃣ Key Challenges:', parsedResponse['5']);
      console.log('6️⃣ Partner Requirements:', parsedResponse['6']);
      console.log('7️⃣ Procurement Process:', parsedResponse['7']);
      console.log('8️⃣ Competitor Analysis:', parsedResponse['8']);
      console.log('9️⃣ Our Advantages:', parsedResponse['9']);
      console.log('🔟 Potential Concerns:', parsedResponse['10']);
      console.log('\n✅ Client context analysis completed');
 
      return parsedResponse;
    } catch (error) {
      console.error('Error extracting client context:', error);
      return {
        '1': 'Unable to extract',
        '2': 'Unable to extract',
        '3': 'Unable to extract',
        '4': 'Unable to extract',
        '5': 'Unable to extract',
        '6': 'Unable to extract',
        '7': 'Unable to extract',
        '8': 'Unable to extract',
        '9': 'Unable to extract',
        '10': 'Unable to extract',
      };
    }
  }
 
  /**
   * Analyze project documents comprehensively
   * Main entry point for full project analysis
   */
  async analyzeProjectDocuments(
    requirements: string,
    accessToken: string,
    fileId?: string
  ): Promise<ProjectContext> {
    console.log('🔄 Starting comprehensive project analysis...');
 
    // Extract project name and client context in parallel
    const [projectName, clientContext] = await Promise.all([
      this.extractProjectName(requirements),
      this.extractClientContext(requirements),
    ]);
 
    console.log('📊 Project name and client context extracted');
 
    // Find related documents
    const relatedDocs = await this.findProjectDocuments(projectName, accessToken, fileId);
 
    // Process document details
    const documentDetails = await Promise.all(
      relatedDocs.map(async (doc: ProjectDocument) => {
        const content = await this.extractDocumentContent(doc, accessToken);
        const documentType = this.classifyDocumentType(doc.name, content);
        const relevanceScore = await this.calculateRelevanceScore(
          projectName,
          doc.name,
          content,
          accessToken
        );
 
        return {
          id: doc.id,
          name: doc.name,
          mimeType: doc.mimeType,
          content,
          metadata: {
            size: doc.metadata.size || '',
            createdTime: doc.metadata.createdTime,
            modifiedTime: doc.metadata.modifiedTime,
            webViewLink: doc.metadata.webViewLink,
          },
          documentType,
          relevanceScore,
        };
      })
    );
 
    const analysisResult = {
      projectName,
      clientContext,
      rfpDocument: {
        id: 'current',
        name: 'Current RFP',
        mimeType: 'application/pdf',
        content: requirements,
        metadata: {
          createdTime: new Date().toISOString(),
          modifiedTime: new Date().toISOString(),
          webViewLink: '',
        },
        documentType: 'rfp' as const,
        relevanceScore: 100,
      },
      relatedDocuments: documentDetails,
      totalDocuments: documentDetails.length + 1,
      projectSummary: 'Project analysis based on RFP requirements',
      keyRequirements: requirements
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .slice(0, 5),
      technicalSpecifications: [],
      businessObjectives: [],
      constraints: [],
    };
 
    console.log('✅ Project analysis completed with client context');
    return analysisResult;
  }
}
 
// Export singleton instance
let projectAnalysisService: ProjectAnalysisService | null = null;
 
export function getProjectAnalysisService(): ProjectAnalysisService {
  if (!projectAnalysisService) {
    projectAnalysisService = new ProjectAnalysisService();
  }
  return projectAnalysisService;
}
 