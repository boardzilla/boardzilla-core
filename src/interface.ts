import { deserializeArg } from './action/utils.js';
import { range } from './utils.js';
import random from 'random-seed';

import type { ElementJSON } from './board/element.js';
import type { PlayerAttributes, Message, SerializedMove } from './game-manager.js';
import type Player from './player/player.js';
import type { FlowBranchJSON } from './flow/flow.js';
import type { SetupFunction } from './game-creator.js';
import type { SerializedArg } from './action/utils.js';

export type SetupState = {
  players: (PlayerAttributes & Record<string, any>)[],
  settings: Record<string, any>,
  randomSeed: string,
}

export type GameState = {
  players: PlayerAttributes[],
  settings: Record<string, any>,
  position: {name?: string, args?: Record<string, any>, currentPosition: number[], stack: FlowBranchJSON[]}[],
  board: ElementJSON[],
  sequence: number,
  rseed: string,
  messages: Message[],
  announcements: string[],
}

type GameStartedState = {
  phase: 'started',
  currentPlayers: number[],
  state: GameState,
}

type GameFinishedState = {
  phase: 'finished',
  winners: number[],
  state: GameState,
}

export type PlayerState = {
  position: number
  state: GameState | GameState[] // Game state, scrubbed
  summary?: string
  score?: number
}

export type GameUpdate = {
  game: GameStartedState | GameFinishedState
  players: PlayerState[]
  messages: Message[]
}

type ReprocessHistoryResult = {
  initialState: GameUpdate
  updates: GameUpdate[]
  error?: string
}

type SerializedInterfaceMove = {
  position: number
  data: SerializedMove | SerializedMove[]
}

export type GameInterface = {
  initialState: (state: SetupState) => GameUpdate
  processMove: (previousState: GameStartedState, move: SerializedInterfaceMove) => GameUpdate
  seatPlayer(players: Player[], seatCount: number): {position: number, color: string, settings: any} | null
  reprocessHistory(setup: SetupState, moves: SerializedInterfaceMove[]): ReprocessHistoryResult
}

export const colors = [
  '#d50000', '#00695c', '#304ffe', '#ff6f00', '#7c4dff',
  '#ffa825', '#f2d330', '#43a047', '#004d40', '#795a4f',
  '#00838f', '#408074', '#448aff', '#1a237e', '#ff4081',
  '#bf360c', '#4a148c', '#aa00ff', '#455a64', '#600020'
];

function advanceRseed(rseed?: string) {
  if (!rseed) {
    rseed = String(Math.random());
  } else {
    rseed = String(random.create(rseed).random());
  }

  return rseed;
}

export const createInterface = (setup: SetupFunction): GameInterface => {
  return {
    initialState: (state: SetupState): GameUpdate => {
      let rseed = state.randomSeed;
      if (!rseed) {
        if (globalThis.window?.sessionStorage) { // web context, use a fixed initial seed for dev
          let fixedRseed = sessionStorage.getItem('rseed') as string;
          if (!fixedRseed) {
            fixedRseed = String(Math.random());
            sessionStorage.setItem('rseed', fixedRseed);
          }
          rseed = fixedRseed;
        }
        if (!rseed) rseed = advanceRseed(); // set the seed first because createGame may call random()
      }
      const gameManager = setup(state, {rseed, trackMovement: true});
      if (globalThis.window) window.serverGameManager = gameManager;
      if (gameManager.phase !== 'finished') gameManager.play();
      return gameManager.getUpdate();
    },
    processMove: (
      previousState: GameStartedState,
      move: SerializedInterfaceMove,
    ): GameUpdate => {
      const rseed = advanceRseed(previousState.state.rseed);
      previousState.state.rseed = rseed;

      const gameManager = setup(previousState.state, {rseed, trackMovement: true});
      const player = gameManager.players.atPosition(move.position)!;
      // @ts-ignore
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
        if (gameManager.phase === 'finished') break;
        gameManager.play();
      }

      return gameManager.getUpdate();
    },

    seatPlayer: (players: Player[], seatCount: number): {position: number, color: string, settings: any} | null => {
      let usedPositions = range(1, seatCount);
      let usedColors = [...colors];
      for (const player of players) {
        usedPositions = usedPositions.filter(position => position !== player.position);
        usedColors = usedColors.filter(color => color !== player.color);
      }
      if (usedPositions.length) {
        return {
          position: usedPositions[0],
          color: usedColors[0],
          settings: {}
        };
      }
      return null;
    },

    reprocessHistory(state: SetupState, moves: SerializedInterfaceMove[]): ReprocessHistoryResult {
      let rseed = state.randomSeed;
      const gameManager = setup(state, {rseed, trackMovement: false});
      if (gameManager.phase !== 'finished') gameManager.play();
      const initialState = gameManager.getUpdate();
      let error = undefined;
      const updates: GameUpdate[] = [];

      for (const move of moves) {
        rseed = advanceRseed(rseed);
        gameManager.setRandomSeed(rseed);
        gameManager.messages = [];
        gameManager.announcements = [];
        gameManager.intermediateUpdates = [];
        const player = gameManager.players.atPosition(move.position)!;
        if (!(move.data instanceof Array)) move.data = [move.data];

        for (let i = 0; i !== move.data.length; i++) {
          try {
            error = gameManager.processMove({
              player,
              name: move.data[i].name,
              args: Object.fromEntries(Object.entries(move.data[i].args).map(([k, v]) => [k, deserializeArg(v as SerializedArg, gameManager.game)]))
            });
          } catch (e) {
            error = e.message;
          }
          if (error || gameManager.phase === 'finished') break;
          gameManager.play();
        }
        if (error) break;
        updates.push(gameManager.getUpdate());
        if (gameManager.phase === 'finished') break;
      }

      return {
        initialState,
        updates,
        error
      };
    }
  };
}
