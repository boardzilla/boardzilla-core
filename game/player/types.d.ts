import type { Player } from './index.js';

// find all non-method non-internal attr's
export type PlayerAttributes<T extends Player> = {
  [
    K in keyof InstanceType<{new(...args: any[]): T}>
      as InstanceType<{new(...args: any[]): T}>[K] extends (...args: unknown[]) => unknown ? never : (K extends '_players' ? never : K)
  ]: InstanceType<{new(...args: any[]): T}>[K]
}
