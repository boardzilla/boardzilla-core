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
import Player from '../player/player.js'
import { Board, GameElement } from '../board/index.js'
import type { ElementJSON } from '../board/element.js'
import type { SerializedArg } from '../action/utils.js'
import type { BoardQuery } from '../action/selection.js'
import type { Argument } from '../action/action.js'
import type { PendingMove, SerializedMove } from '../game.js'
import type { SetupFunction } from '../index.js'

type GameStore = {
  host: boolean,
  setHost: (host: boolean) => void,
  userID: string,
  setUserID: (userID: string) => void,
  setup?: SetupFunction<Player, Board<Player>>;
  setSetup: (s: SetupFunction<Player, Board<Player>>) => void;
  game: Game<Player, Board<Player>>;
  setGame: (game: Game<Player, Board<Player>>) => void;
  boardJSON: ElementJSON[]; // cache complete immutable json here, listen to this for board changes
  updateState: (s: GameUpdateEvent | GameFinishedEvent) => void;
  updateBoard: () => void; // call any time state changes to update immutable references for listeners. updates move, selections
  position?: number; // this player
  setPosition: (p: number) => void;
  move?: {action: string, args: Record<string, Argument<Player>>}; // move in progress
  selectMove: (sel?: PendingMove<Player>, args?: Record<string, Argument<Player>>) => void; // commit the choice and find new choices or process the choice
  moves: {action: string, args: Record<string, SerializedArg>}[]; // move ready for processing
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
  zoomable?: GameElement<Player>;
  setZoomable: (el: GameElement<Player>) => void;
  zoomElement?: GameElement<Player>;
  setZoom: (zoom: boolean) => void;
}

export const gameStore = createWithEqualityFn<GameStore>()(set => ({
  host: false,
  setHost: host => set({ host }),
  userID: '',
  setUserID: userID => set({ userID }),
  setSetup: setup => set({ setup }),
  game: new Game(Player, Board),
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
      game.players.fromJSON(update.state.state.players);
      game.board.fromJSON(update.state.state.board);
      game.flow.setBranchFromJSON(update.state.state.position);
      game.players.setCurrent('currentPlayers' in update ? update.currentPlayers : []);
      game.phase = 'started';
      game.winner = [];
    }
    if (update.type === 'gameFinished') {
      game.players.setCurrent([]);
      game.winner = update.winners.map(p => game.players.atPosition(p)!);
      game.phase = 'finished';
    }
    const position = s.position || update.state.position;

    if (game.phase === 'finished') {
      return {
        game,
        position,
        move: undefined,
        step: undefined,
        prompt: undefined,
        boardSelections: {},
        pendingMoves: undefined,
        ...updateBoard(game, position, update.state.state.board),
      }
    }

    return {
      game,
      position,
      ...updateSelections(game, position),
      ...updateBoard(game, position, update.state.state.board),
    }
  }),
  // function to ensure react detects a change. must be called immediately after any function that alters board state
  updateBoard: () => set(s => {
    if (!s.position) return {};
    return updateBoard(s.game, s.position);
  }),
  selectMove: (pendingMove?: PendingMove<Player>, args?: Record<string, Argument<Player>>) => set(s => {
    const move = pendingMove ? {
      action: pendingMove.action,
      args: {...pendingMove.args, ...args}
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
      if (typeof drag === 'function') drag = drag({...(s.move?.args || {}), [move.selections[0].name]: s.game!.board.atBranch(dragElement)});
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
  setZoomable: zoomable => set({ zoomable }),
  setZoom: zoom => set(s => {
    console.log('zoom', zoom, s.zoomable);
    return {
      zoomElement: zoom ? s.zoomable : undefined
    }
  }),
}), shallow);

// refresh move and selections
const updateSelections = (game: Game<Player, Board<Player>>, position: number, move?: {action: string, args: Record<string, Argument<Player>>}) => {
  const player = game.players.atPosition(position);
  if (!player) return {};
  let state: Partial<GameStore> = {};
  let resolvedSelections: ReturnType<typeof game.getResolvedSelections>;
  let isBoardUpToDate = true;

  while (true) {
    resolvedSelections = game.getResolvedSelections(player, move?.action, move?.args);
    if (move && !resolvedSelections?.moves) {
      console.log('move may no longer be valid. retrying getResolvedSelections', move, resolvedSelections);
      move = undefined;
      resolvedSelections = game.getResolvedSelections(player);
    }

    const pendingMoves = resolvedSelections?.moves;

    // the only selection is skippable - skip and rerun selections
    if (pendingMoves?.length === 1 && pendingMoves[0].selections.length === 1 && pendingMoves[0].selections[0].skipIfOnlyOne) {
      const arg = pendingMoves[0].selections[0].isForced();
      if (arg === undefined) break;
      move = {
	action: pendingMoves[0].action,
	args: {...pendingMoves[0].args, [pendingMoves[0].selections[0].name]: arg}
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
	args: Object.fromEntries(Object.entries(move.args).map(([k, v]) => [k, serializeArg(v)]))
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
      for (const sel of p.selections) {
        if (sel.boardChoices) {
          const boardMove = {...p, selections: [sel]}; // simple board move of single selection to attach to element
          for (const el of sel.boardChoices) {
            boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
            boardSelections[el.branch()].clickMoves.push(boardMove);
          }
          if (sel.clientContext?.dragInto) {
            for (const el of sel.boardChoices) {
              boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
              boardSelections[el.branch()].dragMoves.push({ move: boardMove, drag: sel.clientContext?.dragInto });
            }
          }
          if (sel.clientContext?.dragFrom) {
            const dragFrom = typeof sel.clientContext?.dragFrom === 'function' ?
              sel.clientContext?.dragFrom(move?.args) :
              sel.clientContext?.dragFrom;

            for (const el of dragFrom instanceof Array ? dragFrom : [dragFrom]) {
              boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
              boardSelections[el.branch()].dragMoves.push({ move: boardMove, drag: sel.boardChoices });
            }
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

const updateBoard = (game: Game<Player, Board<Player>>, position: number, json?: ElementJSON[]) => {
  // rerun layouts. probably optimize TODO
  game.contextualizeBoardToPlayer(game.players.atPosition(position));
  game.board.applyLayouts();

  return ({ boardJSON: json || game.board.allJSON() })
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
    game.board._ui.breakpoints = breakpoints;
    game.board._ui.setupLayout = layout;
    return game;
  }
  // we can anonymize Player class internally
  state.setSetup(setupGame as unknown as SetupFunction<Player, Board<Player>>);
  // state.setGame(setupGame({ players: [], settings: {} }) as unknown as Game<Player, Board<Player>>);

  const boostrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || '{}');
  const { host, userID, minPlayers, maxPlayers }: { host: boolean, userID: string, minPlayers: number, maxPlayers: number } = boostrap;
  state.setHost(host);
  state.setUserID(userID);

  const root = createRoot(document.getElementById('root')!)
  root.render(
    <Main
      minPlayers={minPlayers}
      maxPlayers={maxPlayers}
      setupComponents={settings || {}}
    />
  );
};
