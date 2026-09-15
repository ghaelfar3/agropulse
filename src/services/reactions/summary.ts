import type { ReactionSummary } from '@/types/reactions';

type ReactionRow = { reaction_type_id: number; user_id: string };
type ActiveType = { id: number; code: string; name: string };

/**
 * Клиентские подписи типов реакций: имена в справочнике задаёт бэк, а UI хочет
 * свои формулировки. Ключ — `reaction_types.code`.
 */
const REACTION_NAME_OVERRIDES: Record<string, string> = {
  same: 'Аналогично',
};

/**
 * Свести сырые строки `post_reactions` (из встроенного select ленты) к массиву
 * `ReactionSummary` — по одному элементу на активный тип, в порядке справочника.
 */
export function summarizeReactions(
  rows: ReactionRow[],
  activeTypes: ActiveType[],
  viewerId: string | undefined,
): ReactionSummary[] {
  return activeTypes.map((type) => {
    const forType = rows.filter((row) => row.reaction_type_id === type.id);
    return {
      code: type.code,
      name: REACTION_NAME_OVERRIDES[type.code] ?? type.name,
      count: forType.length,
      mine: viewerId ? forType.some((row) => row.user_id === viewerId) : false,
    };
  });
}

/** `code` реакции, которую поставил текущий пользователь, либо `null`. */
export function myReactionCode(summaries: ReactionSummary[]): string | null {
  return summaries.find((s) => s.mine)?.code ?? null;
}

/**
 * Оптимистичный тоггл: тап по `code`. Если этот тип уже стоял — снимаем
 * (`nextCode === null`), иначе переключаемся на него. Возвращает новый массив
 * сводок и коды для `setPostReaction`.
 */
export function toggleReactionSummary(
  reactions: ReactionSummary[],
  code: string,
): { next: ReactionSummary[]; previousCode: string | null; nextCode: string | null } {
  const previousCode = myReactionCode(reactions);
  const nextCode = previousCode === code ? null : code;

  const next = reactions.map((reaction) => {
    const willBeMine = reaction.code === nextCode;
    if (reaction.mine === willBeMine) return reaction;
    return {
      ...reaction,
      mine: willBeMine,
      count: Math.max(0, reaction.count + (willBeMine ? 1 : -1)),
    };
  });

  return { next, previousCode, nextCode };
}
