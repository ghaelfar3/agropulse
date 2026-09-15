import { AuthError } from '@supabase/supabase-js';

const FALLBACK = 'Не удалось выполнить запрос. Проверьте соединение.';

/** Коды supabase-auth (error.code), которые пользователь реально может увидеть. */
const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Неверная почта или пароль.',
  email_not_confirmed: 'Почта не подтверждена. Введите код из письма.',
  otp_expired: 'Код устарел. Запросите новый.',
  otp_disabled: 'Вход по коду отключён на сервере.',
  over_email_send_rate_limit:
    'Слишком много писем. Подождите несколько минут и попробуйте снова.',
  over_request_rate_limit: 'Слишком много попыток. Подождите немного.',
  email_exists: 'Эта почта уже зарегистрирована.',
  user_already_exists: 'Эта почта уже зарегистрирована.',
  weak_password: 'Пароль слишком простой.',
  same_password: 'Новый пароль совпадает со старым.',
  signup_disabled: 'Регистрация временно закрыта.',
  validation_failed: 'Проверьте правильность введённых данных.',
  session_expired: 'Сессия истекла. Войдите заново.',
};

/** SQLSTATE и коды PostgREST. */
const POSTGREST_MESSAGES: Record<string, string> = {
  '23505': 'Такая запись уже существует.',
  '23503': 'Связанная запись не найдена.',
  '23514': 'Данные не прошли проверку на сервере.',
  '42501': 'Недостаточно прав для этого действия.',
  PGRST116: 'Запись не найдена.',
  PGRST301: 'Сессия истекла. Войдите заново.',
};

/**
 * Единственное место, где ошибка Supabase превращается в текст для экрана.
 * Всё неизвестное схлопывается в общий текст — пользователю нельзя показывать
 * ни английские сообщения SDK, ни детали RLS-политик.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];
    // Rate limit встроенного SMTP приходит без стабильного кода.
    if (error.status === 429) return AUTH_MESSAGES.over_request_rate_limit;
    return FALLBACK;
  }

  if (isPostgrestError(error)) {
    return POSTGREST_MESSAGES[error.code] ?? FALLBACK;
  }

  if (error instanceof Error && error.message) {
    // Наши собственные ошибки (кидаем их уже по-русски).
    return error.message;
  }

  return FALLBACK;
}

function isPostgrestError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    'message' in error
  );
}
