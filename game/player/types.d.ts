import type { Player } from './';

export type PlayerAttributes<T extends Player> = {
  [
    K in keyof InstanceType<{new(...args: any[]): T}>
      as InstanceType<{new(...args: any[]): T}>[K] extends (...args: unknown[]) => unknown ? never : K
  ]: InstanceType<{new(...args: any[]): T}>[K]
}
