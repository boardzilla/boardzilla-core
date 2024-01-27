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

export class TestRunner<P extends Player, B extends Board> {
  server: {
    interface: GameInterface<Player>;
    state?: GameUpdate<Player>;
    game: () => Game<P, B>;
  };

  currentPosition: number = 1;

  players: {
    store: ReturnType<typeof createGameStore>,
    player: PlayerAttributes<Player>
    game: Game,
    board: Board,
  }[]

  constructor(private setup: SetupFunction) {
    const iface = createInterface(setup)

    this.server = {
      interface: iface,
      game: () => {
        if (!this.server.state) throw Error("Must call TestRunner#start first");
        const game = setup(this.server.state.game.state);
        if (this.server.state.game.phase === 'finished') {
          game.phase = 'finished';
          game.players.setCurrent([]);
          game.winner = this.server.state.game.winners.map(p => game.players.atPosition(p)!);
        }
        return game;
      }
    };

    // @ts-ignore
    globalThis.window = {
      clearTimeout: () => {},
      // @ts-ignore
      top: {
        postMessage: ({ data }) => {
          if (this.server.state!.game.phase === 'finished') throw Error(`Game already finished. Cannot process move ${data.move}`);
          this.server.state = this.server.interface.processMove(
            this.server.state!.game,
            {
              position: this.currentPosition,
              data
            }
          );
        }
      }
    };
  }

  start({players, settings}: {
    players: number,
    settings: Record<string, any>
  }) {
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

    this.players = playerAttrs.map(p => {
      const store = createGameStore()
      const {setSetup, game} = store.getState();
      setSetup(this.setup);

      return {
        player: p,
        store,
        game,
        board: game.board
      };
    });

    this.updatePlayers(); // initial
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

  move(position: number, name: string, args: Record<string, Argument<P>>) {
    if (!this.server.state) throw Error("Must call TestRunner#start first");
    const player = this.players[position - 1];
    const state = player.store.getState();
    globalThis.$ = state.game.board._ctx.namedSpaces;
    this.currentPosition = position;
    state.selectMove({
      name,
      args,
      selections: [],
      requireExplicitSubmit: false
    })
    this.updatePlayers();
  }

  availableActions(position: number) {
    const pendingMoves = this.players[position - 1].game.getPendingMoves(this.server.game().players[position - 1]);
    if (!pendingMoves) return [];
    return pendingMoves.moves.map(m => m.name);
  }
}
