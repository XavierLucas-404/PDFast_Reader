/** Serializes sealed-session uploads and retries without interrupting the reader. */
export class AutoSync {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | undefined;
  private pending = false;
  private disposed = false;
  private failures = 0;
  constructor(
    private run: () => Promise<void>,
    private onFailure: (error: unknown) => void,
    private onSuccess: () => void,
  ) {}
  request(force = false): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.timer) {
      if (!force) return this.running || Promise.resolve();
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.running) {
      this.pending = true;
      return this.running;
    }
    // Defer until after assignment, even if run throws synchronously.
    this.running = Promise.resolve()
      .then(async () => {
        if (this.disposed) return;
        do {
          this.pending = false;
          await this.run();
        } while (this.pending && !this.disposed);
        if (!this.disposed) {
          this.failures = 0;
          this.onSuccess();
        }
      })
      .catch((error) => {
        if (this.disposed) return;
        this.onFailure(error);
        const wait = [30000, 60000, 120000, 300000][
          Math.min(this.failures++, 3)
        ];
        this.timer = setTimeout(() => {
          this.timer = undefined;
          void this.request();
        }, wait);
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
