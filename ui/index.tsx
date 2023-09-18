// import * as Sentry from "@sentry/browser";
// import { BrowserTracing } from "@sentry/tracing";
import React from 'react'
import ReactDOM from 'react-dom'
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main'

import type { SetupComponentProps } from './types'
import type { Game, Board, GameElement, Player } from '../game'
import type { GameInterface } from '../game/types'
import type { ElementJSON } from '../game/board/types'
import type { IncompleteMove, ResolvedSelection } from '../game/action/types'
// Sentry.init({
//   dsn: "https://c149a1d2a5464aae80d74fddcb7f1f1a@o1206738.ingest.sentry.io/6340273",
//   integrations: [new BrowserTracing()],
//   tracesSampleRate: 1.0,
// });

// export {default as Counter} from './components/Counter';
// export {default as Die} from './components/Die';
// export { times } from './utils';

type GameStore = {
  game?: Game<Player, Board>;
  board?: Board;
  boardJSON: ElementJSON[];
  setGame: (g: Game<Player, Board>) => void;
  updateBoard: () => void;
  player?: Player;
  setPlayer: (p: number) => void;
  move?: IncompleteMove<Player>;
  setMove: (m?: IncompleteMove<Player>) => void;
  selection?: ResolvedSelection;
  setSelection: (s?: ResolvedSelection) => void;
  selected: GameElement[];
  setSelected: (s: GameElement[]) => void;
  hilites: GameElement[];
  setHilites: (h: GameElement[]) => void;
  uiOptions: UIOptions;
  setUIOptions: (o: UIOptions) => void;
  autoplay: boolean;
  toggleAutoplay: () => void;
}

export const gameStore = createWithEqualityFn<GameStore>()(set => ({
  boardJSON: [],
  setGame: (game: Game<Player, Board>) => set({
    game,
    board: game.board,
    boardJSON: game.board.allJSON()
  }),
  updateBoard: () => {
    set(s => {
      if (!s.game || !s.player) return {};
      // auto-switch to new player in debug
      const player = s.game.players.currentPosition ? s.game.players.current() : s.player;
      if (s.move) console.error(s.move, 'during updateBoard? why?');
      const {move, selection} = s.game.currentSelection(player);
      console.log('updateBoard', player.position, move, selection);
      return ({
        move,
        selection,
        player,
        boardJSON: s.game?.board.allJSON()
      })
    });
  },
  setPlayer: (p: number) => set(state => {
    if (!state.game) return {};
    const player = state.game.players.atPosition(p);
    if (!player) return {};
    const {move, selection} = state.game.currentSelection(player);
    console.log('setPlayer', selection);
    return ({
      player,
      move,
      selection,
    })
  }),
  setMove: (move?: IncompleteMove<Player>) => set({ move }),
  setSelection: (selection?: ResolvedSelection) => set({ selection }),
  selected: [],
  setSelected: sel => set({ selected: [...new Set(sel)] }),
  hilites: [],
  setHilites: hilites => set({ hilites }),
  uiOptions: {},
  setUIOptions: uiOptions => set({ uiOptions }),
  autoplay: true,
  toggleAutoplay: () => set(s => ({ autoplay: !s.autoplay })),
}), shallow);

type UIOptions = {
  settings?: Record<string, React.ComponentType<SetupComponentProps>>
  appearance?: Record<string, (el: GameElement, contents: JSX.Element[]) => JSX.Element>
};

export default (gameInterface: GameInterface<Player, Board>, options: UIOptions): void => {
  gameStore.getState().setUIOptions(options);
  // const bootstrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || "{}");
  // gameStore.getState().setPlayer(bootstrap.currentPlayer);
  // const game = gameInterface.initialState(bootstrap.players, bootstrap.setup);
  // game.play();
  // gameStore.getState().setGame(game);
  
  ReactDOM.render(
    <Main gameInterface={gameInterface}/>,
    document.getElementById('root')
  )
};

                                   
export * from './setup/components/settingComponents';
