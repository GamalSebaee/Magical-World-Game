import type { ActivityDefinition, Mechanic } from '@content/schema';
import type { MechanicLogic } from '@game/core/engine/types';
import { listenChooseLogic } from './listen-choose/logic';
import { speakRepeatLogic } from './speak-repeat/logic';
import { tapDiscoverLogic } from './tap-discover/logic';

/**
 * Static registry of mechanic rules (04 §2 ActivityRegistry). Scene adapters register separately
 * (they import Phaser). Mechanics not yet implemented are absent and reported, not guessed.
 */
const LOGIC: Partial<Record<Mechanic, MechanicLogic<never, unknown>>> = {
  tap_discover: tapDiscoverLogic as MechanicLogic<never, unknown>,
  listen_choose: listenChooseLogic as MechanicLogic<never, unknown>,
  speak_repeat: speakRepeatLogic as MechanicLogic<never, unknown>,
};

export function logicFor(def: ActivityDefinition): MechanicLogic<ActivityDefinition, unknown> | undefined {
  return LOGIC[def.mechanic] as MechanicLogic<ActivityDefinition, unknown> | undefined;
}

export const IMPLEMENTED_MECHANICS = Object.keys(LOGIC) as Mechanic[];
