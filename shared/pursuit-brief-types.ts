/**
 * Pursuit Brief Types
 *
 * A pursuit brief is a comprehensive document that captures all intelligence
 * about a sales opportunity. It's built progressively through:
 * 1. Company research and opportunity detection
 * 2. Meeting transcript analysis
 * 3. Final proposal generation
 */

export interface PursuitBriefQuestion {
  id: string;
  section: string;
  question: string;
  order: number;
  answer?: string;
  confidence?: 'low' | 'medium' | 'high';
  sources?: string[]; // IDs of research sessions, transcripts, etc.
  lastUpdated?: string;
  aiGenerated?: boolean;
}

export interface PursuitBriefSection {
  id: string;
  name: string;
  order: number;
  questions: PursuitBriefQuestion[];
  completeness: number; // 0-100%
}

export interface PursuitBrief {
  id: string;
  deal_id: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'in_progress' | 'ready_for_proposal' | 'completed';
  completeness: number; // Overall 0-100%

  // Sections with questions
  sections: PursuitBriefSection[];

  // Linked intelligence sources
  linked_research_sessions: string[];
  linked_transcripts: string[];
  linked_case_studies: string[];

  // Generated artifacts
  proposal_draft?: string;
  proposal_generated_at?: string;
}

export const PURSUIT_BRIEF_QUESTIONS: Omit<PursuitBriefQuestion, 'answer' | 'confidence' | 'sources' | 'lastUpdated' | 'aiGenerated'>[] = [
  // Section 1: Client & Stakeholders
  {
    id: 'q1',
    section: 'client_stakeholders',
    question: 'Who is the buyer and who are the key stakeholders? Include sponsor, decision-maker, influencers, and end users.',
    order: 1,
  },

  // Section 2: Business Problem & Goals
  {
    id: 'q2',
    section: 'problem_goals',
    question: 'What business problem is the client trying to solve? Summarize the pain point in business—not just technical—terms.',
    order: 2,
  },
  {
    id: 'q3',
    section: 'problem_goals',
    question: "What are the client's goals and desired outcomes? How will the client measure success? Think in terms of value and impact.",
    order: 3,
  },
  {
    id: 'q4',
    section: 'problem_goals',
    question: 'Why now? What is driving urgency or budget availability? Consider timing, mandates, initiatives, fiscal deadlines, etc.',
    order: 4,
  },

  // Section 3: Partnership & Procurement
  {
    id: 'q5',
    section: 'partnership_procurement',
    question: 'What does the client seek in a partner? Think beyond skills—consider values, collaboration style, industry experience.',
    order: 5,
  },
  {
    id: 'q6',
    section: 'partnership_procurement',
    question: 'What is the procurement process and evaluation criteria? Capture RFP phases, decision criteria, scoring models, and key dates.',
    order: 6,
  },

  // Section 4: Competitive Landscape
  {
    id: 'q7',
    section: 'competitive',
    question: 'Who are our likely competitors and what will they emphasize? Include both direct and indirect competitors.',
    order: 7,
  },
  {
    id: 'q8',
    section: 'competitive',
    question: 'Why would the client choose us? Top 3–4 strengths or differentiators that matter to this client.',
    order: 8,
  },

  // Section 5: Vision & Solution
  {
    id: 'q9',
    section: 'vision_solution',
    question: "What is our vision for the client's future state, and what will success look like? Describe the improved future we want to help the client achieve. Focus on impact, not just outputs. Anchor this in the client's strategic priorities.",
    order: 9,
  },
  {
    id: 'q10',
    section: 'vision_solution',
    question: 'What are the core elements of our solution and how does it make the vision real? Describe the key components of our approach and explain how each one directly supports achieving the envisioned outcomes. Be sure to address "what will make this hard to solve".',
    order: 10,
  },

  // Section 6: Win Themes & Pitch
  {
    id: 'q11',
    section: 'win_themes_pitch',
    question: 'What are our win themes? 3–5 themes that tie together client need, our value, and the competitive edge.',
    order: 11,
  },
  {
    id: 'q12',
    section: 'win_themes_pitch',
    question: 'What is our pitch storyline? Our core narrative: from client problem to vision for success, our unique solution and business value.',
    order: 12,
  },

  // Section 7: Proof Points
  {
    id: 'q13',
    section: 'proof_points',
    question: 'What compelling demos, stories, or artifacts can we showcase? Think: prototypes, accelerators, client success stories, visuals.',
    order: 13,
  },
];

export const PURSUIT_BRIEF_SECTIONS = [
  {
    id: 'client_stakeholders',
    name: 'Client & Stakeholders',
    description: 'Understanding the buyer organization and key decision makers',
    order: 1,
  },
  {
    id: 'problem_goals',
    name: 'Business Problem & Goals',
    description: 'The core challenges and desired outcomes',
    order: 2,
  },
  {
    id: 'partnership_procurement',
    name: 'Partnership & Procurement',
    description: 'What the client seeks and how they evaluate',
    order: 3,
  },
  {
    id: 'competitive',
    name: 'Competitive Landscape',
    description: 'Understanding the competition and our edge',
    order: 4,
  },
  {
    id: 'vision_solution',
    name: 'Vision & Solution',
    description: 'Our envisioned future state and approach',
    order: 5,
  },
  {
    id: 'win_themes_pitch',
    name: 'Win Themes & Pitch',
    description: 'Core differentiators and narrative',
    order: 6,
  },
  {
    id: 'proof_points',
    name: 'Proof Points',
    description: 'Tangible evidence and success stories',
    order: 7,
  },
];

export interface PursuitBriefUpdate {
  question_id: string;
  answer: string;
  confidence?: 'low' | 'medium' | 'high';
  sources?: string[];
}

export interface GenerateProposalRequest {
  pursuit_brief_id: string;
  format?: 'markdown' | 'html' | 'docx';
  include_case_studies?: boolean;
  include_pricing?: boolean;
}

export interface GenerateProposalResponse {
  success: boolean;
  proposal: string;
  format: string;
  generated_at: string;
}
