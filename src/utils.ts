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

export const equals = (a: any, b: any) => {
  if (a === b) return true;

  if (a && b && typeof a == 'object' && typeof b == 'object') {
    if (a.constructor !== b.constructor) return false;

    let length, i, keys;
    if (Array.isArray(a)) {
      length = a.length;
      if (length != b.length) return false;
      for (i = length; i-- !== 0;)
        if (!equals(a[i], b[i])) return false;
      return true;
    }

    if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
    if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) return false;

    for (i = length; i-- !== 0;)
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

    for (i = length; i-- !== 0;) {
      const key = keys[i];
      if (!equals(a[key], b[key])) return false;
    }

    return true;
  }

  // true if both NaN, false otherwise
  return a!==a && b!==b;
};
