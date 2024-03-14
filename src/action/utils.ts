import type { Argument, SingleArgument } from './action.js';
import type { Player } from '../player/index.js';
import type { BaseGame } from '../board/game.js';
import type GameElement from '../board/element.js';

export type SerializedSingleArg = string | number | boolean;
export type SerializedArg = SerializedSingleArg | SerializedSingleArg[];
export type Serializable = SingleArgument | null | undefined | Serializable[] | { [key: string]: Serializable };

export const serialize = (arg: Serializable, forPlayer=true): any => {
  if (arg === undefined) return undefined;
  if (arg === null) return null;
  if (arg instanceof Array) return arg.map(a => serialize(a, forPlayer));
  if (typeof arg === 'object' && 'constructor' in arg && ('isPlayer' in arg.constructor || 'isGameElement' in arg.constructor)) {
    return serializeSingleArg(arg as GameElement | Player, forPlayer);
  }
  if (typeof arg === 'object') return serializeObject(arg, forPlayer);
  if (typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'boolean') return serializeSingleArg(arg, forPlayer);
  throw Error(`unable to serialize ${arg}`);
}

export const serializeArg = (arg: Argument, forPlayer=true): SerializedArg => {
  if (arg instanceof Array) return arg.map(a => serializeSingleArg(a, forPlayer));
  return serializeSingleArg(arg, forPlayer);
}

export const serializeSingleArg = (arg: SingleArgument, forPlayer=true): SerializedSingleArg => {
  if (typeof arg === 'object' && 'constructor' in arg) {
    if ('isPlayer' in arg.constructor) return `$p[${(arg as Player).position}]`;
    if ('isGameElement' in arg.constructor) return forPlayer ? `$el[${(arg as GameElement).branch()}]` : `$eid[${(arg as GameElement)._t.id}]`;
  }
  return arg as SerializedSingleArg;
}

export const serializeObject = (obj: Record<string, any>, forPlayer=true) => {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v, forPlayer)]));
}

export const escapeArgument = (arg: Argument): string => {
  if (arg instanceof Array) {
    const escapees = arg.map(escapeArgument);
    return escapees.slice(0, -1).join(', ') + (escapees.length > 1 ? ' and ' : '') + (escapees[escapees.length - 1] || '');
  }
  if (typeof arg === 'object') return `[[${serializeSingleArg(arg)}|${arg.toString()}]]`;
  return String(arg);
}

export const deserializeArg = (arg: SerializedArg, game: BaseGame): Argument => {
  if (arg instanceof Array) return arg.map(a => deserializeSingleArg(a, game)) as GameElement[];
  return deserializeSingleArg(arg, game);
}

export const deserializeSingleArg = (arg: SerializedSingleArg, game: BaseGame): SingleArgument => {
  if (typeof arg === 'number' || typeof arg === 'boolean') return arg;
  let deser: SingleArgument | undefined;
  if (arg.slice(0, 3) === '$p[') {
    deser = game.players.atPosition(parseInt(arg.slice(3, -1)));
  } else if (arg.slice(0, 4) === '$el[') {
    deser = game.atBranch(arg.slice(4, -1));
  } else if (arg.slice(0, 5) === '$eid[') {
    deser = game.atID(parseInt(arg.slice(5, -1)));
  } else {
    return arg;
  }
  if (!deser) throw Error(`Unable to find arg: ${arg}`);
  return deser;
}

export const deserializeObject = (obj: Record<string, any>, game: BaseGame) => {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deserialize(v, game)]));
}

export const deserialize = (arg: any, game: BaseGame): Serializable => {
  if (arg === undefined) return undefined;
  if (arg === null) return null;
  if (arg instanceof Array) return arg.map(a => deserialize(a, game));
  if (typeof arg === 'object') return deserializeObject(arg, game);
  if (typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'boolean') return deserializeSingleArg(arg, game);
  throw Error(`unable to deserialize ${arg}`);
}

export const combinations = <T>(set: T[], min: number, max: number): T[][] => {
  const combos = [] as T[][];
  const poss = (curr: T[], i: number) => {
    if (set.length - i < min - curr.length) return;
    if (curr.length >= min) combos.push(curr);
    if (curr.length < max) {
      for (let j = i; j !== set.length; j++) {
        poss(curr.concat([set[j]]), j + 1);
      }
    }
  }
  poss([], 0);
  return combos;
}
