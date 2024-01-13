import { deserializeArg } from './action/utils.js';
import random from 'random-seed';

import type { ElementJSON } from './board/element.js';
import type Board from './board/board.js';
import type { default as Game, PlayerAttributes, Message, SerializedMove } from './game.js';
import type Player from './player/player.js';
import type { FlowBranchJSON } from './flow/flow.js';
import type { SetupFunction } from './index.js';
import type { SerializedArg } from './action/utils.js';

export type SetupState<P extends Player> = {
  players: (PlayerAttributes<P> & Record<string, any>)[],
  settings: Record<string, any>,
  rseed: string,
}

export type GameState<P extends Player> = {
  players: PlayerAttributes<P>[],
  settings: Record<string, any>,
  position: FlowBranchJSON[],
  board: ElementJSON[],
  sequence: number,
  rseed: string,
}

type GameStartedState<P extends Player> = {
  phase: 'started',
  currentPlayers: number[],
  state: GameState<P>,
}

type GameFinishedState<P extends Player> = {
  phase: 'finished',
  winners: number[],
  state: GameState<P>,
}

export type PlayerState<P extends Player> = {
  position: number
  state: GameState<P> | GameState<P>[] // Game state, scrubbed
  summary?: string
  score?: number
}

export type GameUpdate<P extends Player> = {
  game: GameStartedState<P> | GameFinishedState<P>
  players: PlayerState<P>[]
  messages: Message[]
}

export type GameInterface<P extends Player> = {
  initialState: (state: SetupState<P>, rseed: string) => GameUpdate<P>
  processMove: (
    previousState: GameStartedState<P>,
    move: {
      position: number
      data: SerializedMove
    },
  ) => GameUpdate<P>
  getPlayerState: (
    state: GameState<P>,
    position: number
  ) => GameState<P>
}

function advanceRseed(rseed?: string) {
  if (!rseed) {
    rseed = String(Math.random());
  } else {
    rseed = String(random.create(rseed).random());
  }

  return rseed;
}

export const createInteface = (setup: SetupFunction<Player, Board<Player>>): GameInterface<Player> => {
  return {
    initialState: (state: SetupState<Player>): GameUpdate<Player> => {
      if (globalThis.window?.sessionStorage) { // web context, use a fixed initial seed for dev
        let fixedRseed = sessionStorage.getItem('rseed') as string;
        if (!fixedRseed) {
          fixedRseed = String(Math.random());
          sessionStorage.setItem('rseed', fixedRseed);
        }
        state.rseed = fixedRseed;
      }
      if (!state.rseed) state.rseed = advanceRseed(); // set the seed first because createGame may call random()
      const game = setup(state);
      if (game.phase !== 'finished') game.play();
      return game.getUpdate();
    },
    processMove: (
      previousState: GameStartedState<Player>,
      move: {
        position: number,
        data: SerializedMove | SerializedMove[]
      },
    ): GameUpdate<Player> => {
      //console.time('processMove');
      let cachedGame: Game<Player, Board<Player>> | undefined = undefined;
      // @ts-ignore
      if (globalThis.window && window.board && window.lastGame > new Date() - 10 && window.json === JSON.stringify(previousState)) cachedGame = window.board._ctx.game;
      const rseed = advanceRseed(cachedGame?.rseed || previousState.state.rseed);
      if (cachedGame) {
        cachedGame.setRandomSeed(rseed);
      } else {
        previousState.state.rseed = rseed;
      }

      const game = cachedGame || setup(previousState.state, {trackMovement: true});
      game.players.setCurrent(previousState.currentPlayers),
      //console.timeLog('processMove', cachedGame ? 'restore cached game' : 'setup');
      game.messages = [];
      if (!(move.data instanceof Array)) move.data = [move.data];

      let error = undefined;
      for (let i = 0; i !== move.data.length; i++) {
        error = game.processMove({
          player: game.players.atPosition(move.position)!,
          name: move.data[i].name,
          args: Object.fromEntries(Object.entries(move.data[i].args).map(([k, v]) => [k, deserializeArg(v as SerializedArg, game)]))
        });
        if (error) {
          throw Error(`Unable to process move: ${error}`);
        }
        //console.timeLog('processMove', 'process');
        if (game.phase !== 'finished') game.play();
        //console.timeLog('processMove', 'play');
        if (game.phase === 'finished') break;
      }

      const update = game.getUpdate();
      //console.timeLog('processMove', 'update');

      // @ts-ignore
      if (globalThis.window) window.board = game.board;
      // @ts-ignore
      if (globalThis.window) { window.json = JSON.stringify(update.game); window.lastGame = new Date() }
      //console.timeEnd('processMove');
      return update;
    },
    getPlayerState: (state: GameState<Player>, position: number): GameState<Player> => {
      if (!position) throw Error('getPlayerState without position');
      const game = setup(state);
      return game.getState(game.players.atPosition(position));
    }
  };
}
