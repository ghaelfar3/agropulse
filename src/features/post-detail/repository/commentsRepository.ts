import { supabase } from '@/services/supabase';

/**
 * Комментарии к посту — таблица `answers` (включая ответы на ответы).
 * Голоса — `answer_votes` (одна строка на `(answer_id, user_id)`, value ∈ {-1, 1}).
 * RLS: писать/править/удалять комментарий и свой голос может только автор.
 */

const commentSelect = `
  id,
  body,
  created_at,
  updated_at,
  author_id,
  parent_answer_id,
  profiles!answers_author_id_fkey (
    name,
    avatar_path
  ),
  answer_votes (
    user_id,
    value
  )
`;

export type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  parent_answer_id: string | null;
  profiles: { name: string | null; avatar_path: string | null } | null;
  answer_votes: { user_id: string; value: number }[];
};

export async function listComments(postId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from('answers')
    .select(commentSelect)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return data as unknown as CommentRow[];
}

export async function addComment(
  postId: string,
  authorId: string,
  body: string,
  parentAnswerId: string | null = null,
): Promise<void> {
  const { error } = await supabase
    .from('answers')
    .insert({ post_id: postId, author_id: authorId, body: body.trim(), parent_answer_id: parentAnswerId });
  if (error) throw error;
}

export async function updateComment(id: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('answers')
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('answers').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Поставить / сменить / снять голос. Уникальна пара `(answer_id, user_id)`,
 * поэтому переключение — это удаление прежней строки и вставка новой.
 */
export async function setAnswerVote(params: {
  answerId: string;
  userId: string;
  value: -1 | 1 | null;
}): Promise<void> {
  const { answerId, userId, value } = params;

  const del = await supabase
    .from('answer_votes')
    .delete()
    .eq('answer_id', answerId)
    .eq('user_id', userId);
  if (del.error) throw del.error;

  if (value === null) return;

  const ins = await supabase
    .from('answer_votes')
    .insert({ answer_id: answerId, user_id: userId, value });
  if (ins.error) throw ins.error;
}
