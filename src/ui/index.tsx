import React from 'react'
import { createRoot } from 'react-dom/client';
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main.js'
import Game from '../game.js'
import { Board, GameElement, Piece } from '../board/index.js'
import Player from '../player/player.js'
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
import type { BoardSize } from '../board/board.js';
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
  setup?: SetupFunction<Player, Board<Player>>;
  setSetup: (s: SetupFunction<Player, Board<Player>>) => void;
  game: Game<Player, Board<Player>>;
  finished: boolean;
  setFinished: (finished: boolean) => void;
  isMobile: boolean;
  boardJSON: ElementJSON[]; // cache complete immutable json here, listen to this for board changes. eventually can replace with game.sequence
  updateState: (state: (GameUpdateEvent | GameFinishedEvent) & {state: GameState<Player>}, readOnly?: boolean) => void;
  position?: number; // this player
  move?: UIMove; // move in progress
  selectMove: (move?: UIMove, args?: Record<string, Argument<Player>>) => void; // commit the choice and find new choices or process the choice
  clearMove: () => void; // clear all move inputs
  uncommittedArgs: Record<string, Argument<Player>>; // all current args that are submittable, including uncommitted board selections
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
      drag: Selection<Player> | ResolvedSelection<Player>;
    }[];
    error?: string;
  }>; // pending moves on board
  disambiguateElement?: { element: GameElement<Player>, moves: UIMove[] };
  selected: GameElement[]; // selected elements on board. these are not committed, analagous to input state in a controlled form
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
    piece: Piece; // temporary ghost piece
    invalid?: boolean
    into: GameElement;
    layout: Exclude<GameElement['_ui']['computedLayouts'], undefined>[number];
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
  game: new Game(Player, Board),
  finished: false,
  setFinished: finished => set({ finished }),
  isMobile: !!globalThis.navigator?.userAgent.match(/Mobi/),
  boardJSON: [],
  updateState: (update, readOnly=false) => set(s => {
    let { game } = s;
    const position = s.position || update.position;
    let renderedState = s.renderedState;
    let previousRenderedState = s.previousRenderedState;
    window.clearTimeout(s.automove);
    if (update.state.sequence === s.game.sequence + 1) {
      // demote current state to previous and play over top
      renderedState = {};
      previousRenderedState = {sequence: s.game.sequence, elements: {...s.renderedState}};
    } else if (update.state.sequence !== s.previousRenderedState.sequence + 1) {
      // old state is invalid
      renderedState = {};
      previousRenderedState = {sequence: -1, elements: {}};
    }
    // otherwise reuse previous+current state, we're overwriting an internal version of the same state

    if (game.phase === 'new' && s.setup) {
      game = s.setup(update.state);
      // @ts-ignore;
      window.game = game;
      // @ts-ignore;
      window.board = game.board;
      // @ts-ignore;
      for (const className of game.board._ctx.classRegistry) window[className.name] = className;
      game.board.setBoardSize(
        game.board.getBoardSize(window.innerWidth, window.innerHeight, !!globalThis.navigator?.userAgent.match(/Mobi/))
      );
    } else {
      game.players.fromJSON(update.state.players);
      game.board.fromJSON(update.state.board);
      game.flow.setBranchFromJSON(update.state.position);
    }
    game.players.setCurrent('currentPlayers' in update ? update.currentPlayers : []);
    game.phase = 'started';
    game.messages = update.state.messages;
    game.announcements = update.state.announcements;
    game.winner = [];

    if (update.type === 'gameFinished') {
      game.players.setCurrent([]);
      game.winner = update.winners.map(p => game.players.atPosition(p)!);
    }
    console.debug(`Game update for player #${position}. Current flow:\n ${game.flow.stacktrace()}`);

    let state: GameStore = {
      ...s,
      game,
      position,
      finished: false,
      move: undefined,
      prompt: undefined,
      actionDescription: undefined,
      otherPlayerAction: undefined,
      announcementIndex: 0,
      step: undefined,
      boardSelections: {},
      pendingMoves: undefined,
      placement: undefined,
      ...updateBoard(game, position, update.state.board),
    };

    // may override board with new information from playing forward from the new state
    if (!readOnly && update.type !== 'gameFinished') {
      state = updateSelections(state)
    }

    state.previousRenderedState = previousRenderedState;
    state.renderedState = renderedState;
    s.game.sequence = update.state.sequence;

    return state;
  }),

  // pendingMove we're trying to complete, args are the ones we're committing to, pass no move/args for move cancellation
  selectMove: (pendingMove?: UIMove, args?: Record<string, Argument<Player>>) => set(s => {
    let state: GameStore = { ...s };
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
          ...updateBoard(s.game, s.position!)
        };
      }
    }

    state = updateSelections(state);

    if (!pendingMove) {
      s.game.sequence = Math.floor(s.game.sequence);
    }

    if (s.game.sequence > Math.floor(s.game.sequence)) {
      state.previousRenderedState = {sequence: Math.floor(s.game.sequence), elements: {...s.renderedState}};
      state.renderedState = {};
    }

    return state;
  }),

  clearMove: () => set(clearMove()),
  uncommittedArgs: {},
  setError: error => set({ error }),
  actions: [],
  announcementIndex: 0,
  dismissAnnouncement: () => set(s => ({ announcementIndex: s.announcementIndex + 1 })),
  boardSelections: {},
  pendingMoves: [],
  selected: [],
  selectElement: (moves: UIMove[], element: GameElement) => set(s => {
    if (moves.length === 0) return {};
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
      s.selected.includes(element) ?
        s.selected.filter(s => s !== element) :
        s.selected.concat([element])
    ) : (
      s.selected[0] === element ? [] : [element]
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
    const state: Partial<GameStore> = {};
    if (!s.placement || s.pendingMoves?.[0].selections[0]?.type !== 'place') {
      return {}
    }
    if (column !== undefined && row !== undefined && !s.placement?.piece.container()!.atPosition({ column, row })) {
      s.placement.piece.column = column;
      s.placement.piece.row = row;
    }
    if (rotation !== undefined) {
      s.placement.piece.rotation = rotation;
    }
    s.placement.invalid = !!s.game.getAction(s.pendingMoves?.[0].name, s.game.players.atPosition(s.position!)!)._getError(
      s.pendingMoves?.[0].selections[0],
      {
        ...s.move?.args,
        '__placement__': [s.placement.piece.column ?? 1, s.placement.piece.row ?? 1, s.placement.piece.rotation]
      }
    );
    return {... state, ...updateBoard(s.game, s.position!) };
  }),

  selectPlacement: ({ column, row, rotation }) => set(s => {
    if (!s.pendingMoves) return { placement: undefined };
    const error = s.game.getAction(s.pendingMoves?.[0].name, s.game.players.atPosition(s.position!)!)._getError(
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
    const boardSize = s.game.board.getBoardSize(window.innerWidth, window.innerHeight, s.isMobile);
    if (boardSize.name !== s.game.board._ui.boardSize.name && s.position) {
      s.game.board.setBoardSize(boardSize);
      updateBoard(s.game, s.position);
    }
    return {};
  }),
  setDragElement: dragElement => set(s => {
    if (!dragElement) return { dragElement: undefined, dropSelections: [] };
    const moves = s.boardSelections[dragElement].dragMoves;
    let dropSelections: UIMove[] = [];
    if (moves) for (let {move, drag} of moves) {
      const elementChosen = {[move.selections[0].name]: s.game!.board.atBranch(dragElement)};
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
 * GameElement#appearance}, {@link Board#layoutStep} and {@link
 * Board#layoutAction}.
 *
 * @param options.announcements - A list of announcements. Each is a function
 * that accepts the {@link Board} object and returns the JSX of the
 * announcement. These can be called from {@link game#announce} or {@link
 * game.finish}.
 *
 * @param options.infoModals - A list of informational panels that appear in the
 * info sidebar. Each is an object with:
 * <ul>
 * <li>title: The title shown in the sidebar
 * <li>modal: a function that accepts the {@link Board} object and returns the JSX
 *   of the modal.
 * <li>condition: An optional condition function that accepts the {@link Board}
 *   object and returns as a boolean whether the modal should be currently
 *   available
 * </ul>
 *
 * @category UI
 */
export const render = <P extends Player, B extends Board>(setup: SetupFunction<P, B>, options: {
  settings?: Record<string, (p: SetupComponentProps) => JSX.Element>
  boardSizes?: (screenX: number, screenY: number, mobile: boolean) => BoardSize,
  layout?: (board: B, player: P, boardSize: string) => void,
  announcements?: Record<string, (board: B) => JSX.Element>
  infoModals?: {title: string, modal: (board: B) => JSX.Element}[]
}): void => {
  const { settings, boardSizes, layout, announcements, infoModals } = options;
  const state = gameStore.getState();
  const setupGame: SetupFunction = state => {
    const game = setup(state);
    game.board._ui.boardSizes = boardSizes;
    game.board._ui.setupLayout = layout;
    game.board._ui.announcements = announcements ?? {};
    game.board._ui.infoModals = infoModals ?? [];
    return game;
  }
  // we can anonymize Player class internally
  state.setSetup(setupGame);

  const boostrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || '{}');
  const { host, userID, minPlayers, maxPlayers, dev }: { host: boolean, userID: string, minPlayers: number, maxPlayers: number, dev?: boolean } = boostrap;
  state.setHost(host);
  state.setDev(dev);
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
