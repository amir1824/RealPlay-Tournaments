export interface PeriodicTaskOptions {
  intervalMs: number;
  run: () => Promise<void>;
  onError: (error: unknown) => void;
}

export interface PeriodicTask {
  /** Stops scheduling and waits for a run in progress to finish. */
  stop(): Promise<void>;
}

/**
 * Runs `run` every intervalMs on an in-process timer, never two at once: the
 * next run is scheduled only after the previous one settles. A failed run is
 * reported to onError and retried on the next tick.
 */
export function startPeriodicTask(options: PeriodicTaskOptions): PeriodicTask {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> = Promise.resolve();

  const schedule = (): void => {
    if (stopped) return;
    timer = setTimeout(tick, options.intervalMs);
  };
  const tick = (): void => {
    inFlight = options.run().catch(options.onError).finally(schedule);
  };

  schedule();
  return {
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await inFlight;
    },
  };
}
