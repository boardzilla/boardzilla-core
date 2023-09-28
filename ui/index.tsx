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

const boostrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || '{}');
const userID: string = boostrap.userID;
const minPlayers: number = boostrap.minPlayers;
const maxPlayers: number = boostrap.maxPlayers;

type GameStore = {
  game?: Game<Player, Board<Player>>;
  boardJSON: ElementJSON[];
  setGame: (g: Game<Player, Board<Player>>) => void;
  updateBoard: () => void;
  position?: number;
  setPosition: (p: number) => void;
  move?: IncompleteMove<Player>;
  setMove: (m?: IncompleteMove<Player>) => void;
  selection?: ResolvedSelection<Player>;
  setSelection: (s?: ResolvedSelection<Player>) => void;
  selected: GameElement<Player>[];
  setSelected: (s: GameElement<Player>[]) => void;
  hilites: GameElement<Player>[];
  setHilites: (h: GameElement<Player>[]) => void;
  uiOptions: UIOptions<Player>;
  setUIOptions: (o: UIOptions<Player>) => void;
}

export const gameStore = createWithEqualityFn<GameStore>()(set => ({
  boardJSON: [],
  setGame: (game: Game<Player, Board<Player>>) => {
    // @ts-ignore;
    window.game = game;
    // @ts-ignore;
    window.board = game.board;
    return set({
      game,
      boardJSON: game.board.allJSON()
    });
  },
  // function to ensure react detects a change. must be called immediately after any function that alters game state
  updateBoard: () => set(s => {
    if (!s.game || !s.position) return {};
    const player = s.game.players.atPosition(s.position);
    if (!player) return {};
    const {move, selection} = s.game.currentSelection(player);
    console.log('updateBoard', s.position, move, selection);
    return ({
      move,
      selection,
      boardJSON: s.game.board.allJSON()
    })
  }),
  setPosition: position => { console.log('setPosition', position); return set({ position }) },
  setMove: move => set({ move }),
  setSelection: selection => set({ selection }),
  selected: [],
  setSelected: sel => set({ selected: [...new Set(sel)] }),
  hilites: [],
  setHilites: hilites => set({ hilites }),
  uiOptions: {},
  setUIOptions: uiOptions => set({ uiOptions }),
}), shallow);

type UIOptions<P extends Player> = {
  settings?: Record<string, (p: SetupComponentProps) => JSX.Element>
  appearance?: Record<string, (el: GameElement<P>, contents: JSX.Element[]) => JSX.Element>
};

export default <P extends Player>(setup: SetupFunction<P, Board<P>>, options: UIOptions<P>): void => {
  gameStore.getState().setUIOptions(options as UIOptions<Player>);
  
  ReactDOM.render(
    // we can anonymize Player class internally
    <Main
      userID={userID}
      minPlayers={minPlayers}
      maxPlayers={maxPlayers}
      setup={setup as unknown as SetupFunction<Player, Board<Player>>}
    />,
    document.getElementById('root')
  )
};

export * from './setup/components/settingComponents';
