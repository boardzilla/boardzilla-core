// import * as Sentry from "@sentry/browser";
// import { BrowserTracing } from "@sentry/tracing";
import React from 'react'
import { createRoot } from 'react-dom/client';
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main'

import type { UIOptions } from './types'
import type { Game, Player } from '../game'
import type { Board, GameElement } from '../game/board'
import type { ElementJSON } from '../game/board/types'
import type { SetupFunction } from '../game/types'
import type { Argument, PendingMove } from '../game/action/types'

const boostrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || '{}');
const userID: string = boostrap.userID;
const minPlayers: number = boostrap.minPlayers;
const maxPlayers: number = boostrap.maxPlayers;

type GameStore = {
  game?: Game<Player, Board<Player>>;
  boardJSON: ElementJSON[]; // cache complete immutable json here, listen to this for board changes
  setGame: (g: Game<Player, Board<Player>>) => void; // will call once on first server update to set the client instance
  updateBoard: (boardJSON?: ElementJSON[]) => void; // call any time state changes to update immutable references for listeners. updates move, selections
  updateSelections: (move?: {action: string, args: Argument<Player>[]}) => void; // refresh move and selections
  position?: number; // this player
  setPosition: (p: number) => void;
  move?: {action: string, args: Argument<Player>[]}; // move in progress
  selectMove: (sel?: PendingMove<Player>, arg?: Argument<Player>) => void;
  step?: string,
  pendingMoves?: PendingMove<Player>[]; // all pending moves
  boardSelections: Map<GameElement<Player>, PendingMove<Player>[]>; // pending moves on board
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
  // function to ensure react detects a change. must be called immediately after any function that alters board state
  updateBoard: (boardJSON?: ElementJSON[]) => set(s => {
    if (!s.game || !s.position) return {};

    console.log('updateBoard');
    // rerun layouts. probably optimize TODO
    s.game.contextualizeBoardToPlayer(s.game.players.atPosition(s.position));
    if (s.game.setupLayout) s.game.setupLayout(s.game.board, window.innerWidth / window.innerHeight);
    s.game.board.applyLayouts();

    s.updateSelections(s.move);
    
    return ({
      boardJSON: boardJSON || s.game.board.allJSON()
    })
  }),
  updateSelections: move => set(s => {
    if (!s.game || !s.position) return {};
    const player = s.game.players.atPosition(s.position);
    if (!player) return {};

    let resolvedSelections = s.game.getResolvedSelections(player, move?.action, ...(move?.args || []));
    if (move && !resolvedSelections?.moves) {
      console.log('move may no longer be valid. retrying getResolvedSelections', move, resolvedSelections);
      move = undefined;
      resolvedSelections = s.game.getResolvedSelections(player);
    }

    const boardSelections = new Map<GameElement<Player>, PendingMove<Player>[]>();
    if (resolvedSelections) for (const p of resolvedSelections.moves) {
      if (p.selection.type === 'board') {
        for (const el of p.selection.boardChoices!) {
          boardSelections.get(el)?.push(p) || boardSelections.set(el, [p]);
        }
      }
    }

    console.log('updateSelections', move, resolvedSelections);
    return ({
      move,
      step: resolvedSelections?.step,
      prompt: resolvedSelections?.prompt,
      boardSelections,
      pendingMoves: resolvedSelections?.moves,
    })
  }),
  selectMove: (pendingMove?: PendingMove<Player>, arg?: Argument<Player>) => set(s => {
    const move = pendingMove ? {
      action: pendingMove.action,
      args: arg ? [...pendingMove.args, arg] : pendingMove.args
    } : undefined;
    s.updateSelections(move);
    return {};
  }),
  setPosition: position => set({ position }),
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
  
  const root = createRoot(document.getElementById('root')!)
  root.render(
    // we can anonymize Player class internally
    <Main
      userID={userID}
      minPlayers={minPlayers}
      maxPlayers={maxPlayers}
      setup={setup as unknown as SetupFunction<Player, Board<Player>>}
    />
  );
};

export * from './setup/components/settingComponents';
