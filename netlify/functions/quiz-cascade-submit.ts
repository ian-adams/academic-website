import type { Context } from '@netlify/functions';
import { supabase, jsonResponse, handleCors, errorResponse } from './lib/supabase';
import type { CascadeSubmitRequest, CascadeSubmitResponse } from './lib/types';

export default async function handler(req: Request, _context: Context) {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: CascadeSubmitRequest = await req.json();

    if (!body.responses || !Array.isArray(body.responses) || body.responses.length === 0) {
      return errorResponse('Invalid request: responses array required', 400);
    }

    // Validate responses
    for (const r of body.responses) {
      if (typeof r.caseId !== 'number' || !['survived', 'died'].includes(r.userGuess)) {
        return errorResponse('Invalid response data', 400);
      }
    }

    const sessionId = crypto.randomUUID();

    // Insert session
    const { error: sessionError } = await supabase
      .from('cascade_sessions')
      .insert({
        id: sessionId,
        total_correct: body.totalCorrect,
        total_cases: body.totalCases,
      });

    if (sessionError) {
      console.error('Session insert error:', sessionError);
      return errorResponse('Failed to save session', 500);
    }

    // Insert individual responses
    const responsesToInsert = body.responses.map(r => ({
      session_id: sessionId,
      case_id: r.caseId,
      user_guess: r.userGuess,
      actual_outcome: r.actualOutcome,
      predicted_p_fatal: r.predictedPFatal,
      correct: r.userGuess === r.actualOutcome,
    }));

    const { error: responsesError } = await supabase
      .from('cascade_responses')
      .insert(responsesToInsert);

    if (responsesError) {
      console.error('Responses insert error:', responsesError);
      return errorResponse('Failed to save responses', 500);
    }

    // Get total visitor count
    const { count: totalVisitors } = await supabase
      .from('cascade_sessions')
      .select('*', { count: 'exact', head: true });

    const response: CascadeSubmitResponse = {
      sessionId,
      totalVisitors: totalVisitors || 0,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Error processing request:', error);
    return errorResponse('Internal server error', 500);
  }
}
