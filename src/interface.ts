import { deserializeArg } from './action/utils.js';
import random from 'random-seed';

import type { ElementJSON } from './board/element.js';
import type Game from './board/game.js';
import type { default as GameManager, PlayerAttributes, Message, SerializedMove } from './game-manager.js';
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
  messages: Message[],
  announcements: string[],
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

function cacheGameOnWindow(game: GameManager, update: GameUpdate<Player>) {
  // @ts-ignore
  if (globalThis.window) window.serverGameManager = game;
  // @ts-ignore
  if (globalThis.window) { window.json = JSON.stringify(update.game); window.lastGame = new Date() }
}

export const createInterface = (setup: SetupFunction<Player, Game<Player>>): GameInterface<Player> => {
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
      const gameManager = setup(state, {trackMovement: true});
      if (gameManager.phase !== 'finished') gameManager.play();
      const update = gameManager.getUpdate();
      cacheGameOnWindow(gameManager, update);
      return update;
    },
    processMove: (
      previousState: GameStartedState<Player>,
      move: {
        position: number,
        data: SerializedMove | SerializedMove[]
      },
    ): GameUpdate<Player> => {
      //console.time('processMove');
      let cachedGame: GameManager<Player, Game<Player>> | undefined = undefined;
      // @ts-ignore
      if (globalThis.window && window.serverGame && window.lastGame > new Date() - 20 && window.json === JSON.stringify(previousState)) cachedGame = window.serverGameManager;
      const rseed = advanceRseed(cachedGame?.rseed || previousState.state.rseed);
      if (cachedGame) {
        cachedGame.setRandomSeed(rseed);
        globalThis.$ = cachedGame.game._ctx.namedSpaces;
      } else {
        previousState.state.rseed = rseed;
      }

      if (cachedGame) {
        cachedGame.trackMovement(false);
        cachedGame.intermediateUpdates = [];
      }
      const gameManager = cachedGame || setup(previousState.state, {trackMovement: true});
      gameManager.players.setCurrent(previousState.currentPlayers);
      const player = gameManager.players.atPosition(move.position)!;
      // @ts-ignore
      //console.timeLog('processMove', cachedGame ? 'restore cached game' : 'setup');
      gameManager.messages = [];
      gameManager.announcements = [];
      if (!(move.data instanceof Array)) move.data = [move.data];

      let error = undefined;
      for (let i = 0; i !== move.data.length; i++) {
        error = gameManager.processMove({
          player,
          name: move.data[i].name,
          args: Object.fromEntries(Object.entries(move.data[i].args).map(([k, v]) => [k, deserializeArg(v as SerializedArg, gameManager.game)]))
        });
        if (error) {
          throw Error(`Unable to process move: ${error}`);
        }
        //console.timeLog('processMove', 'process');
        if (gameManager.phase !== 'finished') gameManager.play();
        //console.timeLog('processMove', 'play');
        if (gameManager.phase === 'finished') break;
      }

      const update = gameManager.getUpdate();
      //console.timeLog('processMove', 'update');
      cacheGameOnWindow(gameManager, update);
      //console.timeEnd('processMove');
      return update;
    },
    getPlayerState: (state: GameState<Player>, position: number): GameState<Player> => {
      if (!position) throw Error('getPlayerState without position');
      const gameManager = setup(state);
      return gameManager.getState(gameManager.players.atPosition(position));
    }
  };
}
