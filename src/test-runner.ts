import {
  Player,
  Board,
  SetupFunction,
  times,
} from './index.js';
import type Game from './game.js';

import { createGameStore } from './ui/index.js';

import { GameInterface, GameUpdate, createInterface } from './interface.js';
import { Argument } from './action/action.js';
import { PlayerAttributes } from './game.js';

declare global {
  interface Window {
    serverBoard?: Board;
  }
}

class TestRunnerPlayer<P extends Player, B extends Board> {
  runner: TestRunner<P, B>
  store: ReturnType<typeof createGameStore>
  player: PlayerAttributes<Player>
  game: Game
  board: Board
  position: number

  constructor(runner: TestRunner<P, B>, position: number, store: ReturnType<typeof createGameStore>, player: PlayerAttributes<Player>, game: Game, board: Board) {
    this.runner = runner
    this.position = position
    this.store = store
    this.player = player
    this.game = game
    this.board = board
  }

  move(name: string, args: Record<string, Argument<P>>) {
    if (!this.runner.server.state) throw Error("Must call TestRunner#start first");
    if (this.runner.server.state!.game.phase === 'finished') throw Error("Cannot take a move on a finished game");
    if (!this.runner.server.state!.game.currentPlayers.includes(this.position)) throw Error("This player cannot take a move");
    const state = this.store.getState();
    globalThis.$ = state.game.board._ctx.namedSpaces;
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
    const pendingMoves = this.game.getPendingMoves(this.runner.server.game.players[this.position - 1]);
    if (!pendingMoves) return [];
    return pendingMoves.moves.map(m => m.name);
  }
}

export class TestRunner<P extends Player, B extends Board> {
  server: {
    interface: GameInterface<Player>;
    state?: GameUpdate<Player>;
    game: Game<P, B>;
    board: B
  };

  currentPosition: number = 1;

  players: TestRunnerPlayer<P, B>[]

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
  }): TestRunnerPlayer<P, B>[] {
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
      const {setSetup, game} = store.getState();
      setSetup(this.setup);
      return new TestRunnerPlayer(this, i+1, store, p, game, game.board)
    });
    this.updatePlayers(); // initial
    return this.players
  }

  getCurrentGame() {
    this.server.game = globalThis.window.serverBoard?.game as Game<P, B>;
    this.server.board = this.server.game.board;
  }

  updatePlayers() {
    for (const player of this.players) {
      const { updateState } = player.store.getState();
      const state = this.server.state!.players.find(state => state.position === player.player.position)!;
      const playerState = (state.state instanceof Array) ? state.state[state.state.length - 1] : state.state;

      if (this.server.state!.game.phase === 'started') {
        updateState({
          type: 'gameUpdate',
          state: playerState,
          position: state.position,
          currentPlayers: this.server.state!.game.currentPlayers
        });
        const { game } = player.store.getState();
        player.game = game;
        player.board = game.board;
      }
    }
  }
}
