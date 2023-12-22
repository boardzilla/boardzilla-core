class Queue {
  updates: (() => any)[] = [];
  justProcessed: boolean = false; // queue was just processed
  timeout: NodeJS.Timeout;

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
    const update = this.updates.shift();
    if (!update) {
      this.justProcessed = false;
      return;
    }
    this.justProcessed = true;
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.pump(), this.speed * 1000);
    update();
  }
}

export default Queue;
