import type { Context } from '@netlify/functions';
import { supabase, jsonResponse, handleCors, errorResponse } from './lib/supabase';
import type { JudgmentStatsResponse } from './lib/types';

export default async function handler(req: Request, _context: Context) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Get total sessions count
    const { count: totalSessions } = await supabase
      .from('judgment_sessions')
      .select('*', { count: 'exact', head: true });

    // Get all responses
    const { data: responses, error } = await supabase
      .from('judgment_responses')
      .select('scenario_id, appropriate, professional, trust, discipline');

    if (error) {
      console.error('Error fetching responses:', error);
      return errorResponse('Failed to fetch statistics', 500);
    }

    const totalResponses = responses?.length || 0;

    // Calculate per-scenario means
    const perScenario: Record<string, {
      means: { appropriate: number; professional: number; trust: number; discipline: number };
      responseCount: number;
    }> = {};

    const scenarioTotals: Record<string, {
      appropriate: number;
      professional: number;
      trust: number;
      discipline: number;
      count: number;
    }> = {};

    for (const response of responses || []) {
      if (!scenarioTotals[response.scenario_id]) {
        scenarioTotals[response.scenario_id] = {
          appropriate: 0,
          professional: 0,
          trust: 0,
          discipline: 0,
          count: 0,
        };
      }
      const totals = scenarioTotals[response.scenario_id];
      totals.appropriate += response.appropriate;
      totals.professional += response.professional;
      totals.trust += response.trust;
      totals.discipline += response.discipline;
      totals.count++;
    }

    for (const [scenarioId, totals] of Object.entries(scenarioTotals)) {
      perScenario[scenarioId] = {
        means: {
          appropriate: totals.count > 0 ? totals.appropriate / totals.count : 0,
          professional: totals.count > 0 ? totals.professional / totals.count : 0,
          trust: totals.count > 0 ? totals.trust / totals.count : 0,
          discipline: totals.count > 0 ? totals.discipline / totals.count : 0,
        },
        responseCount: totals.count,
      };
    }

    // Calculate overall means
    const overallTotals = {
      appropriate: 0,
      professional: 0,
      trust: 0,
      discipline: 0,
      count: 0,
    };

    for (const totals of Object.values(scenarioTotals)) {
      overallTotals.appropriate += totals.appropriate;
      overallTotals.professional += totals.professional;
      overallTotals.trust += totals.trust;
      overallTotals.discipline += totals.discipline;
      overallTotals.count += totals.count;
    }

    const response: JudgmentStatsResponse = {
      totalSessions: totalSessions || 0,
      totalResponses,
      perScenario,
      overall: {
        appropriate: overallTotals.count > 0 ? overallTotals.appropriate / overallTotals.count : 0,
        professional: overallTotals.count > 0 ? overallTotals.professional / overallTotals.count : 0,
        trust: overallTotals.count > 0 ? overallTotals.trust / overallTotals.count : 0,
        discipline: overallTotals.count > 0 ? overallTotals.discipline / overallTotals.count : 0,
      },
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Error processing request:', error);
    return errorResponse('Internal server error', 500);
  }
}
