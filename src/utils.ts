import type { Argument } from './action/action.js';
import { escapeArgument } from './action/utils.js';

export const shuffleArray = (array: any[], random: () => number) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// usage times(max, n => ...) from 1 to max
export const times = <T>(n: number, fn: (n: number) => T): T[] => Array.from(Array(n)).map((_, i) => fn(i + 1));
export const range = (min: number, max: number, step = 1) => times(Math.floor((max - min) / step) + 1, i => (i - 1) * step + min);

export const n = (message: string, args?: Record<string, Argument>, escaped: boolean = false) => {
  Object.entries(args || {}).forEach(([k, v]) => {
    message = message.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`), escaped ? escapeArgument(v) : v.toString());
  })

  const missingArgs = Array.from(message.matchAll(new RegExp(`\\{\\{\\s*(\\w+)\\s*\\}\\}`, 'g'))).map(([, arg]) => arg);
  if (missingArgs.length) throw Error(`Missing strings in:\n${message}\nAll substitution strings must be specified in 2nd parameter. Missing: ${missingArgs.join('; ')}`);

  return message;
}
