// import * as Sentry from "@sentry/browser";
// import { BrowserTracing } from "@sentry/tracing";
import React from 'react'
import { createRoot } from 'react-dom/client';
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main.js'
import { default as Game, PlayerAttributes } from '../game.js'
import { serializeArg } from '../action/utils.js';

import type { GameUpdateEvent, GameFinishedEvent } from './Main.js'
import type Player from '../player/player.js'
import type { Board, GameElement } from '../board/index.js'
import type { ElementJSON } from '../board/element.js'
import type { SerializedArg } from '../action/utils.js'
import type { BoardQuery } from '../action/selection.js'
import type { Argument } from '../action/action.js'
import type { PendingMove, SerializedMove } from '../game.js'
import type { SetupFunction } from '../index.js'

type GameStore = {
  setup?: SetupFunction<Player, Board<Player>>;
  setSetup: (s: SetupFunction<Player, Board<Player>>) => void;
  game: Game<Player, Board<Player>>;
  setGame: (game: Game<Player, Board<Player>>) => void;
  boardJSON: ElementJSON[]; // cache complete immutable json here, listen to this for board changes
  updateState: (s: GameUpdateEvent | GameFinishedEvent) => void;
  updateBoard: () => void; // call any time state changes to update immutable references for listeners. updates move, selections
  position?: number; // this player
  setPosition: (p: number) => void;
  move?: {action: string, args: Argument<Player>[]}; // move in progress
  selectMove: (sel?: PendingMove<Player>, ...args: Argument<Player>[]) => void;
  moves: {action: string, args: SerializedArg[]}[]; // move ready for processing
  clearMoves: () => void;
  error?: string,
  setError: (error: string) => void,
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
  setAspectRatio: (a: number) => void;
  dragElement?: string;
  setDragElement: (el?: string) => void;
  dropElements: {element: string, move: PendingMove<Player>}[];
  currentDrop?: string;
  setCurrentDrop: (el?: string) => void;
}

export const gameStore = createWithEqualityFn<GameStore>()(set => ({
  setSetup: setup => set({ setup }),
  game: new Game(),
  setGame: (game: Game<Player, Board<Player>>) => set({ game }),
  boardJSON: [],
  updateState: (update) => set(s => {
    let { game } = s;
    if (game.phase === 'new' && s.setup) {
      game = s.setup(update.state.state, {
        start: true,
        currentPlayerPosition: 'currentPlayers' in update ? update.currentPlayers : []
      });
      // @ts-ignore;
      window.game = game;
      // @ts-ignore;
      window.board = game.board;
      // @ts-ignore;
      for (const className of game.board._ctx.classRegistry) window[className.name] = className;
    } else {
      game.setState({...update.state.state, currentPlayerPosition: 'currentPlayers' in update ? update.currentPlayers : [] });
    }
    if (update.type === 'gameFinished') {
      game.winner = update.winners.map(p => game.players.atPosition(p)!);
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
  updateBoard: () => set(s => {
    if (!s.position) return {};
    return updateBoard(s.game, s.position);
  }),
  selectMove: (pendingMove?: PendingMove<Player>, ...args: Argument<Player>[]) => set(s => {
    const move = pendingMove ? {
      action: pendingMove.action,
      args: args ? [...pendingMove.args, ...args] : pendingMove.args
    } : undefined;
    return updateSelections(s.game!, s.position!, move);
  }),
  moves: [],
  clearMoves: () => set({ moves: [] }),
  setError: error => set({ error }),
  setPosition: position => set({ position }),
  actions: [],
  boardSelections: {},
  pendingMoves: [],
  selected: [],
  setSelected: sel => set({ selected: [...new Set(sel)] }),
  setAspectRatio: aspectRatio => set(s => {
    const breakpoint = s.game.board.getBreakpoint(aspectRatio);
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
  let state: Partial<GameStore> = {};
  let resolvedSelections: ReturnType<typeof game.getResolvedSelections>;
  let isBoardUpToDate = true;

  while (true) {
    resolvedSelections = game.getResolvedSelections(player, move?.action, ...(move?.args || []));
    if (move && !resolvedSelections?.moves) {
      console.log('move may no longer be valid. retrying getResolvedSelections', move, resolvedSelections);
      move = undefined;
      resolvedSelections = game.getResolvedSelections(player);
    }

    const pendingMoves = resolvedSelections?.moves;

    // selection is skippable - skip and rerun selections
    if (pendingMoves?.length === 1 && pendingMoves[0].selection.skipIfOnlyOne) {
      const arg = pendingMoves[0].selection.isForced();
      if (arg === undefined) break;
      move = {
	action: pendingMoves[0].action,
	args: [...pendingMoves[0].args, arg]
      };
      continue;
    }

    // move is processable - add to queue and rerun
    if (pendingMoves?.length === 0) {
      // if last option is forced and skippable, automove
      if (!move) break;

      const player = game.players.atPosition(position);
      if (!player) break;

      // serialize now before we alter our state to ensure proper references
      const serializedMove: SerializedMove = {
	action: move.action,
	args: move.args.map(a => serializeArg(a))
      }

      state.error = game.processMove({ player, ...move });
      isBoardUpToDate = false;
      if (state.error) {
	console.error(state.error);
	break;
      } else {
	state.moves ??= [];
	state.moves.push(serializedMove);
	move = undefined;
	game.play();
	continue;
      }
    }
    break;
  }

  // populate boardSelections
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

  if (!isBoardUpToDate) state = {...state, ...updateBoard(game, position)};

  return ({
    ...state,
    move,
    step: resolvedSelections?.step,
    prompt: resolvedSelections?.prompt,
    boardSelections,
    pendingMoves: resolvedSelections?.moves,
  })
};

const updateBoard = (game: Game<Player, Board<Player>>, position: number) => {
  // rerun layouts. probably optimize TODO
  game.contextualizeBoardToPlayer(game.players.atPosition(position));
  game.board.applyLayouts();

  return ({ boardJSON: game.board.allJSON() })
}

export type SetupComponentProps = {
  name: string
  settings: Record<string, any>
  players: PlayerAttributes<Player>[]
  updateKey: (key: string, value: any) => void
}

export const render = <P extends Player, B extends Board<P>>(setup: SetupFunction<P, B>, { settings, breakpoints, layout }: {
  settings?: Record<string, (p: SetupComponentProps) => JSX.Element>
  breakpoints?: (aspectRatio: number) => string,
  layout?: (board: B, breakpoint: string) => void
}): void => {
  const state = gameStore.getState();
  const setupGame: SetupFunction<P, B> = (state, options) => {
    const game = setup(state, options);
    game.setupComponents = settings;
    game.board._ui.breakpoints = breakpoints;
    game.board._ui.setupLayout = layout;
    return game;
  }
  // we can anonymize Player class internally
  state.setSetup(setupGame as unknown as SetupFunction<Player, Board<Player>>);
  state.setGame(setupGame() as unknown as Game<Player, Board<Player>>);

  const boostrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || '{}');
  const { userID, minPlayers, maxPlayers }: { userID: string, minPlayers: number, maxPlayers: number } = boostrap;

  const root = createRoot(document.getElementById('root')!)
  root.render(
    <Main
      userID={userID}
      minPlayers={minPlayers}
      maxPlayers={maxPlayers}
    />
  );
};
