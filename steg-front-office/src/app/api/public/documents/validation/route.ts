import {NextRequest, NextResponse} from 'next/server';
import {ApiError, type ErrorEnvelope} from '@/lib/api-client';
import {validatePublicDocumentAi} from '@/lib/api/application';

function mapError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const body: ErrorEnvelope = {
      message: err.message,
      status: err.status,
      error: err.code ?? undefined,
      fieldErrors: err.fieldErrors,
      traceId: err.traceId ?? undefined,
    };
    return NextResponse.json(body, {status: err.status});
  }
  return NextResponse.json({message: 'Unexpected error.'}, {status: 500});
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const type = form.get('type');
    const fullName = form.get('fullName');
    if (!file || !(file instanceof File) || typeof type !== 'string' || !type) {
      return NextResponse.json({message: 'file and type are required.'}, {status: 400});
    }
    const result = await validatePublicDocumentAi(
      file,
      type as never,
      typeof fullName === 'string' ? fullName : null,
    );
    return NextResponse.json(result);
  } catch (err) {
    return mapError(err);
  }
}
