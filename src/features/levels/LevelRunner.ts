import type { ActivityDefinition, LevelDefinition } from '@content/schema';
import type { ActivityController, ActivitySnapshot } from '@game/core/engine/ActivityController';
import type { HintLevel, Outcome } from '@game/core/engine/types';
import type { ActiveSessionSnapshot } from '@services/storage/records';
import type { StorageRepositories } from '@services/storage/repositories';
import type { ActivityId, AttemptId, LevelId, ProfileId, SkillId, StickerId } from '@shared/ids';
import type { AppEvent, EventBus } from '@shared/events';
import { localDay, type Clock, type Logger } from '@shared/runtime';

export interface ControllerFactoryArgs {
  def: ActivityDefinition;
  seed: number;
  resume?: { m: unknown; hintLevel: HintLevel };
  onOutcome(outcome: Outcome, snap: ActivitySnapshot): void;
  onEnd(result: 'completed' | 'skipped', snap: ActivitySnapshot): void;
}

export interface LevelRunnerDeps {
  level: LevelDefinition;
  profileId: string;
  storage: StorageRepositories;
  events: EventBus<AppEvent>;
  clock: Clock;
  ids: { next(): string };
  logger: Logger;
  random?: () => number;
  makeController(args: ControllerFactoryArgs): ActivityController | undefined;
}

export interface LevelResult {
  levelId: string;
  firstCompletion: boolean;
  stickerNew: boolean;
  skipped: number;
}

export interface RunnerState {
  runId: string;
  index: number;
  total: number;
  controller?: ActivityController;
  result?: LevelResult;
}

/**
 * Runs a level's activities in order and owns persistence at meaningful boundaries (08 §4):
 * evidence after each evaluation, the attempt when an activity ends, the mid-level snapshot,
 * and the idempotent completion + sticker grant at the end. Storage failures are logged and
 * never interrupt play.
 */
export class LevelRunner {
  readonly runId: string;
  private index = 0;
  private controller?: ActivityController;
  private attemptId?: string;
  private seed = 0;
  private startedAt = 0;
  private hintMax: HintLevel = 0;
  private skipped = 0;
  private result?: LevelResult;
  private disposed = false;
  private readonly listeners = new Set<(s: RunnerState) => void>();

  constructor(private readonly d: LevelRunnerDeps) {
    this.runId = d.ids.next();
  }

  subscribe(l: (s: RunnerState) => void) {
    this.listeners.add(l);
    l(this.state());
    return () => this.listeners.delete(l);
  }

  state(): RunnerState {
    return { runId: this.runId, index: this.index, total: this.d.level.activities.length, controller: this.controller, result: this.result };
  }

  private notify() {
    const s = this.state();
    for (const l of this.listeners) l(s);
  }

  /** Starts at the first activity, or at a saved snapshot for this level and content version. */
  start(resume?: ActiveSessionSnapshot) {
    const r = resume && resume.levelId === this.d.level.id && resume.contentVersion === this.d.level.contentVersion ? resume : undefined;
    const i = r ? Math.min(Math.max(0, r.activityIndex), this.d.level.activities.length - 1) : 0;
    const sameActivity = r && this.d.level.activities[i]?.id === r.activityId;
    this.startActivity(i, sameActivity ? { m: r.mechanicState, hintLevel: r.hintLevel, seed: r.seed } : undefined);
  }

  private startActivity(i: number, resume?: { m: unknown; hintLevel: HintLevel; seed: number }): void {
    if (this.disposed) return;
    this.controller?.dispose();
    this.index = i;
    const def = this.d.level.activities[i];
    if (!def) return void this.completeLevel();

    this.seed = resume?.seed ?? Math.floor((this.d.random ?? Math.random)() * 2 ** 31);
    this.attemptId = this.d.ids.next();
    this.startedAt = this.d.clock.now();
    this.hintMax = resume?.hintLevel ?? 0;

    const controller = this.d.makeController({
      def,
      seed: this.seed,
      resume: resume ? { m: resume.m, hintLevel: resume.hintLevel } : undefined,
      onOutcome: (o, snap) => this.onOutcome(def, o, snap),
      onEnd: (result, snap) => this.onEnd(def, result, snap),
    });
    if (!controller) {
      // A mechanic this build doesn't implement: skip it rather than dead-end (02 §10).
      this.d.logger.log('error', 'level', `No controller for ${def.mechanic}; skipping ${def.id}`);
      this.emitError(`missing_mechanic:${def.mechanic}`);
      this.skipped++;
      return this.startActivity(i + 1);
    }
    this.controller = controller;
    this.d.events.emit({
      type: 'activity.started',
      profileId: this.d.profileId as ProfileId,
      levelId: this.d.level.id as LevelId,
      activityId: def.id as ActivityId,
      at: this.d.clock.now(),
    });
    this.notify();
    this.saveSnapshot();
    controller.start();
  }

  private onOutcome(def: ActivityDefinition, o: Outcome, snap: ActivitySnapshot) {
    const at = this.d.clock.now();
    this.hintMax = Math.max(this.hintMax, snap.hintLevel) as HintLevel;
    if (o.kind !== 'speech') {
      this.d.events.emit({
        type: 'activity.evaluated',
        activityId: def.id as ActivityId,
        outcome: o.kind,
        skillIds: o.evidence.map((e) => e.skillId as SkillId),
        hintLevel: snap.hintLevel,
        at,
      });
    }
    for (const e of o.evidence) {
      this.persist(
        this.d.storage.progress.appendEvidence({
          profileId: this.d.profileId,
          skillId: e.skillId,
          activityId: def.id,
          attemptId: this.attemptId!,
          kind: e.kind,
          firstTry: e.firstTry,
          voiced: e.voiced,
          hintLevel: snap.hintLevel,
          at,
          sessionDay: localDay(at),
        }),
      );
    }
    this.saveSnapshot();
  }

  private onEnd(def: ActivityDefinition, result: 'completed' | 'skipped', snap: ActivitySnapshot) {
    const at = this.d.clock.now();
    if (result === 'skipped') {
      this.skipped++;
      for (const skillId of def.skills) {
        this.persist(
          this.d.storage.progress.appendEvidence({
            profileId: this.d.profileId,
            skillId,
            activityId: def.id,
            attemptId: this.attemptId!,
            kind: 'skipped',
            hintLevel: snap.hintLevel,
            at,
            sessionDay: localDay(at),
          }),
        );
      }
    }
    this.persist(
      this.d.storage.progress.upsertAttempt({
        id: this.attemptId!,
        profileId: this.d.profileId,
        levelId: this.d.level.id,
        activityId: def.id,
        contentVersion: this.d.level.contentVersion,
        runId: this.runId,
        startedAt: this.startedAt,
        endedAt: at,
        outcome: result,
        hintMax: this.hintMax,
        notYetCount: snap.notYetCount,
      }),
    );
    this.d.events.emit({
      type: result === 'completed' ? 'activity.completed' : 'activity.skipped',
      activityId: def.id as ActivityId,
      attemptId: this.attemptId as AttemptId,
      at,
    });
    // Let the final celebration render before moving on.
    queueMicrotask(() => this.startActivity(this.index + 1));
  }

  private async completeLevel() {
    if (this.result || this.disposed) return;
    const { level, profileId, storage, events, clock } = this.d;
    this.controller = undefined;
    let firstCompletion = false;
    let stickerNew = false;
    try {
      firstCompletion = (await storage.progress.completeLevel(profileId, level.id, this.runId)).first;
    } catch (err) {
      this.d.logger.log('error', 'level', 'completion write failed', { err });
      this.emitError('completion_write_failed');
    }
    try {
      stickerNew = await storage.rewards.grantSticker(profileId, level.sticker.id, level.id);
    } catch (err) {
      this.d.logger.log('error', 'level', 'sticker write failed', { err });
      this.emitError('sticker_write_failed');
    }
    const at = clock.now();
    events.emit({
      type: 'level.completed',
      profileId: profileId as ProfileId,
      levelId: level.id as LevelId,
      completionKey: `${profileId}:${level.id}`,
      at,
    });
    if (stickerNew) {
      events.emit({
        type: 'reward.granted',
        profileId: profileId as ProfileId,
        stickerId: level.sticker.id as StickerId,
        grantKey: `${profileId}:${level.sticker.id}`,
        at,
      });
    }
    this.persist(storage.activeSession.clear(profileId));
    this.result = { levelId: level.id, firstCompletion, stickerNew, skipped: this.skipped };
    this.notify();
  }

  /** Saves where the child is, so refresh/backgrounding can resume (04 §8). */
  saveSnapshot() {
    const c = this.controller;
    const def = this.d.level.activities[this.index];
    if (!c || !def || this.result) return;
    const s = c.snapshot;
    this.persist(
      this.d.storage.activeSession.save({
        profileId: this.d.profileId,
        levelId: this.d.level.id,
        contentVersion: this.d.level.contentVersion,
        activityIndex: this.index,
        activityId: def.id,
        mechanicState: s.m,
        hintLevel: s.hintLevel,
        seed: this.seed,
        startedAt: this.startedAt,
      }),
    );
  }

  pause() {
    this.controller?.pause();
    this.saveSnapshot();
  }

  resume() {
    this.controller?.resume();
  }

  /** Restart the current activity from scratch (pause menu). Progress and rewards are unchanged. */
  restartActivity() {
    this.startActivity(this.index);
  }

  dispose() {
    this.disposed = true;
    this.controller?.dispose();
    this.controller = undefined;
    this.listeners.clear();
  }

  private persist(p: Promise<unknown>) {
    p.catch((err: unknown) => {
      this.d.logger.log('warn', 'level', 'storage write failed', { err });
    });
  }

  private emitError(code: string) {
    this.d.events.emit({ type: 'app.error', scope: 'level', recoverable: true, code, at: this.d.clock.now() });
  }
}
