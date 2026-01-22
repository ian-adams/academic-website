import type { Context } from '@netlify/functions';
import { supabase, jsonResponse, handleCors, errorResponse } from './lib/supabase';
import type { FuckulatorSubmitRequest, FuckulatorSubmitResponse } from './lib/types';

export default async function handler(req: Request, _context: Context) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: FuckulatorSubmitRequest = await req.json();

    if (!body.responses || !Array.isArray(body.responses) || body.responses.length === 0) {
      return errorResponse('Invalid request: responses array required', 400);
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();
    const questionCount = body.responses.length;
    const correctCount = body.responses.filter(r => r.correct).length;
    const scorePercentage = (correctCount / questionCount) * 100;

    // Insert session
    const { error: sessionError } = await supabase
      .from('fuckulator_sessions')
      .insert({
        id: sessionId,
        question_count: questionCount,
        correct_count: correctCount,
        score_percentage: scorePercentage,
      });

    if (sessionError) {
      console.error('Session insert error:', sessionError);
      return errorResponse('Failed to save session', 500);
    }

    // Insert individual responses
    const responsesToInsert = body.responses.map(r => ({
      session_id: sessionId,
      term: r.term,
      correct: r.correct,
    }));

    const { error: responsesError } = await supabase
      .from('fuckulator_responses')
      .insert(responsesToInsert);

    if (responsesError) {
      console.error('Responses insert error:', responsesError);
      return errorResponse('Failed to save responses', 500);
    }

    // Calculate comparison data
    const comparison = await calculateComparison(scorePercentage);

    const response: FuckulatorSubmitResponse = {
      sessionId,
      score: correctCount,
      questionCount,
      scorePercentage,
      comparison,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Error processing request:', error);
    return errorResponse('Internal server error', 500);
  }
}

async function calculateComparison(currentScore: number) {
  // Get all sessions for percentile calculation
  const { data: sessions, error: sessionsError } = await supabase
    .from('fuckulator_sessions')
    .select('score_percentage')
    .order('score_percentage', { ascending: true });

  if (sessionsError || !sessions) {
    console.error('Error fetching sessions:', sessionsError);
    return getEmptyComparison();
  }

  const totalSessions = sessions.length;

  // Calculate percentile (how many scored lower)
  const scoredLower = sessions.filter(s => s.score_percentage < currentScore).length;
  const percentile = totalSessions > 0 ? Math.round((scoredLower / totalSessions) * 100) : 50;

  // Calculate average score
  const averageScore = totalSessions > 0
    ? sessions.reduce((sum, s) => sum + s.score_percentage, 0) / totalSessions
    : 0;

  // Get term difficulty stats
  const { data: termStats, error: termError } = await supabase
    .from('fuckulator_responses')
    .select('term, correct');

  if (termError || !termStats) {
    console.error('Error fetching term stats:', termError);
    return {
      percentile,
      averageScore,
      totalSessions,
      hardestTerms: [],
      easiestTerms: [],
      scoreDistribution: calculateScoreDistribution(sessions),
    };
  }

  // Calculate per-term stats
  const termAccuracy: Record<string, { correct: number; total: number }> = {};
  for (const response of termStats) {
    if (!termAccuracy[response.term]) {
      termAccuracy[response.term] = { correct: 0, total: 0 };
    }
    termAccuracy[response.term].total++;
    if (response.correct) {
      termAccuracy[response.term].correct++;
    }
  }

  const termRates = Object.entries(termAccuracy)
    .map(([term, stats]) => ({
      term,
      correctRate: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      attempts: stats.total,
    }))
    .filter(t => t.attempts >= 3); // Only include terms with at least 3 attempts

  // Sort for hardest (lowest rate) and easiest (highest rate)
  const sortedByDifficulty = [...termRates].sort((a, b) => a.correctRate - b.correctRate);
  const hardestTerms = sortedByDifficulty.slice(0, 5);
  const easiestTerms = [...termRates].sort((a, b) => b.correctRate - a.correctRate).slice(0, 5);

  return {
    percentile,
    averageScore,
    totalSessions,
    hardestTerms,
    easiestTerms,
    scoreDistribution: calculateScoreDistribution(sessions),
  };
}

function calculateScoreDistribution(sessions: Array<{ score_percentage: number }>) {
  // Create 10 buckets: 0-10%, 10-20%, etc.
  const buckets = [
    { bucket: '0-10%', count: 0 },
    { bucket: '10-20%', count: 0 },
    { bucket: '20-30%', count: 0 },
    { bucket: '30-40%', count: 0 },
    { bucket: '40-50%', count: 0 },
    { bucket: '50-60%', count: 0 },
    { bucket: '60-70%', count: 0 },
    { bucket: '70-80%', count: 0 },
    { bucket: '80-90%', count: 0 },
    { bucket: '90-100%', count: 0 },
  ];

  for (const session of sessions) {
    const index = Math.min(Math.floor(session.score_percentage / 10), 9);
    buckets[index].count++;
  }

  return buckets;
}

function getEmptyComparison() {
  return {
    percentile: 50,
    averageScore: 0,
    totalSessions: 0,
    hardestTerms: [],
    easiestTerms: [],
    scoreDistribution: [],
  };
}
