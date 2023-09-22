// import * as Sentry from "@sentry/browser";
// import { BrowserTracing } from "@sentry/tracing";
import React from 'react'
import ReactDOM from 'react-dom'
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main'

import type { SetupComponentProps } from './types'
import type { Game, Board, GameElement, Player } from '../game'
import type { ElementJSON } from '../game/board/types'
import type { SetupFunction } from '../game/types'
import type { IncompleteMove, ResolvedSelection } from '../game/action/types'

type GameStore = {
  game: Game<Player, Board>;
  boardJSON: ElementJSON[];
  setGame: (g: Game<Player, Board>) => void;
  userID: string;
  setUserID: (u: string) => void;
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
}

export const gameStore = createWithEqualityFn<GameStore>()(set => ({
  game: undefined as unknown as Game<Player, Board>, // pretend always defined
  boardJSON: [],
  setGame: (game: Game<Player, Board>) => set({
    game,
    boardJSON: game.board.allJSON()
  }),
  userID: "",
  setUserID: userID => set({ userID }),
  // function to ensure react detects a change. must be called immediately after any function that alters game state
  updateBoard: () => {
    set(s => {
      const player = s.game.players.find(p => p.id == s.userID);
      if (!player) return { boardJSON: s.game.board.allJSON() };

      const {move, selection} = s.game.currentSelection(player);
      console.log('updateBoard', player.position, move, selection);
      return ({
        move,
        selection,
        player,
        boardJSON: s.game.board.allJSON()
      })
    });
  },
  setPlayer: p => set(state => {
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
  setMove: move => set({ move }),
  setSelection: selection => set({ selection }),
  selected: [],
  setSelected: sel => set({ selected: [...new Set(sel)] }),
  hilites: [],
  setHilites: hilites => set({ hilites }),
  uiOptions: {},
  setUIOptions: uiOptions => set({ uiOptions }),
}), shallow);

type UIOptions = {
  settings?: Record<string, React.ComponentType<SetupComponentProps>>
  appearance?: Record<string, (el: GameElement, contents: JSX.Element[]) => JSX.Element>
};

export default (setup: SetupFunction<Player, Board>, options: UIOptions): void => {
  gameStore.getState().setUIOptions(options);
  const bootstrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || "");
  const userID = bootstrap.userID;
  const game = setup({players: [], settings: {}}, false);
  gameStore.getState().setGame(game);
  gameStore.getState().setUserID(userID);
  
  ReactDOM.render(
    <Main/>,
    document.getElementById('root')
  )
};

export * from './setup/components/settingComponents';
