import React from 'react'
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import GameManager from '../game-manager.js'
import { Game } from '../board/index.js'
import Player from '../player/player.js';
import {
  updateSelections,
  UIMove,
  updateBoard,
  removePlacementPiece,
  decorateUIMove,
  clearMove,
  updateControls,
  updatePrompts,
} from './lib.js';

import { ActionDebug } from '../game-manager.js'
import type { GameUpdateEvent, GameFinishedEvent, User } from './Main.js'
import type { Box, ElementJSON } from '../board/element.js'
import type { BaseGame } from '../board/game.js'
import type { GameElement, Piece, PieceGrid } from '../board/index.js'
import type Selection from '../action/selection.js'
import type { Argument } from '../action/action.js'
import type { SetupFunction } from '../game-creator.js'
import type { GameState } from '../interface.js';
import type { ResolvedSelection } from '../action/selection.js';

export type GameStore = {
  host: boolean;
  setHost: (host: boolean) => void;
  userID: string;
  setUserID: (userID: string) => void;
  dev?: boolean;
  setDev: (dev?: boolean) => void;
  setup?: SetupFunction;
  setSetup: (s: SetupFunction) => void;
  gameManager: GameManager;
  isMobile: boolean;
  boardJSON: ElementJSON[]; // cache complete immutable json here, listen to this for board changes. eventually can replace with gameManager.sequence
  updateState: (state: (GameUpdateEvent | GameFinishedEvent) & {state: GameState}, readOnly?: boolean) => void;
  position?: number; // this player
  move?: UIMove; // move in progress
  cancellable: boolean;
  selectMove: (move?: UIMove, args?: Record<string, Argument>) => void; // commit the choice and find new choices or process the choice
  clearMove: () => void; // clear all move inputs
  uncommittedArgs: Record<string, Argument>; // all current args that are submittable, including uncommitted board selections
  controls?: {
    style: React.CSSProperties;
    name: string;
    moves: UIMove[];
  };
  error?: string;
  setError: (error: string) => void;
  step?: string; // step from getPendingMoves
  pendingMoves?: UIMove[]; // all pending moves from this point from getPendingMoves
  prompt?: string; // prompt from getPendingMoves
  boardPrompt?: string; // prompt for choosing board action
  actionDescription?: string; // description of the current pending action
  otherPlayerAction?: string;
  actionDebug?: ActionDebug;
  announcementIndex: number;
  dismissAnnouncement: () => void;
  boardSelections: Record<string, {
    clickMoves: UIMove[];
    dragMoves: {
      move: UIMove;
      drag: Selection | ResolvedSelection;
    }[];
    error?: string;
  }>; // pending moves on board
  disambiguateElement?: { element: GameElement, moves: UIMove[] };
  selected?: GameElement[]; // selected elements on board. these are not committed, analagous to input state in a controlled form
  selectElement: (moves: UIMove[], element: GameElement) => void;
  automove?: number;
  translations: Record<string, string>, // map of current element branches pointing to branch it moved from
  renderedState: Record<string, { // UI info keyed by current location in this UI
    key: string;
    style?: Box & { rotation?: number };
    attrs?: Record<string, any>;
  }>;
  renderedSequence: number;
  setBoardSize: () => void;
  aspectRatio?: number;
  dragElement?: string;
  setDragElement: (el?: string) => void;
  dragOffset: {element?: string, x?: number, y?: number}; // mutable non-reactive record of drag offset
  dropSelections: UIMove[];
  currentDrop?: GameElement;
  setCurrentDrop: (el?: GameElement) => void;
  placement?: { // placing a piece inside a grid as part of the current move
    selected?: { row: number, column: number }; // player indicated choice, ready for validation/confirmation
    piece: Piece<BaseGame> ; // temporary ghost piece
    invalid?: boolean
    into: PieceGrid<BaseGame>;
    layout: NonNullable<GameElement['_ui']['computedLayouts']>[number];
    rotationChoices?: number[];
  };
  setPlacement: (placement: {column: number, row: number, rotation?: number}) => void; // select placement. not committed, analagous to input state in a controlled form
  selectPlacement: (placement: {column: number, row: number, rotation?: number}) => void; // commit placement
  infoElement?: {info: JSX.Element | boolean, element: GameElement };
  setInfoElement: (el?: {info: JSX.Element | boolean, element: GameElement }) => void;
  userOnline: Map<string, boolean>
  setUserOnline: (id: string, online: boolean) => void
}

export const createGameStore = () => createWithEqualityFn<GameStore>()((set, get) => ({
  host: false,
  setHost: host => set({ host }),
  userID: '',
  setUserID: userID => set({ userID }),
  setDev: dev => set({ dev }),
  setSetup: setup => set({ setup }),
  gameManager: new GameManager(Player, Game),
  isMobile: !!globalThis.navigator?.userAgent.match(/Mobi/),
  boardJSON: [],
  updateState: (update, readOnly=false) => set(s => {
    let { gameManager } = s;
    const position = s.position || update.position;
    window.clearTimeout(s.automove);

    let state: GameStore = {
      ...s,
      position,
      move: undefined,
      prompt: undefined,
      boardPrompt: undefined,
      actionDescription: undefined,
      otherPlayerAction: undefined,
      translations: {},
      renderedState: {},
      renderedSequence: update.state.sequence,
      announcementIndex: 0,
      step: undefined,
      boardSelections: {},
      pendingMoves: undefined,
      placement: undefined,
    };

    if (gameManager.phase === 'new' && s.setup) {
      gameManager = state.gameManager = s.setup(update.state);
      // @ts-ignore;
      window.game = gameManager.game;
      // @ts-ignore;
      for (const className of gameManager.game._ctx.classRegistry) window[className.name] = className;
      const boardSize = gameManager.game.getBoardSize(window.innerWidth, window.innerHeight, !!globalThis.navigator?.userAgent.match(/Mobi/))
      gameManager.game.setBoardSize(boardSize);
    } else {
      gameManager.players.fromJSON(update.state.players);
      if (update.state.sequence === s.renderedSequence + 1) {
        // demote current state to previous and play over top
        const translations: Record<string, string> = {};
        const renderedState: GameStore['renderedState'] = {};
        gameManager.game.fromJSON(update.state.board, translations);
        for (const [n, o] of Object.entries(translations)) renderedState[n] = {...s.renderedState[o]};
        state.translations = translations;
        state.renderedState = renderedState;
        console.log(state.translations);
      } else {
        gameManager.game.fromJSON(update.state.board);
      }
      gameManager.players.assignAttributesFromJSON(update.state.players);
      gameManager.setFlowFromJSON(update.state.position);
    }
    gameManager.phase = 'started';
    gameManager.messages = update.state.messages;
    gameManager.announcements = update.state.announcements;
    gameManager.winner = [];

    if (update.type === 'gameFinished') {
      gameManager.players.setCurrent([]);
      gameManager.phase = 'finished';
      gameManager.winner = update.winners.map(p => gameManager.players.atPosition(p)!);
    }
    console.debug(`Game update for player #${position}. Current flow:\n ${gameManager.flow().stacktrace()}`);
    state = {
      ...state,
      ...updateBoard(gameManager, position, update.state.board),
    }
    // may override board with new information from playing forward from the new state
    if (!readOnly && update.type !== 'gameFinished') {
      state = updateSelections(state)
    }

    s.gameManager.sequence = update.state.sequence;

    return state;
  }),

  // pendingMove we're trying to complete, args are the ones we're committing to, pass no move/args for move cancellation
  selectMove: (pendingMove?: UIMove, args?: Record<string, Argument>) => set(s => {
    let state: GameStore = { ...s, cancellable: true };
    if (pendingMove) {
      args = { ...pendingMove.args, ...args };
      state.move = { ...pendingMove, args };
      state.uncommittedArgs = { ...args };
      for (const sel of state.move.selections) {
        // the current selection cannot be filled in unless explicity supplied. this could be a forced arg with a confirmation step
        if (!args || !(sel.name in args)) delete state.move!.args[sel.name];
      }
      state.move = decorateUIMove(state.move);
    } else {
      get().clearMove();
      state = get();
      if (s.placement) {
        // remove temporary placement piece
        removePlacementPiece(s.placement);
        state = {
          ...state,
          placement: undefined,
          ...updateBoard(s.gameManager, s.position!)
        };
      }
    }

    state = updateSelections(state);

    // obsolete???
    // if (!pendingMove) {
    //   s.gameManager.sequence = Math.floor(s.gameManager.sequence);
    // }

    // if (s.gameManager.sequence > Math.floor(s.gameManager.sequence)) {
    //   state.previousRenderedState = {sequence: Math.floor(s.gameManager.sequence), elements: {...s.renderedState}};
    //   state.renderedState = {};
    // }

    return state;
  }),

  cancellable: false,
  clearMove: () => set(clearMove()),
  uncommittedArgs: {},
  setError: error => set({ error }),
  actions: [],
  announcementIndex: 0,
  dismissAnnouncement: () => set(s => ({ announcementIndex: s.announcementIndex + 1 })),
  boardSelections: {},
  pendingMoves: [],

  selectElement: (moves: UIMove[], element: GameElement) => set(s => {
    if (moves.length === 0) return {};
    s.cancellable = true;
    if (moves.length > 1) { // multiple moves are associated with this element (attached by getBoardSelections)
      return updateSelections({
        ...s,
        selected: [element],
        disambiguateElement: ({ element, moves })
      });
    }

    const move = moves[0];
    const selection = move.selections[0]; // simple one-selection UIMove created by getBoardSelections
    if (!move.requireExplicitSubmit) {
      // can be submitted
      get().clearMove();
      get().selectMove(move, {[selection.name]: element});
      return {};
    }

    const selected = selection.isMulti() ? (
      s.selected?.includes(element) ?
        (s.selected ?? []).filter(s => s !== element) :
        (s.selected ?? []).concat([element])
    ) : (
      s.selected?.[0] === element ? [] : [element]
    );

    const state: GameStore = {
      ...s,
      selected,
      move,
      pendingMoves: [move],
      cancellable: true,
      disambiguateElement: undefined,
      uncommittedArgs: {
        ...s.uncommittedArgs,
        [selection.name]: selection.isMulti() ? selected : selected[0]
      }
    }
    Object.assign(state, updateControls(state));
    Object.assign(state, updatePrompts(state));
    return state;
  }),

  setPlacement: ({ column, row, rotation }) => set(s => {
    if (!s.placement || s.pendingMoves?.[0].selections[0]?.type !== 'place') return {};

    const oldColumn = s.placement.piece.column;
    const oldRow = s.placement.piece.row;
    const oldRotation = s.placement.piece._rotation ?? 0;
    const grid = s.placement.layout.grid!;
    if (rotation !== undefined && oldRotation !== rotation) {
      s.placement.piece._rotation = rotation;
    }
    const gridSize = s.placement.into._sizeNeededFor(s.placement.piece);
    s.placement.piece.column = Math.max(grid.origin.column,
      Math.min(grid.origin.column + grid.columns - gridSize.width,
        Math.floor(column)
      )
    );
    s.placement.piece.row = Math.max(grid.origin.row,
      Math.min(grid.origin.row + grid.rows - gridSize.height,
        Math.floor(row)
      )
    );
    if (s.placement?.into.isOverlapping(s.placement.piece)) {
      if ((rotation !== undefined && oldRotation !== rotation) || oldColumn === undefined || oldRow === undefined) {
        // we have to try to fit
        s.placement.into._fitPieceInFreePlace(s.placement.piece, grid.columns, grid.rows, grid.origin);
        if (s.placement.piece.column === undefined) {
          s.placement.piece.column = oldColumn;
          s.placement.piece.row = oldRow;
          s.placement.piece._rotation = oldRotation;
          return {};
        }
      } else {
        s.placement.piece.column = oldColumn;
        s.placement.piece.row = oldRow;
        s.placement.piece._rotation = oldRotation;
        return {};
      }
    }
    if (s.placement.piece.column === oldColumn && s.placement.piece.row === oldRow && s.placement.piece._rotation === oldRotation) return {};

    s.placement.invalid = !!s.gameManager.getAction(s.pendingMoves?.[0].name, s.gameManager.players.atPosition(s.position!)!)._getError(
      s.pendingMoves?.[0].selections[0],
      {
        ...s.move?.args,
        '__placement__': [s.placement.piece.column ?? 1, s.placement.piece.row ?? 1, s.placement.piece.rotation]
      }
    );
    return {
      cancellable: true,
      ...updateBoard(s.gameManager, s.position!)
    };
  }),

  selectPlacement: ({ column, row, rotation }) => set(s => {
    if (!s.pendingMoves) return { placement: undefined };
    const error = s.gameManager.getAction(s.pendingMoves?.[0].name, s.gameManager.players.atPosition(s.position!)!)._getError(
      s.pendingMoves?.[0].selections[0],
      {
        ...s.move?.args,
        '__placement__': [column, row].concat(rotation ? [rotation] : [])
      }
    );
    if (error) return { error };

    // must be single move and single selection at this point
    const state = {
      placement: {
        ...s.placement!,
        selected: { row, column, rotation },
      },
    };

    if (!s.pendingMoves[0].requireExplicitSubmit) {
      get().clearMove()
      get().selectMove(s.pendingMoves[0], { __placement__: [column, row].concat(rotation ? [rotation] : []) });
      return state;
    }

    return updateSelections({
      ...s,
      ...state,
      disambiguateElement: undefined,
      uncommittedArgs: {
        ...s.uncommittedArgs,
        __placement__: [column, row].concat(rotation ? [rotation] : [])
      }
    });
  }),

  translations: {},
  renderedState: {},
  renderedSequence: -1,
  setBoardSize: () => set(s => {
    const boardSize = s.gameManager.game.getBoardSize(window.innerWidth, window.innerHeight, s.isMobile);
    if ((boardSize.name !== s.gameManager.game._ui.boardSize.name || boardSize.aspectRatio !== s.gameManager.game._ui.boardSize.aspectRatio) && s.position) {
      s.gameManager.game.setBoardSize(boardSize);
      return {aspectRatio: boardSize.aspectRatio, ...updateBoard(s.gameManager, s.position)};
    }
    return {};
  }),
  setDragElement: dragElement => set(s => {
    if (!dragElement) return { dragElement: undefined, dropSelections: [] };
    const moves = s.boardSelections[dragElement].dragMoves;
    let dropSelections: UIMove[] = [];
    if (moves) for (let {move, drag} of moves) {
      const elementChosen = {[move.selections[0].name]: s.gameManager!.game.atBranch(dragElement)};
      const sel = drag.resolve({...(s.move?.args || {}), ...elementChosen});
      // create new move with the dragElement included as an arg and the dropzone as the new selection
      dropSelections.push(decorateUIMove({
        name: move.name,
        prompt: move.prompt,
        args: { ...move.args, ...elementChosen },
        selections: [sel]
      }));
    }
    return { dragElement, dropSelections }
  }),
  dragOffset: {},
  dropSelections: [],
  setCurrentDrop: currentDrop => set(() => {
    return { currentDrop };
  }),
  setInfoElement: infoElement => set({ infoElement }),
  setUserOnline: (id: string, online: boolean) => {
    set(s => {
      const userOnline = new Map(s.userOnline)
      userOnline.set(id, online)
      return { userOnline }
    })
  },
  userOnline: new Map(),
}), shallow);

export const gameStore = createGameStore();

export type SetupComponentProps = {
  name: string,
  settings: Record<string, any>,
  players: User[],
  updateKey: (key: string, value: any) => void,
}
