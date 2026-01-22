import type { Context } from '@netlify/functions';
import { supabase, jsonResponse, handleCors, errorResponse } from './lib/supabase';
import type { JudgmentSubmitRequest, JudgmentSubmitResponse } from './lib/types';

export default async function handler(req: Request, _context: Context) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: JudgmentSubmitRequest = await req.json();

    if (!body.responses || !Array.isArray(body.responses) || body.responses.length === 0) {
      return errorResponse('Invalid request: responses array required', 400);
    }

    // Validate ratings are in range 1-5
    for (const response of body.responses) {
      const { appropriate, professional, trust, discipline } = response.ratings;
      if ([appropriate, professional, trust, discipline].some(r => r < 1 || r > 5)) {
        return errorResponse('Invalid rating: all values must be between 1 and 5', 400);
      }
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();
    const scenarioIds = body.responses.map(r => r.scenarioId);

    // Insert session
    const { error: sessionError } = await supabase
      .from('judgment_sessions')
      .insert({
        id: sessionId,
        scenario_ids: scenarioIds,
      });

    if (sessionError) {
      console.error('Session insert error:', sessionError);
      return errorResponse('Failed to save session', 500);
    }

    // Insert individual responses
    const responsesToInsert = body.responses.map(r => ({
      session_id: sessionId,
      scenario_id: r.scenarioId,
      appropriate: r.ratings.appropriate,
      professional: r.ratings.professional,
      trust: r.ratings.trust,
      discipline: r.ratings.discipline,
    }));

    const { error: responsesError } = await supabase
      .from('judgment_responses')
      .insert(responsesToInsert);

    if (responsesError) {
      console.error('Responses insert error:', responsesError);
      return errorResponse('Failed to save responses', 500);
    }

    // Calculate comparison data
    const comparison = await calculateComparison(scenarioIds);

    // Get total visitor count
    const { count: totalVisitors } = await supabase
      .from('judgment_sessions')
      .select('*', { count: 'exact', head: true });

    const response: JudgmentSubmitResponse = {
      sessionId,
      totalVisitors: totalVisitors || 0,
      comparison,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Error processing request:', error);
    return errorResponse('Internal server error', 500);
  }
}

async function calculateComparison(scenarioIds: string[]) {
  // Get all responses for the relevant scenarios
  const { data: responses, error } = await supabase
    .from('judgment_responses')
    .select('scenario_id, appropriate, professional, trust, discipline')
    .in('scenario_id', scenarioIds);

  if (error || !responses) {
    console.error('Error fetching responses:', error);
    return getEmptyComparison(scenarioIds);
  }

  // Calculate per-scenario means
  const perScenario: Record<string, {
    visitorMeans: { appropriate: number; professional: number; trust: number; discipline: number };
    responseCount: number;
  }> = {};

  const scenarioTotals: Record<string, {
    appropriate: number;
    professional: number;
    trust: number;
    discipline: number;
    count: number;
  }> = {};

  for (const response of responses) {
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
      visitorMeans: {
        appropriate: totals.count > 0 ? totals.appropriate / totals.count : 0,
        professional: totals.count > 0 ? totals.professional / totals.count : 0,
        trust: totals.count > 0 ? totals.trust / totals.count : 0,
        discipline: totals.count > 0 ? totals.discipline / totals.count : 0,
      },
      responseCount: totals.count,
    };
  }

  // Calculate overall means across all relevant scenarios
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

  return {
    perScenario,
    overall: {
      appropriate: overallTotals.count > 0 ? overallTotals.appropriate / overallTotals.count : 0,
      professional: overallTotals.count > 0 ? overallTotals.professional / overallTotals.count : 0,
      trust: overallTotals.count > 0 ? overallTotals.trust / overallTotals.count : 0,
      discipline: overallTotals.count > 0 ? overallTotals.discipline / overallTotals.count : 0,
    },
  };
}

function getEmptyComparison(scenarioIds: string[]) {
  const perScenario: Record<string, {
    visitorMeans: { appropriate: number; professional: number; trust: number; discipline: number };
    responseCount: number;
  }> = {};

  for (const scenarioId of scenarioIds) {
    perScenario[scenarioId] = {
      visitorMeans: { appropriate: 0, professional: 0, trust: 0, discipline: 0 },
      responseCount: 0,
    };
  }

  return {
    perScenario,
    overall: { appropriate: 0, professional: 0, trust: 0, discipline: 0 },
  };
}
