import { Player } from '../player';
import { GameElement } from '../board';
import type { Serializable } from './types';

import type { Argument, SingleArgument, SerializedArg, SerializedSingleArg } from './types';
import type { Game } from '../';
import type { Board } from '../board';

export const humanizeArg = <P extends Player>(arg: Argument<P>) => {
  if (arg instanceof Player) return arg.name;
  if (arg instanceof GameElement) return arg.name || `$el[${arg.branch()}]`; // ??
  return arg.toString();
}

export const serializeArg = <P extends Player>(arg: Argument<P>, forPlayer=true): SerializedArg => {
  if (arg instanceof Array) return arg.map(a => serializeSingleArg(a, forPlayer));
  return serializeSingleArg(arg, forPlayer);
}

export const serializeSingleArg = <P extends Player>(arg: SingleArgument<P>, forPlayer=true): SerializedSingleArg => {
  if (arg instanceof Player) return `$p[${arg.position}]`;
  if (arg instanceof GameElement) return forPlayer ? `$el[${arg.branch()}]` : `$eid[${arg._t.id}]`;
  return arg;
}

export const deserializeArg = <P extends Player>(arg: SerializedArg, game: Game<P, Board<P>>): Argument<P> => {
  if (arg instanceof Array) return arg.map(a => deserializeSingleArg(a, game)) as GameElement<P>[];
  return deserializeSingleArg(arg, game);
}

export const deserializeSingleArg = <P extends Player>(arg: SerializedSingleArg, game: Game<P, Board<P>>): SingleArgument<P> => {
  if (typeof arg === 'number' || typeof arg === 'boolean') return arg;
  let deser: SingleArgument<P> | undefined;
  if (arg.slice(0, 3) === '$p[') {
    deser = game.players.atPosition(parseInt(arg.slice(3, -1)));
  } else if (arg.slice(0, 4) === '$el[') {
    deser = game.board.atBranch(arg.slice(4, -1));
  } else if (arg.slice(0, 5) === '$eid[') {
    deser = game.board.atID(parseInt(arg.slice(5, -1)));
  } else {
    return arg;
  }
  if (!deser) debugger;
  if (!deser) throw Error(`Unable to find arg: ${arg}`);
  return deser;
}

export const serializeObject = (obj: Record<string, any>, forPlayer=true) => {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v, forPlayer)]));
}

export const deserializeObject = <P extends Player>(obj: Record<string, any>, game: Game<P, Board<P>>) => {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deserialize(v, game)]));
}

export const serialize = <P extends Player>(arg: Serializable<P>, forPlayer=true): any => {
  if (arg === undefined) return undefined;
  if (arg === null) return null;
  if (arg instanceof Array) return arg.map(a => serialize(a, forPlayer));
  if (arg instanceof Player || arg instanceof GameElement) return serializeSingleArg(arg, forPlayer);
  if (typeof arg === 'object') return serializeObject(arg, forPlayer);
  if (typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'boolean')
    return serializeSingleArg(arg, forPlayer);
  throw Error(`unable to serialize ${arg}`);
}

export const deserialize = <P extends Player>(arg: any, game: Game<P, Board<P>>): Serializable<P> => {
  if (arg === undefined) return undefined;
  if (arg === null) return null;
  if (arg instanceof Array) return arg.map(a => deserialize(a, game));
  if (typeof arg === 'object') return deserializeObject(arg, game);
  if (typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'boolean')
    return deserializeSingleArg(arg, game);
  throw Error(`unable to deserialize ${arg}`);
}

export const escapeArgument = <P extends Player>(arg: Argument<P>): string => {
  if (arg instanceof Array) {
    const escapees = arg.map(escapeArgument);
    return escapees.slice(0, -1).join(', ') + (escapees.length > 1 ? ' and ' : '') + (escapees[escapees.length - 1] || '');
  }
  if (typeof arg === 'object') return `[[${serializeSingleArg(arg)}|${humanizeArg(arg)}]]`;
  return String(arg);
}
