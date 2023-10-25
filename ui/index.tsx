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
import type { Argument, PendingMove, BoardQuery } from '../game/action/types'

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
  boardSelections: Record<string, {
    clickMoves: PendingMove<Player>[],
    dragMoves: {
      move: PendingMove<Player>,
      drag: BoardQuery<Player, GameElement<Player>>
    }[]
  }>; // pending moves on board
  prompt?: string; // prompt for choosing action if applicable
  selected: GameElement<Player>[]; // selected elements on board
  setSelected: (s: GameElement<Player>[]) => void;
  uiOptions: UIOptions;
  setUIOptions: (o: UIOptions) => void;
  dragElement?: string;
  setDragElement: (el?: string) => void;
  dropElements: {element: string, move: PendingMove<Player>}[];
  currentDrop?: string;
  setCurrentDrop: (el?: string) => void;
  onDragComplete: () => void;
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

    const boardSelections: Record<string, {
      clickMoves: PendingMove<Player>[],
      dragMoves: {
        move: PendingMove<Player>,
        drag: BoardQuery<Player, any>[]
      }[]
    }> = {};
    if (resolvedSelections) {
      resolvedSelections.moves = resolvedSelections.moves.filter(m => !move || m.action === move.action);
      for (const p of resolvedSelections.moves) {
        if (p.selection.boardChoices) {
          for (const el of p.selection.boardChoices) {
            boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
            boardSelections[el.branch()].clickMoves.push(p);
          }
          if (p.selection.clientContext?.dragInto) {
            for (const el of p.selection.boardChoices) {
              boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
              boardSelections[el.branch()].dragMoves.push({ move: p, drag: p.selection.clientContext?.dragInto });
            }
          }
          if (p.selection.clientContext?.dragFrom) {
            const dragFrom = typeof p.selection.clientContext?.dragFrom === 'function' ?
              p.selection.clientContext?.dragFrom(...(move?.args || [])) :
              p.selection.clientContext?.dragFrom;

            for (const el of dragFrom instanceof Array ? dragFrom : [dragFrom]) {
              boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
              boardSelections[el.branch()].dragMoves.push({ move: p, drag: p.selection.boardChoices });
            }
          }
        }
      }
    }

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
  boardSelections: {},
  pendingMoves: [],
  selected: [],
  setSelected: sel => set({ selected: [...new Set(sel)] }),
  uiOptions: {},
  setUIOptions: uiOptions => set({ uiOptions }),
  setDragElement: dragElement => set(s => {
    if (!dragElement) return { dragElement: undefined, dropElements: [] };
    const moves = s.boardSelections[dragElement].dragMoves;
    let dropElements: {element: string, move: PendingMove<Player>}[] = [];
    if (moves) for (let {move, drag} of moves) {
      if (typeof drag === 'function') drag = drag(...(s.move?.args || []), s.game!.board.atBranch(dragElement));
      if (drag) {
        if (typeof drag === 'string') throw Error('unsupported');
        if (!(drag instanceof Array)) drag = [drag];
        dropElements = dropElements.concat(drag.map(e => ({element: e.branch(), move})));
      }
    }
    console.log('dropElements', dropElements);
    return { dragElement, dropElements }
  }),
  dropElements: [],
  setCurrentDrop: currentDrop => set({ currentDrop }),
  onDragComplete: () => set(s => {
    if (s.currentDrop && s.dragElement) {
      const move = s.dropElements.find(({ element, move }) => element === s.currentDrop)?.move;
      if (move) {
        const dragMove = {
          action: move.action,
          args: [
            ...(move?.args || []),
            s.game!.board.atBranch(s.dragElement),
            s.game!.board.atBranch(s.currentDrop)
          ]
        };
        s.updateSelections(dragMove);
      }
    }
    return {
      dragElement: undefined,
      dropElements: []
    };
  }),
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
