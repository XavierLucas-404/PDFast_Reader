/** Cancels both the timeout and callbacks already queued by the event loop. */
export class PlaybackClock {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  schedule(callback: () => void, milliseconds: number) {
    this.cancel();
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.timer = undefined;
      callback();
    }, milliseconds);
  }
  cancel() {
    this.generation += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
