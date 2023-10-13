// import * as Sentry from "@sentry/browser";
// import { BrowserTracing } from "@sentry/tracing";
import React from 'react'
import ReactDOM from 'react-dom'
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main'
import { deriveSelections } from './actions';

import type { UIOptions } from './types'
import type { Game, Player } from '../game'
import type { Board, GameElement } from '../game/board'
import type { ElementJSON } from '../game/board/types'
import type { SetupFunction } from '../game/types'
import type { IncompleteMove, ResolvedSelection } from '../game/action/types'

const boostrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || '{}');
const userID: string = boostrap.userID;
const minPlayers: number = boostrap.minPlayers;
const maxPlayers: number = boostrap.maxPlayers;

type GameStore = {
  game?: Game<Player, Board<Player>>;
  boardJSON: ElementJSON[]; // cache complete immutable json here, listen to this for board changes
  setGame: (g: Game<Player, Board<Player>>) => void; // will call once on first server update to set the client instance
  updateBoard: () => void; // call any time state changes to update immutable references for listeners. updates move, selections
  position?: number; // this player
  setPosition: (p: number) => void;
  move?: IncompleteMove<Player>; // move in progress
  setMove: (m?: IncompleteMove<Player>) => void;
  boardSelections: Map<GameElement<Player>, IncompleteMove<Player>[]>;
  nonBoardSelections: Map<ResolvedSelection<Player>, IncompleteMove<Player>>;
  prompt?: string; // prompt for choosing action if applicable
  selected: GameElement<Player>[]; // selected elements on board
  setSelected: (s: GameElement<Player>[]) => void;
  hilites: GameElement<Player>[]; // hilited elements
  setHilites: (h: GameElement<Player>[]) => void;
  uiOptions: UIOptions;
  setUIOptions: (o: UIOptions) => void;
}

export const gameStore = createWithEqualityFn<GameStore>()(set => ({
  boardJSON: [],
  setGame: (game: Game<Player, Board<Player>>) => {
    // @ts-ignore;
    window.game = game;
    // @ts-ignore;
    window.board = game.board;
    // @ts-ignore;
    for (const className of game.board._ctx.classRegistry) window[className.name] = className;

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
    const {prompt, actions} = s.game.allowedActions(player);
    const actionsByName = Object.fromEntries(actions?.map(a => [a, s.game!.action(a, player)]) || []);
    let {move, selections} = deriveSelections(player, actionsByName);

    if (s.move?.action && actions && s.move.action in actions) move = s.move; // move in progress is still valid, leave it

    const boardSelections = new Map<GameElement<Player>, IncompleteMove<Player>[]>();
    const nonBoardSelections = new Map<ResolvedSelection<Player>, IncompleteMove<Player>>();
    if (selections) {
      for (const [action, selection] of Object.entries(selections)) {
        if (selection?.type === 'board') {
          for (const el of selection.boardChoices!) {
            boardSelections.get(el)?.push({action, player, args: [el]}) || boardSelections.set(el, [{action, player, args: [el]}]);
          }
        } else if (selection) {
          nonBoardSelections.set(selection, {action, player, args: []});
        }
      }
    }

    // rerun layouts. probably optimize TODO
    if (s.game.setupLayout) s.game.setupLayout(s.game.board, window.innerWidth / window.innerHeight);
    s.game.board.applyLayouts();

    console.log('updateBoard', s.position, move, selections);
    return ({
      move,
      boardSelections,
      nonBoardSelections,
      prompt,
      boardJSON: s.game.board.allJSON()
    })
  }),
  setPosition: position => { console.log('setPosition', position); return set({ position }) },
  setMove: move => set({ move }),
  actions: [],
  boardSelections: new Map(),
  nonBoardSelections: new Map(),
  selected: [],
  setSelected: sel => set({ selected: [...new Set(sel)] }),
  hilites: [],
  setHilites: hilites => set({ hilites }),
  uiOptions: {},
  setUIOptions: uiOptions => set({ uiOptions }),
}), shallow);

export default <P extends Player>(setup: SetupFunction<P, Board<P>>, options: UIOptions): void => {
  gameStore.getState().setUIOptions(options as UIOptions);
  
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
