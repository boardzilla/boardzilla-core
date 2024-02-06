class Queue {
  updates: (() => any)[] = [];
  justProcessed: boolean = false; // queue was just processed
  timeout: number;
  paused = false;

  constructor(
    public speed: number = 1
  ) {
  }

  schedule(update: () => any, waitIfProcessing = false) {
    this.updates.push(update);
    if (this.updates.length === 1 && (!this.justProcessed || !waitIfProcessing)) {
      this.pump();
    }
  }

  pump() {
    if (this.paused) return;
    const update = this.updates.shift();
    if (!update) {
      this.justProcessed = false;
      return;
    }
    this.justProcessed = true;
    clearTimeout(this.timeout);
    this.timeout = window.setTimeout(() => this.pump(), this.speed * 1000);
    update();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.pump();
  }
}

export default Queue;
