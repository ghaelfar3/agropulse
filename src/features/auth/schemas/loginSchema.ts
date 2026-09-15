import { z } from 'zod';

/**
 * Схема формы входа. Одно описание даёт и валидацию (`safeParse`), и тип
 * (`z.infer`). Сообщения — по-русски, показываются под полями.
 */
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Введите email').email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const loginDefaults: LoginFormValues = { email: '', password: '' };
