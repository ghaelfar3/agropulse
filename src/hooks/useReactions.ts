import { useCallback, useState } from 'react';

import { setPostReaction } from '@/services/reactions';
import { toUserMessage } from '@/services/supabase';

let reactionVersion = 0;
export function getReactionVersion() { return reactionVersion; }

type SetReactionParams = {
  postId: string;
  userId: string;
  previous: string | null;
  next: string | null;
};

/**
 * Тоггл реакции на пост. Хук только дёргает репозиторий и приводит ошибку к
 * человекочитаемому тексту (через `throw`). Оптимистичное обновление списка и
 * откат при ошибке делает экран — так один хук обслуживает и ленту, и PostDetail.
 */
export function useReactions() {
  const [pending, setPending] = useState(false);

  const setReaction = useCallback(async (params: SetReactionParams) => {
    setPending(true);
    try {
      await setPostReaction(params);
      reactionVersion++;
    } catch (cause) {
      throw new Error(toUserMessage(cause));
    } finally {
      setPending(false);
    }
  }, []);

  return { setReaction, pending };
}
