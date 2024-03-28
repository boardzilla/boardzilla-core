import { createGameStore } from './ui/store.js';
import { createInterface } from './interface.js';
import { times } from './utils.js';

import type { BaseGame } from './board/game.js';
import type { GameInterface, GameState, GameUpdate, SetupState } from './interface.js';
import type { Argument } from './action/action.js';
import type { SetupFunction } from './index.js';
import type { default as GameManager, PlayerAttributes } from './game-manager.js';

declare global {
  interface Window {
    serverGameManager?: GameManager;
  }
}

class TestRunnerPlayer<G extends BaseGame> {
  runner: TestRunner<G>
  store: ReturnType<typeof createGameStore>
  playerAttrs: PlayerAttributes
  player: NonNullable<G['player']>
  game: G
  position: number

  constructor(runner: TestRunner<G>, position: number, store: ReturnType<typeof createGameStore>, playerAttrs: PlayerAttributes, game: G) {
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
    this.runner.updatePlayersFromState();
  }

  actions() {
    const pendingMoves = this.game._ctx.gameManager.getPendingMoves(this.game._ctx.gameManager.players[this.position - 1]);
    if (!pendingMoves) return [];
    return pendingMoves.moves.map(m => m.name);
  }
}

export class TestRunner<G extends BaseGame> {
  server: {
    interface: GameInterface;
    state?: GameUpdate;
    gameManager: GameManager;
    game: G
  };

  currentPosition: number = 1;

  players: TestRunnerPlayer<G>[]

  constructor(private setup: SetupFunction, mocks?: (game: G) => void) {
    if (mocks) {
      this.setup = (state: SetupState | GameState, options?: {
        rseed?: string;
        trackMovement?: boolean;
      }) => setup(state, {...options, mocks});
    }
    const iface = createInterface(this.setup)

    this.server = {
      interface: iface,
    } as typeof this['server'];

    globalThis.window = {
      setTimeout,
      clearTimeout,
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
  }): TestRunnerPlayer<G>[] {
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
      randomSeed: 'test-rseed'
    });

    this.getCurrentGame();
    this.players = playerAttrs.map((p, i) => {
      const store = createGameStore()
      const {setSetup, gameManager} = store.getState();
      setSetup(this.setup);
      return new TestRunnerPlayer(this, i + 1, store, p as unknown as PlayerAttributes, gameManager.game as G)
    });
    this.updatePlayersFromState(); // initial
    return this.players
  }

  getCurrentGame() {
    this.server.gameManager = globalThis.window.serverGameManager as GameManager;
    this.server.game = this.server.gameManager.game as G;
  }

  updatePlayers() {
    this.server.state = this.server.gameManager.getUpdate();
    this.updatePlayersFromState();
  }

  updatePlayersFromState() {
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
      player.game = gameManager.game as G;
      player.player = gameManager.players.atPosition(player.position)!;
    }
  }
}
