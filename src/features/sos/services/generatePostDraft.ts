import { File } from 'expo-file-system';

import { supabase } from '@/services/supabase';
import type { Json } from '@/types/database.types';

const VOICE_DRAFTS_BUCKET = 'voice-drafts';
const VOICE_DRAFTS_FUNCTION = 'generate-post-draft';

export type GeneratePostDraftRequest = {
  text?: string;
  audio_path?: string;
  field_id?: string | null;
};

export type DictionaryRef = {
  id: number;
  code: string;
  name: string;
};

export type GeneratePostDraftResponse = {
  transcript: string | null;
  draft: {
    field_id: string | null;
    post_type_id: number | null;
    stage_id: number | null;
    status_id: number | null;
    title: string;
    body: string;
  };
  display: {
    field_name: string | null;
    field_region: string | null;
    crop: { id: Json; slug: Json; name: Json } | null;
    post_type: DictionaryRef | null;
    stage: DictionaryRef | null;
    status: DictionaryRef | null;
  };
  confidence: {
    transcription: number | null;
    field: number;
    stage: number;
    post_type: number;
  };
  missing: Array<'field_id' | 'stage_id'>;
  warnings: string[];
  meta: {
    request_id: string;
    input_mode?: 'text' | 'audio' | 'text_and_audio';
    ai_used: boolean;
    provider: 'kie.ai';
    model: 'gemini-3-5-flash-thinking' | 'gemini-3.5-flash-thinking';
    prompt_version: number;
    latency_ms: number | null;
    usage: Json | null;
    response_id: string | null;
  };
};

export async function generatePostDraft(
  request: GeneratePostDraftRequest,
): Promise<GeneratePostDraftResponse> {
  const text = request.text?.trim() ?? '';
  const audioPath = request.audio_path?.trim() ?? '';
  if (!text && !audioPath) {
    throw new Error('Сначала запишите аудио или введите описание проблемы.');
  }

  debugVoiceDraft('invoke:start', {
    function: VOICE_DRAFTS_FUNCTION,
    hasText: Boolean(text),
    hasAudioPath: Boolean(audioPath),
    hasFieldId: Boolean(request.field_id),
  });

  const { data, error } = await supabase.functions.invoke<GeneratePostDraftResponse>(
    VOICE_DRAFTS_FUNCTION,
    {
      body: {
        ...(text ? { text } : {}),
        ...(audioPath ? { audio_path: audioPath } : {}),
        field_id: request.field_id ?? null,
      },
    },
  );

  if (error) {
    const message = await readFunctionErrorMessage(error);
    debugVoiceDraft('invoke:error', {
      function: VOICE_DRAFTS_FUNCTION,
      message,
    });
    throw new Error(`Ошибка ${VOICE_DRAFTS_FUNCTION}: ${message}`);
  }
  if (!data) throw new Error('Бэк вернул пустой черновик.');
  debugVoiceDraft('invoke:success', {
    requestId: data.meta.request_id,
    inputMode: data.meta.input_mode,
    hasTranscript: Boolean(data.transcript),
    warnings: data.warnings,
  });
  return data;
}

export async function generatePostDraftFromAudio(
  recordingUri: string,
  userId: string,
  fieldId?: string | null,
): Promise<GeneratePostDraftResponse> {
  const path = `${userId}/${makeDraftAudioId()}.m4a`;
  let audio: ArrayBuffer;
  try {
    audio = await new File(recordingUri).arrayBuffer();
  } catch (cause) {
    throw new Error(`Не удалось прочитать аудио с телефона: ${readErrorMessage(cause)}`);
  }

  debugVoiceDraft('upload:start', {
    bucket: VOICE_DRAFTS_BUCKET,
    path,
    bytes: audio.byteLength,
    contentType: 'audio/mp4',
  });

  const { error: uploadError } = await supabase.storage
    .from(VOICE_DRAFTS_BUCKET)
    .upload(path, audio, {
      contentType: 'audio/mp4',
      upsert: false,
    });

  if (uploadError) {
    debugVoiceDraft('upload:error', {
      bucket: VOICE_DRAFTS_BUCKET,
      path,
      message: readErrorMessage(uploadError),
    });
    throw new Error(`Ошибка voice-drafts upload: ${readErrorMessage(uploadError)}`);
  }
  debugVoiceDraft('upload:success', { bucket: VOICE_DRAFTS_BUCKET, path });

  try {
    return await generatePostDraft({
      audio_path: path,
      field_id: fieldId ?? null,
    });
  } finally {
    await supabase.storage
      .from(VOICE_DRAFTS_BUCKET)
      .remove([path])
      .then(({ error }) => {
        debugVoiceDraft(error ? 'cleanup:error' : 'cleanup:success', {
          bucket: VOICE_DRAFTS_BUCKET,
          path,
          message: error ? readErrorMessage(error) : undefined,
        });
      })
      .catch((cause) => {
        debugVoiceDraft('cleanup:error', {
          bucket: VOICE_DRAFTS_BUCKET,
          path,
          message: readErrorMessage(cause),
        });
      });
  }
}

function makeDraftAudioId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return 'неизвестная ошибка';
}

async function readFunctionErrorMessage(error: unknown): Promise<string> {
  const response = readErrorResponse(error);
  if (!response) return readErrorMessage(error);

  const status = response.status;
  const raw = await response
    .clone()
    .text()
    .catch(() => '');
  if (!raw) return `${readErrorMessage(error)}; HTTP ${status}`;

  try {
    const parsed = JSON.parse(raw) as {
      error?: unknown;
      code?: unknown;
      request_id?: unknown;
      warnings?: unknown;
    };
    const parts = [
      typeof parsed.error === 'string' ? parsed.error : null,
      typeof parsed.code === 'string' ? parsed.code : null,
      Array.isArray(parsed.warnings) ? `warnings: ${parsed.warnings.join(', ')}` : null,
      typeof parsed.request_id === 'string' ? `request_id: ${parsed.request_id}` : null,
      `HTTP ${status}`,
    ].filter(Boolean);
    return parts.join('; ');
  } catch {
    return `${raw.slice(0, 300)}; HTTP ${status}`;
  }
}

function readErrorResponse(error: unknown): Response | null {
  if (typeof error !== 'object' || error === null || !('context' in error)) {
    return null;
  }
  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context : null;
}

function debugVoiceDraft(event: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production') return;
  console.log(`[voice-draft] ${event}`, payload);
}
