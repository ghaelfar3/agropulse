import { z } from 'zod';

import { isKnownRegion } from '@/constants/regions';

/**
 * Схема формы нового поля. Одно описание даёт и валидацию, и тип.
 * `name` в БД `not null`, поэтому обязателен и здесь; `region` необязателен —
 * пустая строка означает «не указан», иначе значение должно быть из списка
 * регионов РФ (см. `RegionSelect`).
 */
export const fieldSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Минимум 2 символа')
    .max(60, 'Не длиннее 60 символов'),
  region: z
    .string()
    .refine((value): boolean => value === '' || isKnownRegion(value), {
      message: 'Выберите регион из списка',
    }),
  cropId: z.number().int().positive().nullable(),
  stageId: z.number().int().positive().nullable(),
});

export type FieldFormValues = z.infer<typeof fieldSchema>;

/**
 * Значения по умолчанию. Имя подставляем готовое — человек, только что
 * обведший контур, хочет нажать «Сохранить», а не придумывать название.
 * Регион берём из профиля: он там уже указан, незачем спрашивать снова —
 * но только если это регион из текущего списка, иначе оставляем пустым.
 */
export function fieldDefaults(fieldCount: number, region: string | null): FieldFormValues {
  return {
    name: `Поле ${fieldCount + 1}`,
    region: isKnownRegion(region) ? region : '',
    cropId: null,
    stageId: null,
  };
}
