// Fuckulator Quiz Types
export interface FuckulatorResponse {
  id?: string;
  session_id: string;
  term: string;
  correct: boolean;
  created_at?: string;
}

export interface FuckulatorSession {
  id?: string;
  question_count: number;
  correct_count: number;
  score_percentage: number;
  created_at?: string;
}

export interface FuckulatorSubmitRequest {
  responses: Array<{
    term: string;
    correct: boolean;
  }>;
}

export interface FuckulatorSubmitResponse {
  sessionId: string;
  score: number;
  questionCount: number;
  scorePercentage: number;
  comparison: {
    percentile: number;
    averageScore: number;
    totalSessions: number;
    hardestTerms: Array<{ term: string; correctRate: number; attempts: number }>;
    easiestTerms: Array<{ term: string; correctRate: number; attempts: number }>;
    scoreDistribution: Array<{ bucket: string; count: number }>;
  };
}

export interface FuckulatorStatsResponse {
  totalSessions: number;
  averageScore: number;
  hardestTerms: Array<{ term: string; correctRate: number; attempts: number }>;
  easiestTerms: Array<{ term: string; correctRate: number; attempts: number }>;
  scoreDistribution: Array<{ bucket: string; count: number }>;
}

// Judgment Quiz Types
export interface JudgmentResponse {
  id?: string;
  session_id: string;
  scenario_id: string;
  appropriate: number;
  professional: number;
  trust: number;
  discipline: number;
  created_at?: string;
}

export interface JudgmentSession {
  id?: string;
  scenario_ids: string[];
  created_at?: string;
}

export interface JudgmentSubmitRequest {
  responses: Array<{
    scenarioId: string;
    ratings: {
      appropriate: number;
      professional: number;
      trust: number;
      discipline: number;
    };
  }>;
}

export interface JudgmentSubmitResponse {
  sessionId: string;
  totalVisitors: number;
  comparison: {
    perScenario: Record<string, {
      visitorMeans: {
        appropriate: number;
        professional: number;
        trust: number;
        discipline: number;
      };
      responseCount: number;
    }>;
    overall: {
      appropriate: number;
      professional: number;
      trust: number;
      discipline: number;
    };
  };
}

export interface JudgmentStatsResponse {
  totalSessions: number;
  totalResponses: number;
  perScenario: Record<string, {
    means: {
      appropriate: number;
      professional: number;
      trust: number;
      discipline: number;
    };
    responseCount: number;
  }>;
  overall: {
    appropriate: number;
    professional: number;
    trust: number;
    discipline: number;
  };
}

// Killing Cascade Quiz Types
export interface CascadeSubmitRequest {
  responses: Array<{
    caseId: number;
    userGuess: 'survived' | 'died';
    actualOutcome: 'survived' | 'died';
    predictedPFatal: number;
  }>;
  totalCorrect: number;
  totalCases: number;
}

export interface CascadeSubmitResponse {
  sessionId: string;
  totalVisitors: number;
}

export interface CascadeStatsResponse {
  totalSessions: number;
  totalResponses: number;
  averageAccuracy: number;
  perCase: Record<number, {
    timesShown: number;
    timesCorrect: number;
    accuracyRate: number;
  }>;
}
