// import * as Sentry from "@sentry/browser";
// import { BrowserTracing } from "@sentry/tracing";
import React from 'react'
import ReactDOM from 'react-dom'
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main'

import type { UIOptions } from './types'
import type { Game, Player } from '../game'
import type { Board, GameElement } from '../game/board'
import type { ElementJSON } from '../game/board/types'
import type { SetupFunction } from '../game/types'
import type { PendingMove } from '../game/action/types'

const boostrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || '{}');
const userID: string = boostrap.userID;
const minPlayers: number = boostrap.minPlayers;
const maxPlayers: number = boostrap.maxPlayers;

type GameStore = {
  game?: Game<Player, Board<Player>>;
  boardJSON: ElementJSON[]; // cache complete immutable json here, listen to this for board changes
  setGame: (g: Game<Player, Board<Player>>) => void; // will call once on first server update to set the client instance
  updateBoard: (boardJSON?: ElementJSON[]) => void; // call any time state changes to update immutable references for listeners. updates move, selections
  position?: number; // this player
  setPosition: (p: number) => void;
  move?: PendingMove<Player>; // move in progress
  setMove: (m?: PendingMove<Player>) => void;
  boardSelections: Map<GameElement<Player>, PendingMove<Player>[]>; // pending moves on board
  pendingMoves: PendingMove<Player>[]; // pending moves not on board
  prompt?: string; // prompt for choosing action if applicable
  selected: GameElement<Player>[]; // selected elements on board
  setSelected: (s: GameElement<Player>[]) => void;
  disambiguateElement?: { element: GameElement<Player>, moves: PendingMove<Player>[] }; // element selected has multiple moves
  setDisambiguateElement: (s: { element: GameElement<Player>, moves: PendingMove<Player>[] }) => void;
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
  updateBoard: (boardJSON?: ElementJSON[]) => set(s => {
    if (!s.game || !s.position) return {};
    const player = s.game.players.atPosition(s.position);
    if (!player) return {};
    const {prompt, actions} = s.game.allowedActions(player);
    const pendingMoves: PendingMove<Player>[] = [];
    if (actions) for (const action of actions) {
      const [selection, forcedArgs] = s.game!.action(action, player).forceArgs();
      if (selection) pendingMoves.push({
        action,
        args: forcedArgs || [],
        selection
      });
    }

    let move = s.move;
    if (move?.action && (!actions || !(move.action in actions))) move = undefined; // move in progress is no longer valid

    const boardSelections = new Map<GameElement<Player>, PendingMove<Player>[]>();
    for (const p of pendingMoves) {
      if (p.selection.type === 'board') {
        for (const el of p.selection.boardChoices!) {
          boardSelections.get(el)?.push(p) || boardSelections.set(el, [p]);
        }
      }
    }

    // rerun layouts. probably optimize TODO
    if (s.game.setupLayout) s.game.setupLayout(s.game.board, window.innerWidth / window.innerHeight);
    s.game.board.applyLayouts();

    console.log('updateBoard', s.position, move, boardSelections, pendingMoves);
    return ({
      move,
      boardSelections,
      pendingMoves,
      prompt,
      boardJSON: boardJSON || s.game.board.allJSON()
    })
  }),
  setPosition: position => set({ position }),
  setMove: move => set({ move }),
  actions: [],
  boardSelections: new Map(),
  pendingMoves: [],
  selected: [],
  setSelected: sel => set({ selected: [...new Set(sel)] }),
  setDisambiguateElement: disambiguateElement => set({ disambiguateElement }),
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
