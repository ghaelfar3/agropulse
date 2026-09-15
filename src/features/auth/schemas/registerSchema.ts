import { z } from 'zod';

import { isKnownRegion } from '@/constants/regions';

/**
 * Схема мастера регистрации (все 3 шага в одном объекте). Каждый шаг валидирует
 * только свои поля через `trigger(REGISTER_STEP_FIELDS.x)` перед переходом.
 *
 * Поля шага «О себе» повторяют колонки таблицы `profiles` (name / specialization
 * / region) — своих колонок под имя-фамилию-никнейм в схеме БД нет.
 */
export const registerSchema = z
  .object({
    email: z.string().trim().min(1, 'Введите email').email('Некорректный email'),
    name: z.string().trim().min(1, 'Введите имя'),
    specialization: z.string().trim().min(1, 'Укажите специализацию'),
    region: z
      .string()
      .min(1, 'Укажите регион')
      .refine((value): boolean => isKnownRegion(value), { message: 'Укажите регион' }),
    password: z.string().min(6, 'Минимум 6 символов'),
    confirmPassword: z.string().min(1, 'Повторите пароль'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Пароли не совпадают',
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const registerDefaults: RegisterFormValues = {
  email: '',
  name: '',
  specialization: '',
  region: '',
  password: '',
  confirmPassword: '',
};

export const REGISTER_STEP_FIELDS = {
  email: ['email'],
  profile: ['name', 'specialization', 'region'],
  password: ['password', 'confirmPassword'],
} as const satisfies Record<string, readonly (keyof RegisterFormValues)[]>;
