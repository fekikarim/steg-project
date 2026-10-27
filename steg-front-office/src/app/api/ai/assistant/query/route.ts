import {NextRequest, NextResponse} from 'next/server';
import {ApiError, backendFetch, type ErrorEnvelope} from '@/lib/api-client';
import {accessToken, isUnauthorized} from '@/lib/api/profile-session';

interface AssistantBody {
  question?: unknown;
}

/**
 * Browser-facing proxy for `POST /api/ai/assistant/query` (STEG RAG assistant).
 * The Gemini key never leaves Spring Boot: the browser posts a question here,
 * Next.js attaches the session token server-side, and the backend retrieves
 * the controlled knowledge-base context before calling Gemini.
 */
export async function POST(req: NextRequest) {
  let question: string;
  try {
    const body = (await req.json()) as AssistantBody;
    if (typeof body.question !== 'string' || body.question.trim().length === 0) {
      return NextResponse.json({message: 'A question is required.'}, {status: 400});
    }
    if (body.question.length > 2000) {
      return NextResponse.json({message: 'Question too long.'}, {status: 413});
    }
    question = body.question.trim();
  } catch {
    return NextResponse.json({message: 'Invalid request.'}, {status: 400});
  }

  let token = await accessToken();
  if (!token) return NextResponse.json({message: 'No session.'}, {status: 401});
  const call = (t: string) =>
    backendFetch<unknown>('/api/ai/assistant/query', {method: 'POST', token: t, body: {question}, timeoutMs: 45000});
  try {
    return NextResponse.json(await call(token));
  } catch (err) {
    if (isUnauthorized(err)) {
      token = await accessToken(true);
      if (!token) return NextResponse.json({message: 'No session.'}, {status: 401});
      try {
        return NextResponse.json(await call(token));
      } catch (err2) {
        return mapError(err2);
      }
    }
    return mapError(err);
  }
}

function mapError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const body: ErrorEnvelope = {
      message: err.message,
      status: err.status,
      error: err.code ?? undefined,
      traceId: err.traceId ?? undefined,
    };
    return NextResponse.json(body, {status: err.status});
  }
  return NextResponse.json({message: 'Unexpected error.'}, {status: 500});
}
