/**
 * Opportunity Detection Service (TypeScript)
 * Migrated from Python ML model to TypeScript keyword-based detector
 */

export interface OpportunitySignals {
  budgetDiscussion: number;
  painPoints: number;
  timeline: number;
  decisionMaker: number;
  competitorMention: number;
  positiveSignals: number;
  expansion: number;
  urgency: number;
  questionCount: number;
  length: number;
  wordCount: number;
  // AI Services signals
  aiBehavioralTransformation: number;
  rovoAugmentedProductDev: number;
  aiFirstOperatingModel: number;
}

export interface OpportunityPrediction {
  hasOpportunity: boolean;
  confidence: number;
  opportunityProbability: number;
  topSignals: Array<{ signal: string; count: number }>;
  featureScores: OpportunitySignals;
}

/**
 * OpportunityDetector - Keyword-based opportunity detection
 * Replaces Python ML model with rule-based scoring
 */
export class OpportunityDetectorService {
  private opportunityKeywords = {
    budgetDiscussion: [
      'budget',
      'investment',
      'cost',
      'pricing',
      'price',
      'spend',
      'roi',
      'return on investment',
      'allocated',
      'approved budget',
      '$',
      'thousand',
      'million',
      'k ',
      ' k,',
      ' k.',
    ],
    painPoints: [
      'struggling',
      'challenge',
      'problem',
      'difficulty',
      'issue',
      'concern',
      'frustrated',
      'pain',
      'bottleneck',
      'obstacle',
      'blocking',
      'stuck',
      'inefficient',
      'slow',
      'broken',
      'failing',
    ],
    timeline: [
      'timeline',
      'deadline',
      'when',
      'start date',
      'launch',
      'go live',
      'implement',
      'rollout',
      'q1',
      'q2',
      'q3',
      'q4',
      'quarter',
      'month',
      'week',
      'by ',
      'before',
      'asap',
    ],
    decisionMaker: [
      'decision',
      'decide',
      'approve',
      'approval',
      'sign off',
      'stakeholder',
      'c-level',
      'executive',
      'ceo',
      'cto',
      'cfo',
      'cio',
      'vp',
      'director',
      'head of',
      'board',
      'leadership',
    ],
    competitorMention: [
      'currently using',
      'competitor',
      'alternative',
      'compared to',
      'switch from',
      'replacing',
      'instead of',
      'vs ',
      'versus',
      'other vendors',
      'other solutions',
    ],
    positiveSignals: [
      'interested',
      'sounds good',
      'like that',
      'makes sense',
      'exactly what we need',
      'perfect',
      'great',
      'excellent',
      'impressive',
      'looking forward',
      'excited',
      'yes',
      'definitely',
      'absolutely',
      'agree',
    ],
    expansion: [
      'scale',
      'grow',
      'expand',
      'additional',
      'more teams',
      'rollout',
      'enterprise',
      'organization wide',
      'company wide',
      'global',
      'all teams',
      'everyone',
    ],
    urgency: [
      'urgent',
      'asap',
      'critical',
      'immediately',
      'right away',
      'high priority',
      'top priority',
      'need it now',
      'can\'t wait',
      'urgent need',
      'pressing',
    ],
    // Northstar Integrators AI Services keywords
    aiBehavioralTransformation: [
      'ai adoption',
      'ai resistance',
      'copilot adoption',
      'chatgpt adoption',
      'ai readiness',
      'ai culture',
      'ai training',
      'ai enablement',
      'ai skills',
      'ai literacy',
      'upskilling ai',
      'ai skepticism',
      'ai fear',
      'ai anxiety',
      'workforce ai',
      'ai change management',
      'ai champions',
      'generative ai adoption',
      'not using copilot',
      'low adoption',
      'resistance to ai',
      'worried about ai',
    ],
    rovoAugmentedProductDev: [
      'rovo',
      'atlassian rovo',
      'atlassian ai',
      'atlassian intelligence',
      'ai agents',
      'ai teammates',
      'virtual teammates',
      'ai powered jira',
      'ai confluence',
      'ai search',
      'knowledge discovery',
      'can\'t find information',
      'scattered across confluence',
      'rovo agents',
      'rovo search',
      'ai backlog',
      'ai requirements',
      'ai user stories',
      'ai sprint planning',
      'ai retrospective',
    ],
    aiFirstOperatingModel: [
      'ai operating model',
      'ai strategy',
      'ai governance',
      'ai center of excellence',
      'ai coe',
      'enterprise ai',
      'ai architecture',
      'ai platform',
      'ai maturity',
      'ai roadmap',
      'ai framework',
      'ai standardization',
      'ai policy',
      'responsible ai',
      'ai ethics',
      'ai risk',
      'ai compliance',
      'llm strategy',
      'generative ai strategy',
      'ai at scale',
      'scale ai',
      'ai metrics',
      'ai kpi',
      'ai roi',
      'ai pilots everywhere',
      'no ai strategy',
    ],
  };

  /**
   * Extract opportunity signals from transcript
   */
  extractFeatures(transcript: string): OpportunitySignals {
    const textLower = transcript.toLowerCase();
    const features: OpportunitySignals = {
      budgetDiscussion: 0,
      painPoints: 0,
      timeline: 0,
      decisionMaker: 0,
      competitorMention: 0,
      positiveSignals: 0,
      expansion: 0,
      urgency: 0,
      questionCount: (transcript.match(/\?/g) || []).length,
      length: transcript.length,
      wordCount: transcript.split(/\s+/).length,
      // AI Services signals
      aiBehavioralTransformation: 0,
      rovoAugmentedProductDev: 0,
      aiFirstOperatingModel: 0,
    };

    // Count occurrences of each keyword category
    for (const [category, keywords] of Object.entries(this.opportunityKeywords)) {
      const count = keywords.reduce((sum, keyword) => {
        const regex = new RegExp(keyword.toLowerCase(), 'gi');
        const matches = textLower.match(regex);
        return sum + (matches ? matches.length : 0);
      }, 0);
      (features as any)[category] = count;
    }

    return features;
  }

  /**
   * Predict opportunity based on extracted features
   */
  predictOpportunity(transcript: string): OpportunityPrediction {
    const features = this.extractFeatures(transcript);

    // Calculate weighted opportunity score
    const weights = {
      budgetDiscussion: 3.0, // Budget mentions are very strong signals
      urgency: 2.5,
      timeline: 2.0,
      decisionMaker: 2.0,
      painPoints: 1.5,
      positiveSignals: 1.5,
      expansion: 1.5,
      competitorMention: 1.0,
      questionCount: 0.1,
      // AI Services - high weight as these are strategic opportunities
      aiBehavioralTransformation: 2.5,
      rovoAugmentedProductDev: 2.5,
      aiFirstOperatingModel: 2.5,
    };

    let score = 0;
    let maxScore = 0;

    // Calculate weighted score
    score += features.budgetDiscussion * weights.budgetDiscussion;
    score += features.urgency * weights.urgency;
    score += features.timeline * weights.timeline;
    score += features.decisionMaker * weights.decisionMaker;
    score += features.painPoints * weights.painPoints;
    score += features.positiveSignals * weights.positiveSignals;
    score += features.expansion * weights.expansion;
    score += features.competitorMention * weights.competitorMention;
    score += features.questionCount * weights.questionCount;
    // AI Services scores
    score += features.aiBehavioralTransformation * weights.aiBehavioralTransformation;
    score += features.rovoAugmentedProductDev * weights.rovoAugmentedProductDev;
    score += features.aiFirstOperatingModel * weights.aiFirstOperatingModel;

    // Calculate max possible score for normalization
    maxScore =
      10 * weights.budgetDiscussion +
      10 * weights.urgency +
      10 * weights.timeline +
      10 * weights.decisionMaker +
      10 * weights.painPoints +
      10 * weights.positiveSignals +
      10 * weights.expansion +
      5 * weights.competitorMention +
      20 * weights.questionCount +
      // AI Services max scores
      10 * weights.aiBehavioralTransformation +
      10 * weights.rovoAugmentedProductDev +
      10 * weights.aiFirstOperatingModel;

    // Normalize to 0-1
    const opportunityProbability = Math.min(score / maxScore, 1.0);

    // Determine if there's an opportunity (threshold: 0.3)
    const hasOpportunity = opportunityProbability > 0.3;

    // Calculate confidence based on signal diversity
    const signalCount = Object.entries(features)
      .filter(([key, value]) => !['length', 'wordCount', 'questionCount'].includes(key))
      .filter(([_, value]) => value > 0).length;

    const confidence = Math.min(0.5 + signalCount * 0.1, 1.0);

    // Get top signals
    const topSignals = Object.entries(features)
      .filter(([key, value]) => !['length', 'wordCount', 'questionCount'].includes(key))
      .filter(([_, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([signal, count]) => ({ signal, count }));

    return {
      hasOpportunity,
      confidence,
      opportunityProbability,
      topSignals,
      featureScores: features,
    };
  }

  /**
   * Chunk large transcripts for processing
   */
  chunkTranscript(
    transcript: string,
    chunkSize: number = 4000,
    overlap: number = 200
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < transcript.length) {
      let end = start + chunkSize;
      let chunk = transcript.substring(start, end);

      // Try to break at sentence boundary
      if (end < transcript.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastQuestion = chunk.lastIndexOf('?');
        const lastExclaim = chunk.lastIndexOf('!');

        const breakPoint = Math.max(lastPeriod, lastQuestion, lastExclaim);
        if (breakPoint > chunkSize * 0.7) {
          chunk = chunk.substring(0, breakPoint + 1);
          end = start + breakPoint + 1;
        }
      }

      chunks.push(chunk.trim());
      start = end - overlap;
    }

    return chunks;
  }

  /**
   * Analyze large transcripts using chunking
   */
  analyzeWithChunking(transcript: string): OpportunityPrediction {
    const chunks = this.chunkTranscript(transcript);

    if (chunks.length === 1) {
      return this.predictOpportunity(transcript);
    }

    // Analyze each chunk
    const chunkPredictions = chunks.map((chunk) => this.predictOpportunity(chunk));

    // Aggregate results
    const avgOpportunityProb =
      chunkPredictions.reduce((sum, p) => sum + p.opportunityProbability, 0) / chunks.length;

    const hasOpportunity = avgOpportunityProb > 0.3;

    // Merge top signals from all chunks
    const allSignals: { [key: string]: number } = {};
    chunkPredictions.forEach((pred) => {
      pred.topSignals.forEach(({ signal, count }) => {
        allSignals[signal] = (allSignals[signal] || 0) + count;
      });
    });

    const topSignals = Object.entries(allSignals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([signal, count]) => ({ signal, count }));

    // Merge feature scores
    const mergedFeatures: OpportunitySignals = {
      budgetDiscussion: 0,
      painPoints: 0,
      timeline: 0,
      decisionMaker: 0,
      competitorMention: 0,
      positiveSignals: 0,
      expansion: 0,
      urgency: 0,
      questionCount: 0,
      length: transcript.length,
      wordCount: transcript.split(/\s+/).length,
      // AI Services signals
      aiBehavioralTransformation: 0,
      rovoAugmentedProductDev: 0,
      aiFirstOperatingModel: 0,
    };

    chunkPredictions.forEach((pred) => {
      Object.keys(mergedFeatures).forEach((key) => {
        if (key !== 'length' && key !== 'wordCount') {
          (mergedFeatures as any)[key] += (pred.featureScores as any)[key];
        }
      });
    });

    return {
      hasOpportunity,
      confidence: avgOpportunityProb,
      opportunityProbability: avgOpportunityProb,
      topSignals,
      featureScores: mergedFeatures,
    };
  }
}

// Singleton instance
let opportunityDetectorInstance: OpportunityDetectorService | null = null;

export function getOpportunityDetectorService(): OpportunityDetectorService {
  if (!opportunityDetectorInstance) {
    opportunityDetectorInstance = new OpportunityDetectorService();
  }
  return opportunityDetectorInstance;
}
