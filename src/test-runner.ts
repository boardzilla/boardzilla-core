import {
  Game,
  SetupFunction,
  times,
} from './index.js';
import type { default as GameManager, PlayerAttributes } from './game-manager.js';

import { createGameStore } from './ui/index.js';

import { GameInterface, GameUpdate, createInterface } from './interface.js';
import { Argument } from './action/action.js';

declare global {
  interface Window {
    serverGameManager?: GameManager;
  }
}

class TestRunnerPlayer<B extends Game> {
  runner: TestRunner<B>
  store: ReturnType<typeof createGameStore>
  playerAttrs: PlayerAttributes
  player: NonNullable<B['player']>
  game: B
  position: number

  constructor(runner: TestRunner<B>, position: number, store: ReturnType<typeof createGameStore>, playerAttrs: PlayerAttributes, game: B) {
    this.runner = runner
    this.position = position
    this.store = store
    this.playerAttrs = playerAttrs
    this.game = game
  }

  move(name: string, args: Record<string, Argument>) {
    if (!this.runner.server.state) throw Error("Must call TestRunner#start first");
    if (this.runner.server.state!.game.phase === 'finished') throw Error("Cannot take a move on a finished game");
    if (!this.runner.server.state!.game.currentPlayers.includes(this.position)) throw Error("This player cannot take a move");
    const state = this.store.getState();
    globalThis.$ = state.gameManager.game._ctx.namedSpaces;
    this.runner.currentPosition = this.position;
    state.selectMove({
      name,
      args,
      selections: [],
      requireExplicitSubmit: false
    })
    this.runner.updatePlayers();
  }

  actions() {
    const pendingMoves = this.game._ctx.gameManager.getPendingMoves(this.game._ctx.gameManager.players[this.position - 1]);
    if (!pendingMoves) return [];
    return pendingMoves.moves.map(m => m.name);
  }
}

export class TestRunner<B extends Game> {
  server: {
    interface: GameInterface;
    state?: GameUpdate;
    gameManager: GameManager;
    game: B
  };

  currentPosition: number = 1;

  players: TestRunnerPlayer<B>[]

  constructor(private setup: SetupFunction) {
    const iface = createInterface(setup)

    this.server = {
      interface: iface,
    } as typeof this['server'];

    globalThis.window = {
      clearTimeout: () => {},
      top: {
        postMessage: ({ data }: { data: any }) => {
          if (this.server.state!.game.phase === 'finished') throw Error(`Game already finished. Cannot process move ${data.move}`);
          this.server.state = this.server.interface.processMove(
            this.server.state!.game,
            {
              position: this.currentPosition,
              data
            }
          );
          this.getCurrentGame();
        }
      }
    } as unknown as typeof globalThis.window;
  }

  start({players, settings}: {
    players: number,
    settings: Record<string, any>
  }): TestRunnerPlayer<B>[] {
    const playerAttrs = times(players, p => ({
      id: String(p),
      name: String(p),
      position: p,
      host: p === 1,
      color: '',
      avatar: ''
    }));

    this.server.state = this.server.interface.initialState({
      players: playerAttrs,
      settings,
      rseed: 'test-rseed'
    }, 'test-rseed');

    this.getCurrentGame();
    this.players = playerAttrs.map((p, i) => {
      const store = createGameStore()
      const {setSetup, gameManager} = store.getState();
      setSetup(this.setup);
      return new TestRunnerPlayer(this, i + 1, store, p as unknown as PlayerAttributes, gameManager.game as B)
    });
    this.updatePlayers(); // initial
    return this.players
  }

  getCurrentGame() {
    this.server.gameManager = globalThis.window.serverGameManager as GameManager;
    this.server.game = this.server.gameManager.game as B;
  }

  updatePlayers() {
    for (const player of this.players) {
      const { updateState } = player.store.getState();
      const state = this.server.state!.players.find(state => state.position === player.position)!;
      const playerState = (state.state instanceof Array) ? state.state[state.state.length - 1] : state.state;

      if (this.server.state!.game.phase === 'started') {
        updateState({
          type: 'gameUpdate',
          state: playerState,
          position: state.position,
          currentPlayers: this.server.state!.game.currentPlayers
        });
      }
      if (this.server.state!.game.phase === 'finished') {
        updateState({
          type: 'gameFinished',
          state: playerState,
          position: state.position,
          winners: this.server.gameManager.winner.map(p => p.position),
        });
      }
      const { gameManager } = player.store.getState();
      player.game = gameManager.game as B;
      player.player = gameManager.players.atPosition(player.position)!;
    }
  }
}
