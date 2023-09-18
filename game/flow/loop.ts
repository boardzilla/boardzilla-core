import Flow from './flow';

export default class Loop<T = string | number | boolean | Record<any, any>> extends Flow {
  do: Flow;
  position: { index: number, value?: T };
  initial?: ((a?: Record<any, any>) => T) | T;
  next?: (a: T) => T;
  while: (a?: T) => boolean;
  type = "loop";

  constructor({ name, initial, next, do: block, while: whileCondition }: {
    name?: string,
    initial?: never,
    next?: () => T,
    while: () => boolean,
    do: Flow
  } | {
    name?: string,
    initial: ((a: Record<any, any>) => T) | T,
    next: (a: T) => T,
    while: (a: T) => boolean,
    do: Flow
  }) {
    super({ name })
    this.initial = initial;
    this.next = next;
    block.parent = this;
    this.do = block;
    this.while = whileCondition;
  }

  reset() {
    const position: typeof this.position = { index: 0 };
    if (this.initial !== undefined) position.value =
      this.initial instanceof Function ? this.initial(this.flowStepArgs()) : this.initial;
    this.setPosition(position);
    if (!this.while(position.value)) this.setPosition({...position, index: -1});
  }
  
  currentSubflow() {
    if (this.position.index !== -1) return this.do;
  }

  advance() {
    const position: typeof this.position = { ...this.position, index: this.position.index + 1 };
    if (this.next && this.position.value !== undefined) position.value = this.next(this.position.value);
    this.setPosition(position);
    if (!this.while(position.value)) {
      this.setPosition({...position, index: -1});
      return 'complete';
    }
    return 'ok';
  }

  repeat() {
    this.setPosition(this.position);
    if (!this.while(this.position.value)) {
      this.setPosition({...this.position, index: -1});
      return 'complete';
    }
    return 'ok';
  }

  toString(): string {
    return `loop${this.name ? ":" + this.name : ""} (index: ${this.position.index}, value: ${this.position.value})$`;
  }
}

// export default<T> (name: string, options: LoopOptions<T>, block: (i: T) => FlowStep) => new Loop(name, options, block);
