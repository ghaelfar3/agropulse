
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  registerDefaults,
  registerSchema,
  type RegisterFormValues,
} from '../schemas/registerSchema';

/**
 * Один `useForm` на весь мастер регистрации. Все экраны шагов берут форму через
 * `useFormContext<RegisterFormValues>()`. Пересоздаётся при каждом входе в мастер
 * (поля чистые).
 */
export function RegisterFormProvider({ children }: { children: ReactNode }) {
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: registerDefaults,
    mode: 'onTouched',
  });

  return <FormProvider {...form}>{children}</FormProvider>;
}
