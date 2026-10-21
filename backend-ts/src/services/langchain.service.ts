import OpenAI from 'openai';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * AI utility service backed by the official OpenAI SDK.
 * Provides helpers for chat completions, embeddings, and similarity scoring.
 */
export class LangChainService {
  private client: OpenAI;
  private chatModel: string;
  private embeddingModel: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    this.client = new OpenAI({ apiKey });
    this.chatModel = process.env.OPENAI_MODEL || 'gpt-5';
    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002';
  }

  private async chat(messages: ChatMessage[], temperature = 1): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.chatModel,
      temperature,
      messages,
    });
    return response.choices[0]?.message?.content?.trim() || '';
  }

  private async embed(inputs: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: inputs,
    });
    return response.data.map((item) => item.embedding);
  }

  private async embedText(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Calculate similarity score between RFP text and SharePoint document
   */
  async calculateSimilarity(rfpText: string, documentText: string): Promise<number> {
    try {
      const [rfpEmbedding, docEmbedding] = await Promise.all([
        this.embedText(rfpText.substring(0, 8000)),
        this.embedText(documentText.substring(0, 8000)),
      ]);
      return this.cosineSimilarity(rfpEmbedding, docEmbedding);
    } catch (error) {
      console.error('Error calculating similarity:', error);
      throw new Error(
        `Failed to calculate similarity: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract client context by analyzing RFP with GPT
   */
  async extractClientContext(rfpText: string): Promise<{
    industry: string;
    projectType: string;
    keyRequirements: string[];
    timeline: string;
    budget: string;
    painPoints: string[];
    successCriteria: string[];
    stakeholders: string[];
    technicalNeeds: string[];
    complianceRequirements: string[];
  }> {
    try {
      const systemPrompt = `You are an expert business analyst. Analyze the following RFP document and extract structured information.
Answer these questions in JSON format:
1. What industry is the client in?
2. What type of project is this?
3. What are the key requirements? (list 3-5)
4. What is the timeline mentioned?
5. What is the budget range if mentioned?
6. What are the main pain points? (list 2-4)
7. What are the success criteria? (list 2-4)
8. Who are the key stakeholders mentioned?
9. What technical needs are specified? (list 2-4)
10. What compliance/regulatory requirements exist?

Return ONLY valid JSON matching this structure:
{
  "industry": "string",
  "projectType": "string",
  "keyRequirements": ["string"],
  "timeline": "string",
  "budget": "string",
  "painPoints": ["string"],
  "successCriteria": ["string"],
  "stakeholders": ["string"],
  "technicalNeeds": ["string"],
  "complianceRequirements": ["string"]
}`;

      const content = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rfpText.substring(0, 12000) },
      ]);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from OpenAI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error extracting client context:', error);
      throw new Error(
        `Failed to extract client context: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate proposal outline based on RFP and relevant case studies
   */
  async generateProposalOutline(
    rfpText: string,
    clientContext: any,
    relevantCaseStudies: Array<{ title: string; summary: string; score: number }>
  ): Promise<{
    executiveSummary: string;
    sections: Array<{ title: string; description: string }>;
  }> {
    try {
      const caseStudyContext = relevantCaseStudies
        .map(
          (cs, idx) =>
            `${idx + 1}. ${cs.title} (relevance: ${(cs.score * 100).toFixed(1)}%)\n   ${cs.summary}`
        )
        .join('\n\n');

      const systemPrompt = `You are an expert proposal writer. Create a detailed proposal outline based on the RFP requirements and relevant case studies.

Client Context:
- Industry: ${clientContext.industry}
- Project Type: ${clientContext.projectType}
- Key Requirements: ${clientContext.keyRequirements?.join(', ')}
- Timeline: ${clientContext.timeline}
- Pain Points: ${clientContext.painPoints?.join(', ')}

Relevant Case Studies:
${caseStudyContext}

Create a comprehensive proposal outline with:
1. Executive Summary (3-4 sentences)
2. 5-7 main sections with titles and descriptions

Return ONLY valid JSON:
{
  "executiveSummary": "string",
  "sections": [
    {"title": "string", "description": "string"}
  ]
}`;

      const content = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rfpText.substring(0, 8000) },
      ]);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from OpenAI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating proposal outline:', error);
      throw new Error(
        `Failed to generate proposal outline: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a complete proposal section using GPT
   */
  async generateProposalSection(
    sectionTitle: string,
    sectionDescription: string,
    rfpContext: string,
    relevantContent: string
  ): Promise<string> {
    try {
      const systemPrompt = `You are an expert proposal writer. Generate a detailed, professional section for a business proposal.

Section: ${sectionTitle}
Description: ${sectionDescription}

Use the relevant content provided to support your writing. Be specific, professional, and persuasive.
Write 3-5 paragraphs with clear value propositions.`;

      return this.chat([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `RFP Context:\n${rfpContext}\n\nRelevant Content:\n${relevantContent}`,
        },
      ]);
    } catch (error) {
      console.error('Error generating proposal section:', error);
      throw new Error(`Failed to generate section: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Review and improve proposal content
   */
  async reviewProposal(proposalText: string, rfpRequirements: string): Promise<{
    score: number;
    suggestions: string[];
    improvedText: string;
  }> {
    try {
      const systemPrompt = `You are an expert proposal reviewer. Review this proposal against the RFP requirements.

Provide:
1. Quality score (0-100)
2. 3-5 specific improvement suggestions
3. Improved version of the proposal

Return ONLY valid JSON:
{
  "score": number,
  "suggestions": ["string"],
  "improvedText": "string"
}`;

      const content = await this.chat([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `RFP Requirements:\n${rfpRequirements}\n\nProposal:\n${proposalText}`,
        },
      ]);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from OpenAI response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error reviewing proposal:', error);
      throw new Error(
        `Failed to review proposal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embeddings for a list of documents
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const clipped = texts.map((text) => text.substring(0, 8000));
      return this.embed(clipped);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find most similar documents using embeddings
   */
  async findSimilarDocuments(
    queryText: string,
    documents: Array<{ id: string; text: string; metadata?: any }>,
    topK: number = 5
  ): Promise<Array<{ id: string; text: string; metadata?: any; similarity: number }>> {
    try {
      const queryEmbedding = await this.embedText(queryText.substring(0, 8000));
      const docTexts = documents.map((doc) => doc.text.substring(0, 8000));
      const docEmbeddings = await this.embed(docTexts);

      const similarities = docEmbeddings.map((docEmb) => this.cosineSimilarity(queryEmbedding, docEmb));

      return documents
        .map((doc, idx) => ({
          ...doc,
          similarity: similarities[idx],
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      console.error('Error finding similar documents:', error);
      throw new Error(
        `Failed to find similar documents: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Initialize the service (for compatibility with old code)
   */
  async init(): Promise<void> {
    console.log('OpenAI service initialized');
  }

  /**
   * Generate proposal text using GPT
   */
  async generateProposal(prompt: string): Promise<string> {
    try {
      return this.chat([{ role: 'user', content: prompt }]);
    } catch (error) {
      console.error('Error generating proposal:', error);
      throw new Error(
        `Failed to generate proposal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refine relevance score using LLM
   */
  async refineRelevanceScore(
    projectName: string,
    fileName: string,
    content: string,
    manualScore: number
  ): Promise<number> {
    try {
      const prompt = `You are a document relevance expert. 
      
Project: "${projectName}"
Document: "${fileName}"
Initial Score: ${manualScore.toFixed(4)}

Content Preview:
${content.substring(0, 1000)}

On a scale of 0 to 1, how relevant is this document to the project?
Return ONLY a numerical value between 0 and 1 (e.g., 0.85).`;

      const raw = await this.chat([{ role: 'user', content: prompt }]);
      const scoreMatch = raw.match(/0?\.\d+|[01]\.?\d*/);
      if (scoreMatch) {
        const parsed = parseFloat(scoreMatch[0]);
        if (!Number.isNaN(parsed)) {
          return Math.max(0, Math.min(1, parsed));
        }
      }

      console.warn('Failed to parse LLM relevance score, using manual score');
      return manualScore;
    } catch (error) {
      console.error('Error refining relevance score:', error);
      return manualScore;
    }
  }
}

// Export singleton instance
let langChainService: LangChainService | null = null;

export function getLangChainService(): LangChainService {
  if (!langChainService) {
    langChainService = new LangChainService();
  }
  return langChainService;
}
