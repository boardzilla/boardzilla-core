import { Player } from '../player';
import { GameElement } from '../board';

import type { Argument, SerializedArg } from './types';
import type { Game } from '../';
import type { Board } from '../board';

export const humanizeArg = (arg: Argument) => {
  if (arg instanceof Player) return arg.name;
  if (arg instanceof GameElement) return `$el[${arg.branch()}]`; // ??
  return arg.toString();
}

export const serializeArg = (arg: Argument): SerializedArg => {
  if (arg instanceof Array) return JSON.stringify(arg.map(a => serializeSingleArg(a))) as SerializedArg;
  return JSON.stringify(serializeSingleArg(arg)) as SerializedArg;
}

export const serializeSingleArg = (arg: string | number | boolean | Player | GameElement): string | number | boolean => {
  if (arg instanceof Player) return `$p[${arg.position}]`;
  if (arg instanceof GameElement) return `$el[${arg.branch()}]`;
  return arg;
}

export const deserializeArg = (arg: SerializedArg, game: Game<Player, Board>): Argument => {
  const o = JSON.parse(arg) as string | number | boolean | string[] | number[] | boolean[];
  if (o instanceof Array) return o.map(a => deserializeSingleArg(a, game)) as GameElement[];
  return deserializeSingleArg(o, game);
}

const deserializeSingleArg = (arg: string | number | boolean, game: Game<Player, Board>): GameElement | Player | string | number | boolean => {
  if (typeof arg === 'number' || typeof arg === 'boolean') return arg;
  if (arg.slice(0, 3) === '$p[') return game.players.atPosition(parseInt(arg.slice(3, -1)))!;
  if (arg.slice(0, 4) === '$el[') return game.board.atBranch(arg.slice(4, -1))!;
  return arg;
}
