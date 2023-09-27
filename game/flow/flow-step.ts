import Flow from './flow';

import type { Player } from '../player';

export default class FlowStep extends Flow<Player> {
  command?: (args: Record<any, any>) => any;
  type = "step";

  constructor({ name, command }: { name?: string, command?: (args: Record<any, any>) => any }) {
    super({ name });
    this.command = command;
  }

  playOneStep(): 'complete' {
    if (this.command) this.command(this.flowStepArgs());
    return 'complete';
  }

  toString(): string {
    const commandBody = this.command?.toString()?.match(/function[^{]+\{(\\n|\s)*([\s\S]*?)(\\n|\s)*\}$/)
    return `action${this.name ? ":" + this.name : ""} (${commandBody && commandBody[2]})`;
  }
}

// export default (name: string, command?: () => void) => new FlowStep(name, command);
