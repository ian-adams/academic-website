import type { Context } from '@netlify/functions';
import { supabase, jsonResponse, handleCors, errorResponse } from './lib/supabase';
import type { CascadeStatsResponse } from './lib/types';

export default async function handler(req: Request, _context: Context) {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Get total sessions
    const { count: totalSessions } = await supabase
      .from('cascade_sessions')
      .select('*', { count: 'exact', head: true });

    // Get all responses for per-case stats
    const { data: responses, error } = await supabase
      .from('cascade_responses')
      .select('case_id, correct');

    if (error) {
      console.error('Error fetching responses:', error);
      return errorResponse('Failed to fetch statistics', 500);
    }

    const totalResponses = responses?.length || 0;

    // Calculate per-case accuracy
    const caseStats: Record<number, { shown: number; correct: number }> = {};
    for (const r of responses || []) {
      if (!caseStats[r.case_id]) {
        caseStats[r.case_id] = { shown: 0, correct: 0 };
      }
      caseStats[r.case_id].shown++;
      if (r.correct) caseStats[r.case_id].correct++;
    }

    const perCase: CascadeStatsResponse['perCase'] = {};
    for (const [caseId, stats] of Object.entries(caseStats)) {
      perCase[Number(caseId)] = {
        timesShown: stats.shown,
        timesCorrect: stats.correct,
        accuracyRate: stats.shown > 0 ? stats.correct / stats.shown : 0,
      };
    }

    // Calculate overall average accuracy
    const { data: sessions } = await supabase
      .from('cascade_sessions')
      .select('total_correct, total_cases');

    let averageAccuracy = 0;
    if (sessions && sessions.length > 0) {
      const totalCorrectAll = sessions.reduce((sum, s) => sum + (s.total_correct || 0), 0);
      const totalCasesAll = sessions.reduce((sum, s) => sum + (s.total_cases || 0), 0);
      averageAccuracy = totalCasesAll > 0 ? totalCorrectAll / totalCasesAll : 0;
    }

    const response: CascadeStatsResponse = {
      totalSessions: totalSessions || 0,
      totalResponses,
      averageAccuracy,
      perCase,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Error processing request:', error);
    return errorResponse('Internal server error', 500);
  }
}
