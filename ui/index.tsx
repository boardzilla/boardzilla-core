// import * as Sentry from "@sentry/browser";
// import { BrowserTracing } from "@sentry/tracing";
import React from 'react'
import { createRoot } from 'react-dom/client';
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main'

import type { UIOptions, GameUpdateEvent, GameFinishedEvent } from './types'
import type { Player } from '../game'
import type Game from '../game/game'
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
  updateState: (s: GameUpdateEvent | GameFinishedEvent) => void;
  updateBoard: (boardJSON?: ElementJSON[]) => void; // call any time state changes to update immutable references for listeners. updates move, selections
  position?: number; // this player
  setPosition: (p: number) => void;
  move?: {action: string, args: Argument<Player>[]}; // move in progress
  selectMove: (sel?: PendingMove<Player>, ...args: Argument<Player>[]) => void;
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
  setSetup: (s: SetupFunction<Player, Board<Player>>) => void;
  setup?: SetupFunction<Player, Board<Player>>;
  setAspectRatio: (a: number) => void;
  dragElement?: string;
  setDragElement: (el?: string) => void;
  dropElements: {element: string, move: PendingMove<Player>}[];
  currentDrop?: string;
  setCurrentDrop: (el?: string) => void;
}

export const gameStore = createWithEqualityFn<GameStore>()(set => ({
  boardJSON: [],
  updateState: (update) => set(s => {
    let game = s.game;
    if (!s.setup) return {};
    if (!game) {
      game = s.setup(update.state.state, {
        currentPlayerPosition: 'currentPlayers' in update && update.currentPlayers.length === 1 ? update.currentPlayers[0] : undefined,
        start: true
      });
      // @ts-ignore;
      window.game = game;
      // @ts-ignore;
      window.board = game.board;
      // @ts-ignore;
      for (const className of game.board._ctx.classRegistry) window[className.name] = className;
    } else {
      game.setState(update.state.state);
    }
    if (update.type === 'gameUpdate') game.players.currentPosition = update.currentPlayers.length === 1 ? update.currentPlayers[0] : undefined;
    if (update.type === 'gameFinished') {
      game.winner = update.winners.map(p => game!.players.atPosition(p)!);
      game.phase = 'finished';
    }
    game.board.applyLayouts();
    const position = s.position || update.state.position;

    if (game.phase === 'finished') {
      return {
        game,
        position,
        boardJSON: update.state.state.board,
      }
    }

    return {
      game,
      position,
      boardJSON: update.state.state.board,
      ...updateSelections(game, position),
    }
  }),
  // function to ensure react detects a change. must be called immediately after any function that alters board state
  updateBoard: (boardJSON?: ElementJSON[]) => set(s => {
    if (!s.game || !s.position) return {};

    // rerun layouts. probably optimize TODO
    s.game.contextualizeBoardToPlayer(s.game.players.atPosition(s.position));
    s.game.board.applyLayouts();
    
    return ({
      boardJSON: boardJSON || s.game.board.allJSON()
    })
  }),
  selectMove: (pendingMove?: PendingMove<Player>, ...args: Argument<Player>[]) => set(s => {
    const move = pendingMove ? {
      action: pendingMove.action,
      args: args ? [...pendingMove.args, ...args] : pendingMove.args
    } : undefined;
    return updateSelections(s.game!, s.position!, move);
  }),
  setPosition: position => set({ position }),
  actions: [],
  boardSelections: {},
  pendingMoves: [],
  selected: [],
  setSelected: sel => set({ selected: [...new Set(sel)] }),
  uiOptions: {},
  setUIOptions: uiOptions => set({ uiOptions }),
  setSetup: setup => set({ setup }),
  setAspectRatio: aspectRatio => set(s => {
    if (!s.game) return {};
    const breakpoint = s.game.board.getBreakpoint(aspectRatio);
    console.log('newBreakpoint', aspectRatio, breakpoint, s.game.board._ui.breakpoint);
    if (breakpoint !== s.game.board._ui.breakpoint) {
      s.game.board.setBreakpoint(breakpoint);
      s.updateBoard();
    }
    return {};
  }),
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
    return { dragElement, dropElements }
  }),
  dropElements: [],
  setCurrentDrop: currentDrop => set({ currentDrop }),
}), shallow);

// refresh move and selections
const updateSelections = (game: Game<Player, Board<Player>>, position: number, move?: {action: string, args: Argument<Player>[]}) => {
  const player = game.players.atPosition(position);
  if (!player) return {};

  let resolvedSelections = game.getResolvedSelections(player, move?.action, ...(move?.args || []));
  if (move && !resolvedSelections?.moves) {
    console.log('move may no longer be valid. retrying getResolvedSelections', move, resolvedSelections);
    move = undefined;
    resolvedSelections = game.getResolvedSelections(player);
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
};

export default <P extends Player>(setup: SetupFunction<P, Board<P>>, options: UIOptions): void => {
  const state = gameStore.getState();
  state.setUIOptions(options as UIOptions);
  // we can anonymize Player class internally
  state.setSetup(setup as unknown as SetupFunction<Player, Board<Player>>);

  const root = createRoot(document.getElementById('root')!)
  root.render(
    <Main
      userID={userID}
      minPlayers={minPlayers}
      maxPlayers={maxPlayers}
    />
  );
};

export * from './setup/components/settingComponents';
