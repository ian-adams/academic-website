import type { Context } from '@netlify/functions';
import { supabase, jsonResponse, handleCors, errorResponse } from './lib/supabase';
import type { FuckulatorStatsResponse } from './lib/types';

export default async function handler(req: Request, _context: Context) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Get session statistics
    const { data: sessions, error: sessionsError } = await supabase
      .from('fuckulator_sessions')
      .select('score_percentage');

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return errorResponse('Failed to fetch statistics', 500);
    }

    const totalSessions = sessions?.length || 0;
    const averageScore = totalSessions > 0
      ? sessions.reduce((sum, s) => sum + s.score_percentage, 0) / totalSessions
      : 0;

    // Get term difficulty stats
    const { data: termStats, error: termError } = await supabase
      .from('fuckulator_responses')
      .select('term, correct');

    let hardestTerms: Array<{ term: string; correctRate: number; attempts: number }> = [];
    let easiestTerms: Array<{ term: string; correctRate: number; attempts: number }> = [];

    if (!termError && termStats) {
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
        .filter(t => t.attempts >= 3);

      // Sort for hardest and easiest
      const sortedByDifficulty = [...termRates].sort((a, b) => a.correctRate - b.correctRate);
      hardestTerms = sortedByDifficulty.slice(0, 5);
      easiestTerms = [...termRates].sort((a, b) => b.correctRate - a.correctRate).slice(0, 5);
    }

    // Calculate score distribution
    const scoreDistribution = calculateScoreDistribution(sessions || []);

    const response: FuckulatorStatsResponse = {
      totalSessions,
      averageScore,
      hardestTerms,
      easiestTerms,
      scoreDistribution,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Error processing request:', error);
    return errorResponse('Internal server error', 500);
  }
}

function calculateScoreDistribution(sessions: Array<{ score_percentage: number }>) {
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
