import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'agro-sos:offline-observations:v1';

export type OfflineObservation = {
  id: string;
  photoUri: string;
  note: string;
  formatted: FormattedObservation | null;
  ai: OfflineObservationAi | null;
  createdAt: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null;
};

export type OfflineObservationAi = {
  formattedAt: string;
  usage: AiTokenUsage | null;
};

export type AiTokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type FormattedObservation = {
  title: string;
  body: string;
  crop: string | null;
  fieldName: string | null;
  symptoms: string[];
  affectedAreaPercent: number | null;
  urgency: 'low' | 'medium' | 'high';
  questionsForAgronomists: string[];
};

export async function getOfflineObservations(): Promise<OfflineObservation[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isObservation) : [];
  } catch {
    return [];
  }
}

export async function saveOfflineObservation(
  observation: OfflineObservation,
): Promise<OfflineObservation[]> {
  const current = await getOfflineObservations();
  const next = [observation, ...current];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeOfflineObservation(
  id: string,
): Promise<OfflineObservation[]> {
  const current = await getOfflineObservations();
  const next = current.filter((item) => item.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function updateOfflineObservation(
  id: string,
  patch: Partial<OfflineObservation>,
): Promise<OfflineObservation[]> {
  const current = await getOfflineObservations();
  const next = current.map((item) =>
    item.id === id ? { ...item, ...patch, id: item.id } : item,
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function isObservation(value: unknown): value is OfflineObservation {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<OfflineObservation>;
  return (
    typeof item.id === 'string' &&
    typeof item.photoUri === 'string' &&
    typeof item.note === 'string' &&
    typeof item.createdAt === 'string' &&
    (item.formatted === undefined ||
      item.formatted === null ||
      isFormattedObservation(item.formatted)) &&
    (item.ai === undefined || item.ai === null || isObservationAi(item.ai)) &&
    (item.location === null ||
      (typeof item.location === 'object' &&
        item.location !== null &&
        typeof item.location.latitude === 'number' &&
        typeof item.location.longitude === 'number'))
  );
}

function isFormattedObservation(value: unknown): value is FormattedObservation {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<FormattedObservation>;
  return (
    typeof item.title === 'string' &&
    typeof item.body === 'string' &&
    Array.isArray(item.symptoms) &&
    item.symptoms.every((symptom) => typeof symptom === 'string') &&
    (item.urgency === 'low' || item.urgency === 'medium' || item.urgency === 'high') &&
    Array.isArray(item.questionsForAgronomists) &&
    item.questionsForAgronomists.every((question) => typeof question === 'string')
  );
}

function isObservationAi(value: unknown): value is OfflineObservationAi {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<OfflineObservationAi>;
  return (
    typeof item.formattedAt === 'string' &&
    (item.usage === null || item.usage === undefined || isAiTokenUsage(item.usage))
  );
}

function isAiTokenUsage(value: unknown): value is AiTokenUsage {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<AiTokenUsage>;
  return (
    (item.inputTokens === null || typeof item.inputTokens === 'number') &&
    (item.outputTokens === null || typeof item.outputTokens === 'number') &&
    (item.totalTokens === null || typeof item.totalTokens === 'number')
  );
}
