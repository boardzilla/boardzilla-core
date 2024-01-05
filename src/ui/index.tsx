import React from 'react'
import { createRoot } from 'react-dom/client';
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main.js'
import Game from '../game.js'
import { serializeArg } from '../action/utils.js';
import { Board, Die, GameElement, Piece } from '../board/index.js'
import DieComponent from './game/components/Die.js'
import Player from '../player/player.js'

import type { GameUpdateEvent, GameFinishedEvent, User } from './Main.js'
import type { Box, ElementJSON } from '../board/element.js'
import type { SerializedArg } from '../action/utils.js'
import Selection from '../action/selection.js'
import type { Argument } from '../action/action.js'
import type { PendingMove, SerializedMove } from '../game.js'
import type { SetupFunction } from '../index.js'
import type { BoardSize } from '../board/board.js';
import type { GameState } from '../interface.js';
import type { ResolvedSelection } from '../action/selection.js';

// this feels like the makings of a class
export type UIMove = PendingMove<Player> & {
  requireExplicitSubmit: boolean; // true if explicit submit has been provided or is not needed
}

// used to send a move
export type MoveMessage = {
  id: string;
  type: 'move';
  data: {
    name: string,
    args: Record<string, SerializedArg>
  } | {
    name: string,
    args: Record<string, SerializedArg>
  }[]
}

type GamePendingMoves = ReturnType<Game<Player, Board<Player>>['getPendingMoves']>;

const needsConfirm = (move: UIMove | PendingMove<Player>): boolean => (
  ('requireExplicitSubmit' in move && move.requireExplicitSubmit) ||
    move.selections.length !== 1 ||
    !(['board', 'choices', 'button'].includes(move.selections[0].type)) ||
    !!move.selections[0].confirm ||
    move.selections[0].isMulti()
);

type GameStore = {
  host: boolean,
  setHost: (host: boolean) => void,
  userID: string,
  setUserID: (userID: string) => void,
  setup?: SetupFunction<Player, Board<Player>>;
  setSetup: (s: SetupFunction<Player, Board<Player>>) => void;
  game: Game<Player, Board<Player>>;
  setGame: (game: Game<Player, Board<Player>>) => void;
  isMobile: boolean;
  boardJSON: ElementJSON[]; // cache complete immutable json here, listen to this for board changes. eventually can replace with game.sequence
  updateState: (state: (GameUpdateEvent | GameFinishedEvent) & {state: GameState<Player>}) => void;
  position?: number; // this player
  setPosition: (p: number) => void;
  move?: {name: string, args: Record<string, Argument<Player>>}; // move in progress, this is the LCD of pendingMoves, but is kept here as well for convenience
  selectMove: (sel?: UIMove, args?: Record<string, Argument<Player>>) => void; // commit the choice and find new choices or process the choice
  moves: {name: string, args: Record<string, SerializedArg>}[]; // move ready for processing
  clearMoves: () => void;
  error?: string,
  setError: (error: string) => void,
  step?: string,
  pendingMoves?: UIMove[]; // all pending moves
  boardSelections: Record<string, {
    clickMoves: UIMove[],
    dragMoves: {
      move: UIMove,
      drag: Selection<Player> | ResolvedSelection<Player>
    }[]
  }>; // pending moves on board
  prompt?: string; // prompt for choosing action if applicable
  selected: GameElement[]; // selected elements on board. these are not committed, analagous to input state in a controlled form
  setSelected: (s: GameElement[]) => void;
  automove?: number;
  renderedState: Record<string, {key: string, style?: Box}>;
  previousRenderedState: { sequence: number, elements: Record<string, {key?: string, style?: Box, movedTo?: string }> };
  setBoardSize: () => void;
  dragElement?: string;
  setDragElement: (el?: string) => void;
  dragOffset: {element?: string, x?: number, y?: number}; // mutable non-reactive record of drag offset
  dropSelections: UIMove[];
  currentDrop?: GameElement;
  setCurrentDrop: (el?: GameElement) => void;
  placement?: { // placing a piece inside a grid as the current selection
    piece: Piece;
    old: {
      parent: GameElement;
      position: number;
      row?: number;
      column?: number;
    }
    into: GameElement;
    layout: Exclude<GameElement['_ui']['computedLayouts'], undefined>[number];
  };
  selectPlacement: (placement: {column: number, row: number}) => void;
  zoomable?: GameElement;
  setZoomable: (el?: GameElement) => void;
  zoomElement?: GameElement;
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
  isMobile: !!globalThis.navigator?.userAgent.match(/Mobi/),
  boardJSON: [],
  updateState: update => set(s => {
    let { game } = s;
    const position = s.position || update.position;
    let previousRenderedState = s.previousRenderedState;
    window.clearTimeout(s.automove);
    if (update.state.sequence === s.game.sequence + 1) {
      // demote current state to previous and play over top
      previousRenderedState = {sequence: s.game.sequence, elements: {...s.renderedState}};
    } else if (update.state.sequence !== s.previousRenderedState.sequence + 1) {
      // old state is invalid
      previousRenderedState = {sequence: -1, elements: {}};
    }
    // otherwise reuse previous state, we're overwriting an internal version of the same state

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
    game.winner = [];

    if (update.type === 'gameFinished') {
      game.players.setCurrent([]);
      game.winner = update.winners.map(p => game.players.atPosition(p)!);
      game.phase = 'finished';
    }
    console.debug(`Game update for player #${position}. Current flow:\n ${game.flow.stacktrace()}`);

    let state: Partial<GameStore> = {
      game,
      position,
      ...updateBoard(game, position, update.state.board),
    };

    const readOnly = game.phase === 'finished' || 'readOnly' in update && update.readOnly;

    // may override board with new information from playing forward from the new state
    if (!readOnly) state = {
      ...state,
      ...updateSelections(game, position, undefined)
    }

    state.renderedState = {};
    state.previousRenderedState = previousRenderedState;
    s.game.sequence = update.state.sequence;

    if (readOnly) {
      return {
        ...state,
        move: undefined,
        step: undefined,
        prompt: undefined,
        boardSelections: {},
        pendingMoves: undefined,
      };
    }

    return {
      ...state,
      selected: [],
    };
  }),
  // pendingMove we're trying to complete, args are the ones we're committing to
  selectMove: (pendingMove?: UIMove, args?: Record<string, Argument<Player>>) => set(s => {
    let move: UIMove | undefined = undefined;
    if (pendingMove) {
      move = {
        ...pendingMove,
        args: {...pendingMove.args, ...args},
      };
      for (const sel of move.selections) {
        // the current selection cannot be filled in unless explicity supplied. this could be a forced arg with a confirmation step
        if (!args || !(sel.name in args)) delete move!.args[sel.name];
      }
    }
    let state: Partial<GameStore> = {};

    if (s.placement) {
      // restore state so we can process the move over again
      restorePlacedPiece(s.placement.piece, s.placement.old);
      state = { placement: undefined  };
    }

    state = {
      ...state,
      ...updateSelections(s.game!, s.position!, move)
    };

    if (s.placement && !state.boardJSON) {
      // guarantee update board if not done already
      state = {
        ...state,
        ...updateBoard(s.game, s.position!)
      }
    }

    if (!pendingMove) {
      state.renderedState = {...s.previousRenderedState.elements} as typeof state.renderedState;
      state.previousRenderedState = { sequence: Math.floor(s.game.sequence), elements: {} };
    }

    if (!s.placement && s.game.sequence > Math.floor(s.game.sequence)) {
      state.previousRenderedState = {sequence: Math.floor(s.game.sequence), elements: {...s.renderedState}};
      state.renderedState = {};
    }
    return state;
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
      dropSelections.push({
        name: move.name,
        prompt: move.prompt,
        args: { ...move.args, ...elementChosen },
        selections: [sel],
        requireExplicitSubmit: !!sel.confirm
      });
    }
    return { dragElement, dropSelections }
  }),
  dragOffset: {},
  dropSelections: [],
  setCurrentDrop: currentDrop => set(() => {
    return { currentDrop };
  }),
  selectPlacement: ({ column, row }) => set(s => {
    if (!s.placement) return {};
    if (!s.placement.piece.container()!.atPosition({ column, row })) {
      s.placement.piece.column = column;
      s.placement.piece.row = row;
      return updateBoard(s.game, s.position!);
    }
    return {};
  }),
  setZoomable: zoomable => set({ zoomable }),
  setZoom: zoom => set(s => {
    return {
      zoomElement: zoom ? s.zoomable : undefined
    }
  }),
}), shallow);

// refresh move and selections
const updateSelections = (game: Game<Player, Board<Player>>, position: number, move?: UIMove): Partial<GameStore> => {
  const player = game.players.atPosition(position);
  if (!player) return {};
  let state: Partial<GameStore> = {};
  let pendingMoves: GamePendingMoves
  let maySubmit = !!move;
  let autoSubmit = false;

  pendingMoves = game.getPendingMoves(player, move?.name, move?.args);

  if (move && !pendingMoves?.moves) {
    // perhaps an update came while we were in the middle of a move
    console.error('move may no longer be valid. retrying getPendingMoves', move, pendingMoves);
    move = undefined;
    pendingMoves = game.getPendingMoves(player);
  }

  let moves = pendingMoves?.moves;

  if (moves?.length === 1 && moves[0].selections.length === 1) {
    const selection = moves[0].selections[0];
    if (selection.type === 'place') {
      let piece = selection.clientContext.placement.piece as string | Piece;
      if (typeof piece === 'string') piece = moves[0].args[piece] as Piece;
      const old = {
        parent: piece.container()!,
        position: piece.container()!._t.children.indexOf(piece),
        row: piece.row,
        column: piece.column,
      }
      const into = selection.clientContext.placement.into as GameElement;
      game.sequence = Math.floor(game.sequence) + 0.5; // intermediate local update that will need to be merged
      piece.putInto(into);
      const layout = into._ui.computedLayouts?.[into.getLayoutItems().findIndex(l => l?.includes(piece as Piece))];
      if (layout) {
        state = {
          ...state,
          ...updateBoard(game, position),
          placement: {
            piece,
            old,
            into,
            layout
          }
        };
      } else {
        throw Error(`Tried to place ${piece.name} into ${into.name} but no layout found for this piece`);
      }
    }

    const skipIf = moves[0].selections[0].skipIf;
    // the only selection is skippable - skip and confirm or autoplay if possible
    if (skipIf === true || skipIf === 'always' || (moves[0].selections.length === 1 && (skipIf === 'only-one' || skipIf === false))) {
      const arg = moves[0].selections[0].isForced();
      if (arg !== undefined) {

        if (moves[0].selections[0].confirm) {
          // a confirm was added tho, so don't skip that. convert to confirm prompt
          // TODO: distinguish static from arg-taking? static can probably be skipped
          moves[0].args[moves[0].selections[0].name] = arg;
          moves[0].selections[0].name = '__confirm__';
          moves[0].selections[0].type = 'button';
        } else {
          move = {
            ...moves[0],
            args: {...moves[0].args, [moves[0].selections[0].name]: arg},
            requireExplicitSubmit: needsConfirm(moves[0])
          };
          if (game.getPendingMoves(player, move.name, move.args)?.moves.length === 0) {
            if (maySubmit === false) {
              autoSubmit = true;
              maySubmit = true;
            }
            moves = [];
          }
        }
      }
    }
  }

  // move is processable
  if (maySubmit && moves?.length === 0) {
    if (move) {
      const player = game.players.atPosition(position);
      if (player) {

        // serialize now before we alter our state to ensure proper references
        const serializedMove: SerializedMove = {
          name: move.name,
          args: Object.fromEntries(Object.entries(move.args).map(([k, v]) => [k, serializeArg(v)]))
        }

        console.debug(
          `${autoSubmit ? 'Autoplay' : 'Submitting'} valid move from player #${position}:\n` +
            `⮕ ${move.name}({${Object.entries(move.args).map(([k, v]) => k + ': ' + v.toString()).join(', ')}})`
        );
        //moveCallbacks.push((error: string) => console.error(`move ${moves} failed: ${error}`));
        const message: MoveMessage = {
          type: "move",
          id: '0', // String(moveCallbacks.length),
          data: serializedMove
        };

        if (autoSubmit) {
          // no need to run locally, just queue the submit and remove any moves from being presented
          // not using game queue because updates must come in before this if revealed information alters our forced move
          state.automove = window.setTimeout(() => window.top!.postMessage(message, "*"), 500); // speed
        } else {
          // run the move locally and submit in parallel
          try {
            state.error = game.processMove({ player, ...move });

            if (state.error) {
              throw Error(state.error);
            } else {
              game.play();
              game.sequence = Math.floor(game.sequence) + 0.5; // intermediate local update that will need to be merged
              state = {
                ...state,
                ...updateBoard(game, position),
              }

              window.top!.postMessage(message, "*");
            }
          } catch (e) {
            // first line of defense for bad game logic. cancel all moves and
            // surface the error but update board anyways to prevent more errors
            console.error(
              `Game attempted to complete move but was unable to process:\n` +
                `⮕ ${move!.name}({${Object.entries(move!.args).map(
                  ([k, v]) => k + ': ' + v.toString()
                ).join(', ')}})\n`
            );
            console.error(e.message);
            console.debug(e.stack);
          }
        }
        state = {
          ...state,
          dragElement: undefined,
          currentDrop: undefined,
          selected: [],
        };
        move = undefined;
        pendingMoves = undefined;
      }
    }
  }

  if (pendingMoves) for (const move of pendingMoves.moves as UIMove[]) {
    move.requireExplicitSubmit = needsConfirm(move);
  }

  const boardSelections = pendingMoves ? getBoardSelections(pendingMoves.moves as UIMove[], move) : {};

  return ({
    ...state,
    move,
    step: pendingMoves?.step,
    prompt: pendingMoves?.prompt,
    boardSelections,
    pendingMoves: pendingMoves?.moves as UIMove[],
  })
};

const getBoardSelections = (moves: UIMove[], move?: {name: string, args: Record<string, Argument<Player>>}) => {
  // populate boardSelections
  const boardSelections: Record<string, {
    clickMoves: UIMove[],
    dragMoves: {
      move: UIMove,
      drag: Selection<Player> | ResolvedSelection<Player>
    }[]
  }> = {};
  for (const p of moves) {
    for (const sel of p.selections) {
      if (sel.type === 'board' && sel.boardChoices) {
        const boardMove = {...p, selections: [sel]}; // simple board move of single selection to attach to element
        for (const el of sel.boardChoices) {
          boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
          boardSelections[el.branch()].clickMoves.push(boardMove);
        }
        let { dragInto, dragFrom } = sel.clientContext as { dragInto?: Selection<Player> | GameElement, dragFrom?: Selection<Player> | GameElement };
        if (dragInto) {
          if (dragInto instanceof GameElement) {
            // convert to confirmation for a single drop target
            dragInto = new Selection('__confirm__', { selectOnBoard: { chooseFrom: [dragInto] } });
          }
          for (const el of sel.boardChoices) {
            boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
            boardSelections[el.branch()].dragMoves.push({ move: boardMove, drag: dragInto });
          }
        }
        if (dragFrom) {
          for (const el of dragFrom instanceof GameElement ? [dragFrom] : dragFrom.resolve(move?.args || {}).boardChoices || []) {
            boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
            boardSelections[el.branch()].dragMoves.push({ move: boardMove, drag: sel });
          }
        }
      }
    }
  }
  return boardSelections;
}

// function to ensure react detects a change. must be called immediately after any function that alters board state
const updateBoard = (game: Game<Player, Board<Player>>, position: number, json?: ElementJSON[]) => {
  // rerun layouts. probably optimize TODO
  game.contextualizeBoardToPlayer(game.players.atPosition(position));
  game.board.applyLayouts(true, board => {
    board.all(Die).appearance({
      render: DieComponent,
      aspectRatio: 1,
    });
  });

  return ({ boardJSON: json || game.board.allJSON() })
}

const restorePlacedPiece = (
  piece: Piece, old: {
    parent: GameElement;
    position: number;
    row?: number;
    column?: number;
  }
) => {
  piece.putInto(old.parent, {
    position: old.position,
    placement: old.row !== undefined && old.column !== undefined ? {
      row: old.row,
      column: old.column
    } : undefined
  });
}

export type SetupComponentProps = {
  name: string,
  settings: Record<string, any>,
  players: User[],
  updateKey: (key: string, value: any) => void,
}

export const render = <P extends Player, B extends Board>(setup: SetupFunction<P, B>, { settings, boardSizes, layout }: {
  settings?: Record<string, (p: SetupComponentProps) => JSX.Element>
  boardSizes?: (screenX: number, screenY: number, mobile: boolean) => BoardSize,
  layout?: (board: B, player: P, boardSize: string) => void
}): void => {
  const state = gameStore.getState();
  const setupGame: SetupFunction = (state) => {
    const game = setup(state);
    game.board._ui.boardSizes = boardSizes;
    game.board._ui.setupLayout = layout;
    return game;
  }
  // we can anonymize Player class internally
  state.setSetup(setupGame);

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
