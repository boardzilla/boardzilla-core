import {
  Player,
  Board,
  SetupFunction,
  times,
} from '../index.js';
import type Game from '../game.js';

import { createGameStore } from './index.js';

import { createInterface } from '../interface.js';
import { Argument } from '../action/action.js';

export function test<P extends Player, B extends Board>(
  setup: SetupFunction,
  playerCount: number,
  settings: Record<string, any>,
  runner: (
    move: (
      position: number,
      moveFn: (board: B) => ({ name: string, args: Record<string, Argument<P>> })
    ) => void,
    expect: (
      assertion: (game: Game<P, B>) => boolean
    ) => void
  ) => void
) {

  const players = times(playerCount, p => ({
    id: String(p),
    name: String(p),
    position: p,
    host: p === 1,
    color: '',
    avatar: ''
  }));

  const serverGame = createInterface(setup);
  let previousState = serverGame.initialState({
    players,
    settings,
    rseed: 'test-rseed'
  }, 'test-rseed');
  let currentPosition = 1;

  // @ts-ignore
  globalThis.window = {
    clearTimeout: () => {},
    // @ts-ignore
    top: {
      postMessage: ({ data }) => {
        if (previousState.game.phase === 'finished') throw Error(`Game already finished. Cannot process move ${data.move}`);
        previousState = serverGame.processMove(previousState.game, { position: currentPosition, data } );
      }
    }
  };

  const playerUIs = players.map(p => {
    const store = createGameStore()
    const {setSetup} = store.getState();
    setSetup(setup);
    return {
      player: p,
      store
    };
  });

  const updateUI = () => {
    for (const ui of playerUIs) {
      const { updateState } = ui.store.getState();
      const state = previousState.players.find(state => state.position === ui.player.position)!;
      const playerState = (state.state instanceof Array) ? state.state[state.state.length - 1] : state.state;

      if (previousState.game.phase === 'started') {
        updateState({
          type: 'gameUpdate',
          state: playerState,
          position: state.position,
          currentPlayers: previousState.game.currentPlayers
        });
      }
    }
  };

  updateUI(); // initial

  const move = (position: number, moveFn: (board: B) => ({ name: string, args: Record<string, Argument<P>> })) => {
    const ui = playerUIs[position - 1];
    const state = ui.store.getState();
    globalThis.$ = state.game.board._ctx.namedSpaces;
    const playerMove = moveFn(state.game.board as B);
    currentPosition = position;
    state.selectMove({
      ...playerMove,
      selections: [],
      requireExplicitSubmit: false
    })
    updateUI();
  }

  const expect = (assertion: (game: Game) => boolean) => {
    const game = setup(previousState.game.state);
    if (previousState.game.phase === 'finished') {
      game.phase = 'finished';
      game.players.setCurrent([]);
      game.winner = previousState.game.winners.map(p => game.players.atPosition(p)!);
    }

    globalThis.$ = game.board._ctx.namedSpaces;
    console.assert(assertion(game));
  }

  runner(move, expect);
}
