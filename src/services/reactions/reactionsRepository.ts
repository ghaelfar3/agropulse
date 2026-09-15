import { dictionaries, supabase } from '@/services/supabase';

/**
 * Поставить / снять реакцию на пост. Реакция эксклюзивна: одновременно у
 * пользователя на посте не больше одного типа, поэтому переход `previous → next`
 * — это удаление прежней строки и вставка новой.
 *
 * `previous` / `next` — `code` из справочника `reaction_types` либо `null`
 * (нет реакции). Маппинг ошибок — в вызывающем хуке.
 */
export async function setPostReaction(params: {
  postId: string;
  userId: string;
  previous: string | null;
  next: string | null;
}): Promise<void> {
  const { postId, userId, previous, next } = params;
  if (previous === next) return;

  const types = await dictionaries.getActiveReactionTypes();
  const idByCode = (code: string): number => {
    const type = types.find((t) => t.code === code);
    if (!type) throw new Error('Неизвестный тип реакции');
    return type.id;
  };

  if (previous) {
    const { error } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('reaction_type_id', idByCode(previous));
    if (error) throw error;
  }

  if (next) {
    const { error } = await supabase.from('post_reactions').insert({
      post_id: postId,
      user_id: userId,
      reaction_type_id: idByCode(next),
    });
    if (error) throw error;
  }
}
