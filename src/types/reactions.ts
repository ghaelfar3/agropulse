/**
 * Свод по одному типу реакции для поста — то, что рисует `ReactionControl`.
 * Живёт в `types` (а не в сервисе), потому что нужен и сервису реакций,
 * и «глупому» компоненту в `src/components`.
 */
export type ReactionSummary = {
  /** `code` из справочника `reaction_types`. */
  code: string;
  name: string;
  count: number;
  /** Текущий пользователь поставил реакцию этого типа. */
  mine: boolean;
};
