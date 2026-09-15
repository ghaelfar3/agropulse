import type {
  AiTokenUsage,
  FormattedObservation,
  OfflineObservation,
} from './offlineObservations';

const KIE_API_KEY = process.env.EXPO_PUBLIC_KIE_API_KEY;
const KIE_API_BASE_URL =
  process.env.EXPO_PUBLIC_KIE_API_BASE_URL ?? 'https://api.kie.ai';
const KIE_CHAT_PATH =
  process.env.EXPO_PUBLIC_KIE_CHAT_PATH ??
  '/gemini-3-7-flash-openai/v1/chat/completions';
const AI_REQUEST_TIMEOUT_MS = 60_000;

export type FormatObservationResult = {
  formatted: FormattedObservation;
  usage: AiTokenUsage | null;
};

export async function formatObservationWithAi(
  observation: OfflineObservation,
): Promise<FormatObservationResult> {
  if (!KIE_API_KEY || KIE_API_KEY.startsWith('your-')) {
    throw new Error('Добавьте EXPO_PUBLIC_KIE_API_KEY в .env и перезапустите Expo.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${KIE_API_BASE_URL}${KIE_CHAT_PATH}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_tokens: 700,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Ты агрономический редактор. Превращай полевую заметку в аккуратную SOS-карточку. Не ставь диагноз как факт. Пиши по-русски, коротко и прикладно.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: buildPrompt(observation),
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'agro_sos_observation',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                body: { type: 'string' },
                crop: { type: ['string', 'null'] },
                fieldName: { type: ['string', 'null'] },
                symptoms: {
                  type: 'array',
                  items: { type: 'string' },
                },
                affectedAreaPercent: { type: ['number', 'null'] },
                urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
                questionsForAgronomists: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: [
                'title',
                'body',
                'crop',
                'fieldName',
                'symptoms',
                'affectedAreaPercent',
                'urgency',
                'questionsForAgronomists',
              ],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `KIE AI вернул ошибку ${response.status}`);
    }

    const data = (await response.json()) as KieChatResponse;
    return {
      formatted: normalizeFormattedObservation(readAssistantContent(data)),
      usage: readUsage(data),
    };
  } catch (cause) {
    if (isAbortError(cause)) {
      throw new Error('KIE AI не ответил за 60 секунд. Проверьте интернет или попробуйте позже.');
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(observation: OfflineObservation): string {
  const lines = [
    'Оформи эту заметку в SOS-карточку для агрономов.',
    '',
    `Сырая заметка: ${observation.note || 'нет текстовой заметки'}`,
    `Дата: ${observation.createdAt}`,
  ];

  if (observation.location) {
    lines.push(
      `GPS: ${observation.location.latitude}, ${observation.location.longitude}`,
    );
  } else {
    lines.push('GPS: не сохранён');
  }

  lines.push(
    '',
    'Верни JSON. В body обязательно добавь блоки: что заметили, данные наблюдения, возможные направления проверки, что спросить у агрономов. Возможные направления проверки формулируй как гипотезы, не как диагноз.',
  );

  return lines.join('\n');
}

type KieChatResponse = {
  choices?: {
    message?: {
      content?: unknown;
    };
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
};

function readAssistantContent(data: KieChatResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (
          typeof part === 'object' &&
          part !== null &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          return part.text;
        }
        return '';
      })
      .join('');
  }
  throw new Error('KIE AI вернул пустой ответ.');
}

function readUsage(data: KieChatResponse): AiTokenUsage | null {
  const usage = data.usage;
  if (!usage) return null;
  const inputTokens = numberOrNull(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = numberOrNull(usage.completion_tokens ?? usage.output_tokens);
  const totalTokens = numberOrNull(usage.total_tokens);

  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return null;
  }

  return { inputTokens, outputTokens, totalTokens };
}

function normalizeFormattedObservation(raw: string): FormattedObservation {
  const parsed = JSON.parse(stripJsonFence(raw)) as Partial<FormattedObservation>;
  return {
    title: text(parsed.title) || 'SOS: проблема в поле',
    body: text(parsed.body) || 'Нужно определить проблему по фото и заметке.',
    crop: text(parsed.crop) || null,
    fieldName: text(parsed.fieldName) || null,
    symptoms: Array.isArray(parsed.symptoms)
      ? parsed.symptoms.map(text).filter(Boolean)
      : [],
    affectedAreaPercent:
      typeof parsed.affectedAreaPercent === 'number'
        ? parsed.affectedAreaPercent
        : null,
    urgency:
      parsed.urgency === 'low' ||
      parsed.urgency === 'medium' ||
      parsed.urgency === 'high'
        ? parsed.urgency
        : 'medium',
    questionsForAgronomists: Array.isArray(parsed.questionsForAgronomists)
      ? parsed.questionsForAgronomists.map(text).filter(Boolean)
      : [],
  };
}

function stripJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError';
}
