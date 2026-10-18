import type { TacticalState, TacticalTransitionRule } from "./TacticalStateTypes";

/**
 * Allowed transition rules for the tactical AI state machine.
 */
export const TACTICAL_TRANSITION_RULES: readonly TacticalTransitionRule[] = [
  { from: "Idle", to: "Support" },
  { from: "Idle", to: "Attack" },
  { from: "Idle", to: "Defend" },
  { from: "Idle", to: "Mark" },
  { from: "Idle", to: "Press" },
  { from: "Idle", to: "Recover" },
  { from: "Idle", to: "Transition" },

  { from: "Support", to: "Attack" },
  { from: "Support", to: "Defend" },
  { from: "Support", to: "Overlap" },
  { from: "Support", to: "Underlap" },
  { from: "Support", to: "Transition" },
  { from: "Support", to: "Recover" },
  { from: "Support", to: "Idle" },

  { from: "Attack", to: "Support" },
  { from: "Attack", to: "CounterAttack" },
  { from: "Attack", to: "Defend" },
  { from: "Attack", to: "Transition" },
  { from: "Attack", to: "Recover" },
  { from: "Attack", to: "Idle" },

  { from: "Defend", to: "Mark" },
  { from: "Defend", to: "Press" },
  { from: "Defend", to: "Recover" },
  { from: "Defend", to: "CounterAttack" },
  { from: "Defend", to: "Transition" },
  { from: "Defend", to: "Idle" },

  { from: "Mark", to: "Defend" },
  { from: "Mark", to: "Press" },
  { from: "Mark", to: "Recover" },
  { from: "Mark", to: "Transition" },
  { from: "Mark", to: "Idle" },

  { from: "Press", to: "Defend" },
  { from: "Press", to: "Mark" },
  { from: "Press", to: "Recover" },
  { from: "Press", to: "CounterAttack" },
  { from: "Press", to: "Transition" },
  { from: "Press", to: "Idle" },

  { from: "Recover", to: "Defend" },
  { from: "Recover", to: "Support" },
  { from: "Recover", to: "Transition" },
  { from: "Recover", to: "Idle" },

  { from: "Overlap", to: "Attack" },
  { from: "Overlap", to: "Support" },
  { from: "Overlap", to: "Recover" },
  { from: "Overlap", to: "Transition" },
  { from: "Overlap", to: "Idle" },

  { from: "Underlap", to: "Attack" },
  { from: "Underlap", to: "Support" },
  { from: "Underlap", to: "Recover" },
  { from: "Underlap", to: "Transition" },
  { from: "Underlap", to: "Idle" },

  { from: "CounterAttack", to: "Attack" },
  { from: "CounterAttack", to: "Support" },
  { from: "CounterAttack", to: "Recover" },
  { from: "CounterAttack", to: "Transition" },
  { from: "CounterAttack", to: "Idle" },

  { from: "Transition", to: "Attack" },
  { from: "Transition", to: "Defend" },
  { from: "Transition", to: "Support" },
  { from: "Transition", to: "Recover" },
  { from: "Transition", to: "CounterAttack" },
  { from: "Transition", to: "Idle" },
] as const;

const transitionMap = new Map<TacticalState, ReadonlySet<TacticalState>>();

for (const rule of TACTICAL_TRANSITION_RULES) {
  const existing = transitionMap.get(rule.from);
  if (existing) {
    transitionMap.set(rule.from, new Set([...existing, rule.to]));
  } else {
    transitionMap.set(rule.from, new Set([rule.to]));
  }
}

/**
 * Returns true when a tactical transition is explicitly allowed.
 *
 * @param from Current tactical state.
 * @param to Requested tactical state.
 * @returns Whether the transition is legal.
 */
export function isTacticalTransitionAllowed(
  from: TacticalState,
  to: TacticalState
): boolean {
  if (from === to) return true;
  return transitionMap.get(from)?.has(to) ?? false;
}

/**
 * Returns legal destination states from a source tactical state.
 *
 * @param from Current tactical state.
 * @returns Allowed destination states.
 */
export function getAllowedTacticalTransitions(from: TacticalState): readonly TacticalState[] {
  return [...(transitionMap.get(from) ?? [])];
}
