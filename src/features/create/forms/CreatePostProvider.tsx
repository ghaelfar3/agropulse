import type { LocalDraft } from '@/features/drafts/draftStorage';

import { createContext, useContext, type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  createPostDefaults,
  createPostSchema,
  type CreatePostFormValues,
} from '../schemas/createPostSchema';

type CreatePostMeta = {
  /** id редактируемого поста; `null` — режим создания. */
  postId: string | null;
  localDraft?: LocalDraft;
};

const CreatePostMetaContext = createContext<CreatePostMeta>({ postId: null });

/** Режим мастера: создание или редактирование конкретного поста. */
export function useCreatePostMeta(): CreatePostMeta {
  return useContext(CreatePostMetaContext);
}

type Props = {
  children: ReactNode;
  /** Предзаполнение для режима редактирования. */
  initialValues?: Partial<CreatePostFormValues>;
  /** id поста — включает режим редактирования (submit → update). */
  postId?: string | null;
  localDraft?: LocalDraft;
};

/**
 * Один `useForm` на весь мастер. Экраны шагов берут форму через
 * `useFormContext<CreatePostFormValues>()`, а режим — через `useCreatePostMeta()`.
 * Живёт внутри вкладки «Создать» либо внутри экрана `EditPost` в стеке профиля.
 */
export function CreatePostProvider({ children, initialValues, postId = null, localDraft }: Props) {
  const form = useForm<CreatePostFormValues>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { ...createPostDefaults, ...initialValues },
    mode: 'onTouched',
  });

  return (
    <CreatePostMetaContext.Provider value={{ postId, localDraft }}>
      <FormProvider {...form}>{children}</FormProvider>
    </CreatePostMetaContext.Provider>
  );
}
