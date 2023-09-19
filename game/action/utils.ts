import { Player } from '../player';
import { GameElement } from '../board';

import type { Argument, SingleArgument, SerializedArg, SerializedSingleArg } from './types';
import type { Game } from '../';
import type { Board } from '../board';

export const humanizeArg = (arg: Argument) => {
  if (arg instanceof Player) return arg.name;
  if (arg instanceof GameElement) return arg.name || `$el[${arg.branch()}]`; // ??
  return arg.toString();
}

export const serializeArg = (arg: Argument, forPlayer=true): SerializedArg => {
  if (arg instanceof Array) return arg.map(a => serializeSingleArg(a, forPlayer));
  return serializeSingleArg(arg, forPlayer);
}

export const serializeSingleArg = (arg: SingleArgument, forPlayer=true): SerializedSingleArg => {
  if (arg instanceof Player) return `$p[${arg.position}]`;
  if (arg instanceof GameElement) return forPlayer ? `$el[${arg.branch()}]` : `$eid[${arg._t.id}]`;
  return arg;
}

export const deserializeArg = (arg: SerializedArg, game: Game<Player, Board>): Argument => {
  if (arg instanceof Array) return arg.map(a => deserializeSingleArg(a, game)) as GameElement[];
  return deserializeSingleArg(arg, game);
}

export const deserializeSingleArg = (arg: SerializedSingleArg, game: Game<Player, Board>): SingleArgument => {
  if (typeof arg === 'number' || typeof arg === 'boolean') return arg;
  let deser: SingleArgument | undefined;
  if (arg.slice(0, 3) === '$p[') {
    deser = game.players.atPosition(parseInt(arg.slice(3, -1)));
  } else if (arg.slice(0, 4) === '$el[') {
    deser = game.board.atBranch(arg.slice(4, -1));
  } else if (arg.slice(0, 5) === '$eid[') {
    deser = game.board.atID(parseInt(arg.slice(5, -1)));
  } else {
    return arg;
  }
  if (!deser) throw Error(`Unable to find arg: ${arg}`);
  return deser;
}
