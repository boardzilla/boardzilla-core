import React from 'react'
import { createRoot } from 'react-dom/client';
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main.js'
import GameManager from '../game-manager.js'
import { Game, GameElement, Piece } from '../board/index.js'
import { Player } from '../index.js'
import {
  updateSelections,
  UIMove,
  updateBoard,
  removePlacementPiece,
  decorateUIMove,
  clearMove,
} from './lib.js';

import type { GameUpdateEvent, GameFinishedEvent, User } from './Main.js'
import type { Box, ElementJSON } from '../board/element.js'
import type Selection from '../action/selection.js'
import type { Argument } from '../action/action.js'
import type { SetupFunction } from '../index.js'
import type { BoardSize } from '../board/game.js';
import type { GameState } from '../interface.js';
import type { ResolvedSelection } from '../action/selection.js';
export { ProfileBadge } from './game/components/ProfileBadge.js';
import {
  toggleSetting,
  numberSetting,
  textSetting,
  choiceSetting
} from './setup/components/settingComponents.js';
export {
  toggleSetting,
  numberSetting,
  textSetting,
  choiceSetting
};

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
  renderedState: Record<string, {
    key: string;
    style?: Box & { rotation?: number };
    attrs?: Record<string, any>;
  }>;
  previousRenderedState: {
    sequence: number;
    elements: Record<string, {
      key?: string;
      style?: Box & { rotation?: number };
      attrs?: Record<string, any>;
      movedTo?: string;
    }>
  };
  setBoardSize: () => void;
  dragElement?: string;
  setDragElement: (el?: string) => void;
  dragOffset: {element?: string, x?: number, y?: number}; // mutable non-reactive record of drag offset
  dropSelections: UIMove[];
  currentDrop?: GameElement;
  setCurrentDrop: (el?: GameElement) => void;
  placement?: { // placing a piece inside a grid as part of the current move
    selected?: { row: number, column: number }; // player indicated choice, ready for validation/confirmation
    piece: Piece<Game> ; // temporary ghost piece
    invalid?: boolean
    into: GameElement;
    layout: NonNullable<GameElement['_ui']['computedLayouts']>[number];
    rotationChoices?: number[];
  };
  setPlacement: (placement: {column?: number, row?: number, rotation?: number}) => void; // select placement. not committed, analagous to input state in a controlled form
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
    let renderedState = s.renderedState;
    let previousRenderedState = s.previousRenderedState;
    window.clearTimeout(s.automove);
    if (update.state.sequence === s.gameManager.sequence + 1) {
      // demote current state to previous and play over top
      renderedState = {};
      previousRenderedState = {sequence: s.gameManager.sequence, elements: {...s.renderedState}};
    } else if (update.state.sequence !== s.previousRenderedState.sequence + 1) {
      // old state is invalid
      renderedState = {};
      previousRenderedState = {sequence: -1, elements: {}};
    }
    // otherwise reuse previous+current state, we're overwriting an internal version of the same state

    if (gameManager.phase === 'new' && s.setup) {
      gameManager = s.setup(update.state);
      // @ts-ignore;
      window.game = gameManager.game;
      // @ts-ignore;
      for (const className of gameManager.game._ctx.classRegistry) window[className.name] = className;
      gameManager.game.setBoardSize(
        gameManager.game.getBoardSize(window.innerWidth, window.innerHeight, !!globalThis.navigator?.userAgent.match(/Mobi/))
      );
    } else {
      gameManager.players.fromJSON(update.state.players);
      gameManager.game.fromJSON(update.state.board);
      gameManager.players.assignAttributesFromJSON(update.state.players);
      gameManager.flow.setBranchFromJSON(update.state.position);
    }
    gameManager.players.setCurrent('currentPlayers' in update ? update.currentPlayers : []);
    gameManager.phase = 'started';
    gameManager.messages = update.state.messages;
    gameManager.announcements = update.state.announcements;
    gameManager.winner = [];

    if (update.type === 'gameFinished') {
      gameManager.players.setCurrent([]);
      gameManager.phase = 'finished';
      gameManager.winner = update.winners.map(p => gameManager.players.atPosition(p)!);
    }
    console.debug(`Game update for player #${position}. Current flow:\n ${gameManager.flow.stacktrace()}`);

    let state: GameStore = {
      ...s,
      gameManager,
      position,
      move: undefined,
      prompt: undefined,
      actionDescription: undefined,
      otherPlayerAction: undefined,
      announcementIndex: 0,
      step: undefined,
      boardSelections: {},
      pendingMoves: undefined,
      placement: undefined,
      ...updateBoard(gameManager, position, update.state.board),
    };

    // may override board with new information from playing forward from the new state
    if (!readOnly && update.type !== 'gameFinished') {
      state = updateSelections(state)
    }

    state.previousRenderedState = previousRenderedState;
    state.renderedState = renderedState;
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

    if (!pendingMove) {
      s.gameManager.sequence = Math.floor(s.gameManager.sequence);
    }

    if (s.gameManager.sequence > Math.floor(s.gameManager.sequence)) {
      state.previousRenderedState = {sequence: Math.floor(s.gameManager.sequence), elements: {...s.renderedState}};
      state.renderedState = {};
    }

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

    get().selectMove(move);
    const selected = selection.isMulti() ? (
      s.selected?.includes(element) ?
        (s.selected ?? []).filter(s => s !== element) :
        (s.selected ?? []).concat([element])
    ) : (
      s.selected?.[0] === element ? [] : [element]
    );

    return updateSelections({
      ...s,
      selected,
      disambiguateElement: undefined,
      uncommittedArgs: {
        ...s.uncommittedArgs,
        [selection.name]: selection.isMulti() ? selected : selected[0]
      }
    });
  }),

  setPlacement: ({ column, row, rotation }) => set(s => {
    if (!s.placement || s.pendingMoves?.[0].selections[0]?.type !== 'place') {
      return {}
    }
    if (column !== undefined && row !== undefined) {
      const oldColumn = s.placement.piece.column;
      const oldRow = s.placement.piece.row;
      s.placement.piece.column = column;
      s.placement.piece.row = row;
      if (s.placement?.piece.isOverlapping()) {
        s.placement.piece.column = oldColumn;
        s.placement.piece.row = oldRow;
      }
    }
    if (rotation !== undefined) {
      s.placement.piece.rotation = rotation;
    }
    s.placement.invalid = !!s.gameManager.getAction(s.pendingMoves?.[0].name, s.gameManager.players.atPosition(s.position!)!)._getError(
      s.pendingMoves?.[0].selections[0],
      {
        ...s.move?.args,
        '__placement__': [s.placement.piece.column ?? 1, s.placement.piece.row ?? 1, s.placement.piece.rotation]
      }
    );
    return { cancellable: true, ...updateBoard(s.gameManager, s.position!) };
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

  renderedState: {},
  previousRenderedState: {sequence: -1, elements: {}},
  setBoardSize: () => set(s => {
    const boardSize = s.gameManager.game.getBoardSize(window.innerWidth, window.innerHeight, s.isMobile);
    if (boardSize.name !== s.gameManager.game._ui.boardSize.name && s.position) {
      s.gameManager.game.setBoardSize(boardSize);
      updateBoard(s.gameManager, s.position);
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

/**
 * The core function called to customize the game's UI.
 *
 * @param {Object} options
 * @param options.settings - Define your game's settings that the host can
 * customize.  This is an object consisting of custom settings. The key is a
 * name for this setting that can be used in {@link Game#setting} to retrieve
 * the setting's value for this game. The object is the result of calling one of
 * the setting functions {@link toggleSetting}, {@link numberSetting}, {@link
 * textSetting} or {@link choiceSetting}.
 *
 * @param options.boardSizes - A function that determines what board size to use
 * based on the player's device and viewport. The function will take the
 * following arguments:
 * <ul>
 * <li>screenX: The player's view port width
 * <li>screenY: The player's view port height
 * <li>mobile: true if using a mobile device
 * </ul>
 * The function should return a string indicating the layout to use, this will
 * be cached and sent to the `layout` function.
 *
 * @param options.layout - A function for declaring all UI customization in the
 * game. Typically this will include calls to {@link GameElement#layout}, {@link
 * GameElement#appearance}, {@link Game#layoutStep} and {@link
 * Game#layoutAction}.
 *
 * @param options.announcements - A list of announcements. Each is a function
 * that accepts the {@link Game} object and returns the JSX of the
 * announcement. These can be called from {@link game#announce} or {@link
 * game.finish}.
 *
 * @param options.infoModals - A list of informational panels that appear in the
 * info sidebar. Each is an object with:
 * <ul>
 * <li>title: The title shown in the sidebar
 * <li>modal: a function that accepts the {@link Game} object and returns the JSX
 *   of the modal.
 * <li>condition: An optional condition function that accepts the {@link Game}
 *   object and returns as a boolean whether the modal should be currently
 *   available
 * </ul>
 *
 * @category UI
 */
export const render = <B extends Game>(setup: SetupFunction<B>, options: {
  settings?: Record<string, (p: SetupComponentProps) => JSX.Element>
  boardSizes?: (screenX: number, screenY: number, mobile: boolean) => BoardSize,
  layout?: (game: B, player: NonNullable<B['player']>, boardSize: string) => void,
  announcements?: Record<string, (game: B) => JSX.Element>
  infoModals?: {title: string, modal: (game: B) => JSX.Element}[]
}): void => {
  const { settings, boardSizes, layout, announcements, infoModals } = options;
  const state = gameStore.getState();
  const setupGame: SetupFunction<B> = state => {
    const gameManager = setup(state);
    gameManager.game._ui.boardSizes = boardSizes;
    gameManager.game._ui.setupLayout = layout;
    gameManager.game._ui.announcements = announcements ?? {};
    gameManager.game._ui.infoModals = infoModals ?? [];
    return gameManager;
  }
  // we can anonymize Player class internally
  state.setSetup(setupGame);

  const boostrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || '{}');
  const { host, userID, minPlayers, maxPlayers, defaultPlayers, dev }: {
    host: boolean,
    userID: string,
    minPlayers: number,
    maxPlayers: number,
    defaultPlayers: number,
    dev?: boolean
  } = boostrap;
  state.setHost(host);
  state.setDev(dev);
  state.setUserID(userID);

  const root = createRoot(document.getElementById('root')!)
  root.render(
    <Main
      minPlayers={minPlayers}
      maxPlayers={maxPlayers}
      defaultPlayers={defaultPlayers}
      setupComponents={settings || {}}
    />
  );
};
