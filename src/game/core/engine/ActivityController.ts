import type { ActivityDefinition } from '@content/schema';
import { afterNotYet, demonstrates, HINT_POLICY, idleHintLevel, offersSkip, raiseHint } from './hintPolicy';
import type { ActivityInput, EvidenceItem, HintLevel, MechanicLogic, Outcome, Phase, SayItem } from './types';

export interface SpeechPort {
  /** Plays items in order as one voice line (interrupting any current line). */
  say(items: SayItem[]): { done: Promise<unknown>; stop(): void };
  sfx(id: string): void;
  stop(): void;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}

export interface ActivitySnapshot<M = unknown> {
  activityId: string;
  mechanic: ActivityDefinition['mechanic'];
  phase: Phase;
  paused: boolean;
  hintLevel: HintLevel;
  notYetCount: number;
  /** Skip is always available; after repeated tries it is also offered (04 §3.3). */
  offerSkip: boolean;
  /** Hint level 3: the help hand demonstrates on `hintTarget`. */
  demo: boolean;
  hintTarget?: string;
  m: M;
  /** Last feedback, for the scene to animate. `seq` increases every time. */
  last?: { seq: number; targetId?: string; targetIds?: string[]; anim?: Outcome['anim']; kind: Outcome['kind'] };
}

export interface ControllerOptions<M> {
  def: ActivityDefinition;
  logic: MechanicLogic<ActivityDefinition, M>;
  speech: SpeechPort;
  timers: Timers;
  seed: number;
  /** Resume a saved activity state (04 §8). */
  resume?: { m: M; hintLevel: HintLevel };
  /** Idle time before an automatic hint (12 s default, age-tuned by the caller). */
  idleHintMs?: number;
  /** Safety cap so a stuck audio callback can never freeze feedback. */
  feedbackCapMs?: number;
  /** Feedback animations get at least this long even when audio fails. */
  minFeedbackMs?: number;
  onOutcome?: (outcome: Outcome, snap: ActivitySnapshot<M>) => void;
  onEnd?: (result: 'completed' | 'skipped', snap: ActivitySnapshot<M>) => void;
}

/** Waiting lines beyond which the playing one is cut short, so fast counting never lags far behind (04 §4.5). */
const MAX_QUEUED_LINES = 2;

/**
 * Runs one activity through its lifecycle (04 §3): intro → ready → feedback → … → completed |
 * skipped, with pause, hints, idle help and skip. Owns no rendering: scenes and overlays
 * subscribe to snapshots and send inputs.
 *
 * Guards: inputs outside intro/ready are ignored; completion is emitted once; every async
 * continuation carries a token so callbacks from a stopped/paused run are dropped.
 */
export class ActivityController<M = unknown> {
  private snap: ActivitySnapshot<M>;
  private readonly listeners = new Set<(s: ActivitySnapshot<M>) => void>();
  private token = 0;
  private idleTimer?: unknown;
  private autoHints = 0;
  private consecutiveNotYet = 0;
  private seq = 0;
  private ended = false;
  private disposed = false;
  private pausedFrom?: Phase;
  /** Feedback and counting lines play one after another through this queue. */
  private voiceQueue: Array<{ items: SayItem[]; resolve: () => void }> = [];
  private voiceCurrent?: { stop(): void };

  constructor(private readonly o: ControllerOptions<M>) {
    const m = o.resume?.m ?? o.logic.init(o.def, o.seed);
    this.snap = {
      activityId: o.def.id,
      mechanic: o.def.mechanic,
      phase: 'loading',
      paused: false,
      hintLevel: o.resume?.hintLevel ?? 0,
      notYetCount: 0,
      offerSkip: false,
      demo: false,
      hintTarget: o.logic.hintTarget(o.def, m),
      m,
    };
  }

  get snapshot(): ActivitySnapshot<M> {
    return this.snap;
  }

  get definition(): ActivityDefinition {
    return this.o.def;
  }

  subscribe(l: (s: ActivitySnapshot<M>) => void): () => void {
    this.listeners.add(l);
    l(this.snap);
    return () => this.listeners.delete(l);
  }

  private update(patch: Partial<ActivitySnapshot<M>>) {
    this.snap = { ...this.snap, ...patch };
    if (patch.m !== undefined) this.snap.hintTarget = this.o.logic.hintTarget(this.o.def, this.snap.m);
    for (const l of this.listeners) l(this.snap);
  }

  /** Starts the intro: instruction, then the current prompt if it differs. */
  start() {
    if (this.snap.phase !== 'loading' || this.disposed) return;
    if (this.o.logic.isComplete(this.o.def, this.snap.m)) return this.finish('completed');
    this.update({ phase: 'intro' });
    const t = ++this.token;
    const prompt = this.o.logic.prompt(this.o.def, this.snap.m);
    const items: SayItem[] = [{ ref: this.o.def.instruction }];
    if (prompt && prompt !== this.o.def.instruction) items.push({ ref: prompt });
    void this.o.speech.say(items).done.then(() => {
      if (t === this.token && this.snap.phase === 'intro') this.toReady();
    });
  }

  private toReady() {
    this.update({ phase: 'ready' });
    this.armIdleHint();
  }

  input(input: ActivityInput) {
    if (this.disposed || this.snap.paused) return;
    if (this.snap.phase !== 'intro' && this.snap.phase !== 'ready') return;
    const r = this.o.logic.apply(this.o.def, this.snap.m, input, {
      hintLevel: this.snap.hintLevel,
      skillForVocab: (v) => {
        const skill = `vocab.${v}`;
        return this.o.def.skills.includes(skill) ? skill : undefined;
      },
    });
    if (!r) return;

    // A child acting during the intro has understood: stop talking and handle it. Lines
    // already queued (counting) keep their order instead.
    if (!this.voiceBusy || r.outcome.inline === 'interrupt') this.clearVoice();
    this.clearIdle();

    if (r.outcome.inline) return this.inlineOutcome(r.m, r.outcome);
    const t = ++this.token;

    let { hintLevel } = this.snap;
    let notYetCount = this.snap.notYetCount;
    if (r.outcome.kind === 'not_yet') {
      notYetCount++;
      const next = afterNotYet(hintLevel, this.consecutiveNotYet);
      hintLevel = next.level;
      this.consecutiveNotYet = next.consecutive;
    } else {
      this.consecutiveNotYet = 0;
    }
    const outcome = this.withEvidence(r.outcome);

    this.update({
      phase: 'feedback',
      m: r.m,
      hintLevel,
      notYetCount,
      offerSkip: this.snap.offerSkip || offersSkip(notYetCount),
      demo: demonstrates(hintLevel),
      last: this.lastOf(outcome),
    });
    this.o.onOutcome?.(outcome, this.snap);

    if (outcome.sfx) this.o.speech.sfx(outcome.sfx);
    const say = [...outcome.say];
    const prompt = this.o.logic.prompt(this.o.def, this.snap.m);
    if (outcome.thenPrompt && prompt) say.push({ ref: prompt });
    void this.feedbackDone(say).then(() => {
      if (t === this.token) this.afterFeedback();
    });
  }

  /** Selecting, counting, a drop that lands nowhere: state moves on, play stays in `ready`. */
  private inlineOutcome(m: M, outcome: Outcome) {
    const out = this.withEvidence(outcome);
    this.update({ phase: 'ready', m, last: this.lastOf(out) });
    this.o.onOutcome?.(out, this.snap);
    if (out.sfx) this.o.speech.sfx(out.sfx);
    if (out.say.length) void this.enqueue(out.say);
    this.armIdleHint();
  }

  private withEvidence(outcome: Outcome): Outcome {
    const evidence: EvidenceItem[] = outcome.evidence.map((e) =>
      e.kind === 'choice_correct' ? { ...e, firstTry: e.firstTry && this.snap.hintLevel < 2 } : e,
    );
    return { ...outcome, evidence };
  }

  private lastOf(o: Outcome): ActivitySnapshot['last'] {
    return { seq: ++this.seq, targetId: o.targetId, targetIds: o.targetIds, anim: o.anim, kind: o.kind };
  }

  private get voiceBusy() {
    return this.voiceCurrent !== undefined || this.voiceQueue.length > 0;
  }

  /**
   * Plays a line after the ones already queued. If the child outpaces the voice by more than
   * MAX_QUEUED_LINES, the playing line is cut short (never skipped), so 1-2-3 stays in order.
   */
  private enqueue(items: SayItem[]): Promise<void> {
    return new Promise<void>((resolve) => {
      this.voiceQueue.push({ items, resolve });
      if (!this.voiceCurrent) this.nextVoice();
      else if (this.voiceQueue.length > MAX_QUEUED_LINES) this.voiceCurrent.stop();
    });
  }

  private nextVoice() {
    const next = this.voiceQueue.shift();
    if (!next) return;
    const h = this.o.speech.say(next.items);
    const current = { stop: () => h.stop() };
    this.voiceCurrent = current;
    void h.done.then(
      () => this.voiceEnded(current, next.resolve),
      () => this.voiceEnded(current, next.resolve),
    );
  }

  private voiceEnded(current: { stop(): void }, resolve: () => void) {
    resolve();
    if (this.voiceCurrent !== current) return;
    this.voiceCurrent = undefined;
    this.nextVoice();
  }

  /** Stops everything this activity says: the current line, the queue and any direct line. */
  private clearVoice() {
    const waiting = this.voiceQueue;
    this.voiceQueue = [];
    const current = this.voiceCurrent;
    this.voiceCurrent = undefined;
    current?.stop();
    this.o.speech.stop();
    for (const w of waiting) w.resolve();
  }

  private async feedbackDone(say: SayItem[]) {
    const { feedbackCapMs = 8000, minFeedbackMs = 500 } = this.o;
    const min = this.sleep(minFeedbackMs);
    const spoken = say.length ? this.enqueue(say) : Promise.resolve();
    await Promise.race([spoken, this.sleep(feedbackCapMs)]);
    await min;
  }

  private afterFeedback() {
    if (this.snap.paused || this.ended) return;
    if (this.o.logic.isComplete(this.o.def, this.snap.m)) return this.finish('completed');
    this.toReady();
  }

  /** Help button (03 C13): raise the hint level and play that hint. */
  help() {
    if (this.disposed || this.snap.paused || this.ended) return;
    if (this.snap.phase !== 'ready' && this.snap.phase !== 'intro') return;
    const hintLevel = raiseHint(this.snap.hintLevel);
    this.update({ hintLevel, demo: demonstrates(hintLevel), phase: 'ready' });
    this.playHint();
  }

  private playHint() {
    this.clearIdle();
    this.clearVoice();
    const hints = this.o.def.hints;
    const hint = hints[Math.min(Math.max(1, this.snap.hintLevel), hints.length) - 1];
    const t = ++this.token;
    if (hint) {
      void this.o.speech.say([{ ref: hint }]).done.then(() => {
        if (t === this.token && this.snap.phase === 'ready') this.armIdleHint();
      });
    }
  }

  /** Ear button: replay the current prompt. */
  replay() {
    if (this.disposed || this.snap.paused || this.ended) return;
    const prompt = this.o.logic.prompt(this.o.def, this.snap.m) ?? this.o.def.instruction;
    this.clearIdle();
    this.clearVoice();
    const t = ++this.token;
    if (this.snap.phase === 'intro') this.update({ phase: 'ready' });
    void this.o.speech.say([{ ref: prompt }]).done.then(() => {
      if (t === this.token && this.snap.phase === 'ready') this.armIdleHint();
    });
  }

  skip() {
    if (this.disposed || this.ended) return;
    this.clearVoice();
    this.finish('skipped');
  }

  pause() {
    if (this.disposed || this.ended || this.snap.paused) return;
    this.pausedFrom = this.snap.phase;
    this.token++;
    this.clearIdle();
    this.clearVoice();
    this.update({ paused: true });
  }

  resume() {
    if (this.disposed || this.ended || !this.snap.paused) return;
    const from = this.pausedFrom;
    this.pausedFrom = undefined;
    this.update({ paused: false });
    if (from === 'feedback') this.afterFeedback();
    else if (from === 'intro' || from === 'loading') {
      // The instruction was cut off: replay it once.
      this.update({ phase: 'ready' });
      this.replay();
    } else if (from === 'ready') this.armIdleHint();
  }

  dispose() {
    this.disposed = true;
    this.token++;
    this.clearIdle();
    this.clearVoice();
    this.listeners.clear();
  }

  private finish(result: 'completed' | 'skipped') {
    if (this.ended) return;
    this.ended = true;
    this.token++;
    this.clearIdle();
    this.update({ phase: result, paused: false });
    this.o.onEnd?.(result, this.snap);
  }

  private armIdleHint() {
    this.clearIdle();
    if (this.autoHints >= HINT_POLICY.maxAutoHints || this.disposed) return;
    this.idleTimer = this.o.timers.setTimeout(() => {
      this.idleTimer = undefined;
      if (this.snap.phase !== 'ready' || this.snap.paused) return;
      this.autoHints++;
      const level = idleHintLevel(this.snap.hintLevel);
      if (level !== this.snap.hintLevel) this.update({ hintLevel: level });
      this.playHint();
    }, this.o.idleHintMs ?? 12_000);
  }

  private clearIdle() {
    if (this.idleTimer !== undefined) this.o.timers.clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => this.o.timers.setTimeout(r, ms));
  }
}

