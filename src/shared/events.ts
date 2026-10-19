import type {
  ActivityId,
  AttemptId,
  AudioClipId,
  LevelId,
  ProfileId,
  SkillId,
  StickerId,
} from './ids';

export type InteractionKind = 'tap' | 'drag' | 'drop' | 'select' | 'record';
export type EvalOutcomeKind = 'correct' | 'partial' | 'not_yet' | 'speech';
export type SpeechAttemptResult =
  | 'recorded_voice_detected'
  | 'recorded_silence'
  | 'recognized_match'
  | 'recognized_no_match'
  | 'prompt_only'
  | 'unavailable';
export type MicState =
  | 'unsupported'
  | 'permission_unknown'
  | 'requesting_permission'
  | 'ready'
  | 'recording'
  | 'stopping'
  | 'processing'
  | 'feedback'
  | 'denied'
  | 'timed_out'
  | 'cancelled'
  | 'recoverable_error';

/** Typed app events (02-architecture §3.2). Events never carry free text from the child or audio. */
export type AppEvent =
  | { type: 'activity.started'; profileId: ProfileId; levelId: LevelId; activityId: ActivityId; at: number }
  | { type: 'activity.interaction'; activityId: ActivityId; kind: InteractionKind; targetId?: string; at: number }
  | {
      type: 'activity.evaluated';
      activityId: ActivityId;
      outcome: EvalOutcomeKind;
      skillIds: SkillId[];
      hintLevel: 0 | 1 | 2 | 3;
      at: number;
    }
  | { type: 'activity.completed' | 'activity.skipped'; activityId: ActivityId; attemptId: AttemptId; at: number }
  | { type: 'level.completed'; profileId: ProfileId; levelId: LevelId; completionKey: string; at: number }
  | { type: 'reward.granted'; profileId: ProfileId; stickerId: StickerId; grantKey: string; at: number }
  | { type: 'speech.attempt'; activityId: ActivityId; result: SpeechAttemptResult; at: number }
  | { type: 'mic.state'; state: MicState; at: number }
  | { type: 'audio.unavailable'; clipId: AudioClipId; reason: string; at: number }
  | { type: 'app.error'; scope: string; recoverable: boolean; code: string; at: number };

export type AppEventType = AppEvent['type'];
export type EventOf<T extends AppEventType> = Extract<AppEvent, { type: T }>;
export type Unsubscribe = () => void;

/** Synchronous, in-memory, typed pub/sub. A throwing subscriber never stops the others. */
export class EventBus<E extends { type: string } = AppEvent> {
  private readonly handlers = new Map<string, Set<(e: E) => void>>();
  private readonly anyHandlers = new Set<(e: E) => void>();

  constructor(private readonly onHandlerError: (err: unknown, event: E) => void = () => {}) {}

  on<T extends E['type']>(type: T, handler: (e: Extract<E, { type: T }>) => void): Unsubscribe {
    const set = this.handlers.get(type) ?? new Set();
    const h = handler as (e: E) => void;
    set.add(h);
    this.handlers.set(type, set);
    return () => set.delete(h);
  }

  onAny(handler: (e: E) => void): Unsubscribe {
    this.anyHandlers.add(handler);
    return () => this.anyHandlers.delete(handler);
  }

  emit(event: E): void {
    const targeted = [...(this.handlers.get(event.type) ?? [])];
    for (const h of [...targeted, ...this.anyHandlers]) {
      try {
        h(event);
      } catch (err) {
        this.onHandlerError(err, event);
      }
    }
  }
}
