import { Router, Request, Response } from 'express';
import { getOpenAIService } from '../services/openai.service';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { ApiResponse } from '../types';

const router = Router();
const openai = getOpenAIService();

/**
 * Helper function to extract JSON from AI response
 */
function extractJsonFromResponse(content: string): any {
  // Try to find JSON in code blocks
  if (content.includes('```json')) {
    const start = content.indexOf('```json') + 7;
    const end = content.indexOf('```', start);
    const jsonStr = content.substring(start, end).trim();
    return JSON.parse(jsonStr);
  } else if (content.includes('```')) {
    const start = content.indexOf('```') + 3;
    const end = content.indexOf('```', start);
    const jsonStr = content.substring(start, end).trim();
    return JSON.parse(jsonStr);
  } else {
    return JSON.parse(content.trim());
  }
}

/**
 * POST /api/ai-questionnaire/next-question
 * Generate the next question in the sales discovery interview
 */
router.post(
  '/next-question',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationHistory } = req.body;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      throw new AppError('Conversation history is required', 400);
    }

    const messages = [...conversationHistory];
    messages.push({
      role: 'user',
      content: `Based on our conversation so far, generate the next most valuable discovery question.

Analyze the prospect's previous answers to:
1. Identify patterns and pain points
2. Understand their current state and challenges
3. Qualify their needs against Atlassian/ServiceNow solutions
4. Determine the best next topic to explore

Respond with a JSON object containing:
{
  "question": "The next question to ask (open-ended, focused, consultative)",
  "category": "One of: discovery, qualification, pain-point, solution-fit, objection-handling, closing",
  "reasoning": "Why you're asking this specific question based on previous answers",
  "suggestedAnswers": ["Optional: 2-3 common response patterns"],
  "followUpTopics": ["Topics that could be explored next based on their answer"],
  "identifiedNeeds": ["Pain points or needs identified from previous answers"],
  "productRecommendations": ["Specific Atlassian/ServiceNow products that could address their needs"],
  "nextQuestionHint": "Brief hint about where the conversation should go next"
}

Be strategic and build on what you've learned. Don't repeat topics unless going deeper.`,
    });

    const completion = await openai.generateChatCompletion({
      messages,
      temperature: 0.7,
      maxTokens: 1000,
    });

    const questionData = extractJsonFromResponse(completion);

    const response: ApiResponse = {
      success: true,
      data: questionData,
    };

    res.json(response);
  })
);

/**
 * POST /api/ai-questionnaire/should-continue
 * Determine if the conversation should continue or wrap up
 */
router.post(
  '/should-continue',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationHistory } = req.body;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      throw new AppError('Conversation history is required', 400);
    }

    const messages = [...conversationHistory];
    messages.push({
      role: 'user',
      content: `Analyze this sales discovery conversation and determine if we should continue asking questions or wrap up.

Consider:
1. Have we uncovered enough information about their challenges?
2. Do we understand their current tools and pain points?
3. Can we make informed product recommendations?
4. Have we qualified the opportunity sufficiently?
5. Is there diminishing returns on more questions?

Respond with JSON:
{
  "should_continue": true/false,
  "reasoning": "Why continue or why wrap up",
  "confidence": 0.0-1.0,
  "topics_covered": ["List of topics already explored"],
  "topics_remaining": ["Important topics not yet covered"]
}

Generally aim for 6-10 quality questions rather than exhaustive interrogation.`,
    });

    const completion = await openai.generateChatCompletion({
      messages,
      temperature: 0.3,
      maxTokens: 500,
    });

    const decisionData = extractJsonFromResponse(completion);

    const response: ApiResponse = {
      success: true,
      data: decisionData,
    };

    res.json(response);
  })
);

/**
 * POST /api/ai-questionnaire/summary
 * Generate final summary with insights and recommendations
 */
router.post(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationHistory } = req.body;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      throw new AppError('Conversation history is required', 400);
    }

    const messages = [...conversationHistory];
    messages.push({
      role: 'user',
      content: `Analyze this complete sales discovery conversation and provide a comprehensive summary.

Generate a JSON response with:
{
  "identifiedNeeds": [
    "List of 5-10 specific pain points, challenges, or needs identified",
    "Be specific and actionable"
  ],
  "productRecommendations": [
    "Specific Atlassian or ServiceNow products that address their needs",
    "Format: 'Product Name - Why it fits'"
  ],
  "nextSteps": [
    "Recommended actions for the sales rep"
  ],
  "opportunityScore": "1-10 rating of opportunity strength",
  "keyInsights": [
    "Critical insights from the conversation",
    "Decision drivers and criteria",
    "Potential objections to address"
  ],
  "decisionMakers": [
    "Roles/people involved in decision mentioned"
  ],
  "timeline": "Estimated decision timeline if mentioned",
  "budget": "Budget information if mentioned"
}

Be specific, actionable, and strategic. Focus on what the sales rep should do next.`,
    });

    const completion = await openai.generateChatCompletion({
      messages,
      temperature: 0.5,
      maxTokens: 1500,
    });

    const summaryData = extractJsonFromResponse(completion);

    const response: ApiResponse = {
      success: true,
      data: summaryData,
    };

    res.json(response);
  })
);

/**
 * POST /api/ai-questionnaire/analyze-answer
 * Analyze a specific answer for insights
 */
router.post(
  '/analyze-answer',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationHistory } = req.body;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      throw new AppError('Conversation history is required', 400);
    }

    // Get the last user message
    const lastAnswer = [...conversationHistory].reverse().find((msg: any) => msg.role === 'user');

    if (!lastAnswer) {
      throw new AppError('No user answer found', 400);
    }

    const messages = [...conversationHistory];
    messages.push({
      role: 'user',
      content: `Analyze this answer from the prospect:

"${lastAnswer.content}"

Provide JSON with:
{
  "keyInsights": ["2-3 key takeaways from this answer"],
  "painPoints": ["Explicit or implicit pain points mentioned"],
  "opportunities": ["Sales opportunities identified"],
  "concernsOrObjections": ["Any concerns or objections detected"],
  "sentiment": "positive/neutral/negative",
  "engagementLevel": "high/medium/low",
  "suggestedProbing": ["1-2 follow-up questions to go deeper on this topic"]
}`,
    });

    const completion = await openai.generateChatCompletion({
      messages,
      temperature: 0.4,
      maxTokens: 600,
    });

    const analysisData = extractJsonFromResponse(completion);

    const response: ApiResponse = {
      success: true,
      data: analysisData,
    };

    res.json(response);
  })
);

/**
 * POST /api/ai-questionnaire/generate-questions
 * Generate contextualized discovery questions based on research
 */
router.post(
  '/generate-questions',
  asyncHandler(async (req: Request, res: Response) => {
    const { companyName, researchSummary, keyInsights, attendeeInfo, enterpriseRecommendations, recommendedProducts } =
      req.body;

    if (!companyName || !researchSummary) {
      throw new AppError('Company name and research summary are required', 400);
    }

    const attendeesContext =
      attendeeInfo && attendeeInfo.length > 0
        ? attendeeInfo.map((att: any) => `- ${att.name || 'Unknown'} (${att.role || 'Unknown role'})`).join('\n')
        : 'No attendee information available';

    const insightsContext = keyInsights ? keyInsights.map((insight: string) => `- ${insight}`).join('\n') : '';
    const productsContext = recommendedProducts
      ? recommendedProducts.map((product: string) => `- ${product}`).join('\n')
      : '';
    const enterpriseContext = enterpriseRecommendations
      ? enterpriseRecommendations.map((rec: string) => `- ${rec}`).join('\n')
      : '';

    const prompt = `You are an expert sales consultant for Northstar Integrators. Generate 12-15 highly contextualized discovery questions for ${companyName}.

Company: ${companyName}

Research Summary:
${researchSummary}

Key Insights:
${insightsContext}

Meeting Attendees:
${attendeesContext}

Recommended Products:
${productsContext}

Northstar Integrators Services:
${enterpriseContext}

IMPORTANT - Northstar Integrators AI Services Opportunities:
Always include 2-3 questions that probe for AI-related opportunities. Northstar Integrators offers three new AI services:

1. **AI Behavioral Transformation** - Helping organizations overcome AI adoption resistance and build AI-ready culture
   - Probe for: AI adoption challenges, workforce resistance, skills gaps, cultural readiness
   - Ask about: Current AI tool usage (Copilot, ChatGPT), adoption rates, employee sentiment toward AI

2. **Rovo Augmented Product Development** - Leveraging Atlassian Rovo for AI-powered product development
   - Probe for: Atlassian usage, interest in AI-powered search/agents, knowledge discovery pain points
   - Ask about: Current Atlassian stack, interest in AI teammates, manual processes that could be automated

3. **AI-First Operating Model Design** - Designing enterprise AI governance and scalable AI practices
   - Probe for: AI strategy maturity, governance gaps, scaling challenges, CoE interest
   - Ask about: Enterprise AI initiatives, governance frameworks, AI standardization needs

Return JSON with this structure:
{
  "questions": [
    {
      "id": 1,
      "question": "The actual question text - conversational, specific, and consultative",
      "category": "discovery|technical|business-value|pain-point|solution-fit|transformation|ai-readiness",
      "context": "Why this question is relevant based on research insights",
      "northstar_connection": "Specific Northstar Integrators service/expertise that addresses this",
      "product_focus": "Specific product name",
      "target_persona": "Specific attendee name and role"
    }
  ]
}`;

    const completion = await openai.generateChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are an expert sales consultant for Northstar Integrators with deep knowledge of Atlassian, ServiceNow, and enterprise transformation.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      maxTokens: 3000,
    });

    const questionsData = extractJsonFromResponse(completion);

    const response: ApiResponse = {
      success: true,
      data: questionsData,
    };

    res.json(response);
  })
);

export default router;
