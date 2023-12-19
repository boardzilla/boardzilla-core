import React from 'react'
import { createRoot } from 'react-dom/client';
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from 'zustand/shallow';
import Main from './Main.js'
import { default as Game } from '../game.js'
import { humanizeArg, serializeArg } from '../action/utils.js';

import type { GameUpdateEvent, GameFinishedEvent, User } from './Main.js'
import Player from '../player/player.js'
import { Board, GameElement } from '../board/index.js'
import type { ElementJSON } from '../board/element.js'
import type { SerializedArg } from '../action/utils.js'
import type Selection from '../action/selection.js'
import type { Argument } from '../action/action.js'
import type { PendingMove, SerializedMove } from '../game.js'
import type { SetupFunction } from '../index.js'
import type { BoardSize } from '../board/board.js';

// this feels like the makings of a class
export type UIMove = PendingMove<Player> & {
  requireExplicitSubmit: boolean; // true if explicit submit has been provided or is not needed
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
  boardJSON: ElementJSON[]; // cache complete immutable json here, listen to this for board changes
  updateState: (s: GameUpdateEvent | GameFinishedEvent) => void;
  updateBoard: () => void; // call any time state changes to update immutable references for listeners. updates move, selections
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
      drag: Selection<Player>
    }[]
  }>; // pending moves on board
  prompt?: string; // prompt for choosing action if applicable
  selected: GameElement[]; // selected elements on board. these are not committed, analagous to input state in a controlled form
  setSelected: (s: GameElement[]) => void;
  setBoardSize: () => void;
  dragElement?: string;
  setDragElement: (el?: string) => void;
  dragOffset: {element?: string, x?: number, y?: number}; // mutable non-reactive record of drag offset
  dropSelections: UIMove[];
  currentDrop?: GameElement;
  setCurrentDrop: (el?: GameElement) => void;
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
    if (game.phase === 'new' && s.setup) {
      game = s.setup(update.state.state);
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
      game.players.fromJSON(update.state.state.players);
      game.board.fromJSON(update.state.state.board);
      game.flow.setBranchFromJSON(update.state.state.position);
    }
    game.players.setCurrent('currentPlayers' in update ? update.currentPlayers : []);
    game.phase = 'started';
    game.winner = [];

    if (update.type === 'gameFinished') {
      game.players.setCurrent([]);
      game.winner = update.winners.map(p => game.players.atPosition(p)!);
      game.phase = 'finished';
    }
    const position = s.position || update.state.position;

    console.debug(`Game update for player #${position}. Current flow:\n ${game.flow.stacktrace()}`);

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
      selected: [],
      ...updateSelections(game, position, undefined),
      ...updateBoard(game, position, update.state.state.board),
    }
  }),
  // function to ensure react detects a change. must be called immediately after any function that alters board state
  updateBoard: () => set(s => {
    if (!s.position) return {};
    return updateBoard(s.game, s.position);
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
  setBoardSize: () => set(s => {
    const boardSize = s.game.board.getBoardSize(window.innerWidth, window.innerHeight, s.isMobile);
    if (boardSize.name !== s.game.board._ui.boardSize.name) {
      s.game.board.setBoardSize(boardSize);
      s.updateBoard();
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
  setZoomable: zoomable => set({ zoomable }),
  setZoom: zoom => set(s => {
    return {
      zoomElement: zoom ? s.zoomable : undefined
    }
  }),
}), shallow);

// refresh move and selections
const updateSelections = (game: Game<Player, Board<Player>>, position: number, move?: UIMove) => {
  const player = game.players.atPosition(position);
  if (!player) return {};
  let state: Partial<GameStore> = {};
  let pendingMoves: GamePendingMoves
  let isBoardUpToDate = true;

  while (true) {
    pendingMoves = game.getPendingMoves(player, move?.name, move?.args);

    if (move && !pendingMoves?.moves) {
      // perhaps an update came while we were in the middle of a move
      console.error('move may no longer be valid. retrying getPendingMoves', move, pendingMoves);
      move = undefined;
      pendingMoves = game.getPendingMoves(player);
    }

    const moves = pendingMoves?.moves;

    // the only selection is skippable - skip and rerun selections
    if (moves?.length === 1 && moves[0].selections.length === 1 && moves[0].selections[0].skipIfOnlyOne) {
      const arg = moves[0].selections[0].isForced();
      if (arg === undefined) break;

      if (moves[0].selections[0].confirm) {
        // a confirm was added tho, so don't skip that. convert to confirm prompt
        // TODO: distinguish static from arg-taking? static can probably be skipped
        moves[0].args[moves[0].selections[0].name] = arg;
        moves[0].selections[0].name = '__confirm__';
        moves[0].selections[0].type = 'button';
        break;
      }

      move = {
        ...moves[0],
        args: {...moves[0].args, [moves[0].selections[0].name]: arg},
        requireExplicitSubmit: needsConfirm(moves[0])
      };
      continue;
    }

    // move is processable - add to queue and rerun
    if (moves?.length === 0) {
      try {
        if (!move) break;

        const player = game.players.atPosition(position);
        if (!player) break;

        // serialize now before we alter our state to ensure proper references
        const serializedMove: SerializedMove = {
          name: move.name,
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
          game.play();
          move = undefined;
          continue;
        }
      } catch (e) {
        // first line of defense for bad game logic. cancel all moves and
        // surface the error but update board anyways to prevent more errors
        console.error(`Game attempted to complete move but was unable to process:\n⮕ ${move!.name}({${Object.entries(move!.args).map(([k, v]) => k + ': ' + humanizeArg(v)).join(', ')}})\n`);
        console.error(e.stack);
        state.moves = [];
        move = undefined;
        break
      }
    }
    break;
  }

  if (pendingMoves) for (const move of pendingMoves.moves as UIMove[]) {
    move.requireExplicitSubmit = needsConfirm(move);
  }

  const boardSelections = pendingMoves ? getBoardSelections(pendingMoves.moves as UIMove[], move) : {};

  if (!isBoardUpToDate) state = {
    ...state,
    ...updateBoard(game, position),
    dragElement: undefined,
    currentDrop: undefined
  };

  return ({
    ...state,
    move,
    step: pendingMoves?.step,
    prompt: pendingMoves?.prompt,
    boardSelections,
    pendingMoves: pendingMoves?.moves,
  })
};

const getBoardSelections = (moves: UIMove[], move?: {name: string, args: Record<string, Argument<Player>>}) => {
  // populate boardSelections
  const boardSelections: Record<string, {
    clickMoves: UIMove[],
    dragMoves: {
      move: UIMove,
      drag: Selection<Player>
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
        let { dragInto, dragFrom } = sel.clientContext as { dragInto?: Selection<Player>, dragFrom?: Selection<Player> };
        if (dragInto) {
          for (const el of sel.boardChoices) {
            boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
            boardSelections[el.branch()].dragMoves.push({ move: boardMove, drag: sel.clientContext?.dragInto });
          }
        }
        if (dragFrom) {
          for (const el of dragFrom.resolve(move?.args || {}).boardChoices || []) {
            boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
            boardSelections[el.branch()].dragMoves.push({ move: boardMove, drag: sel });
          }
        }
      }
    }
  }
  return boardSelections;
}

const updateBoard = (game: Game<Player, Board<Player>>, position: number, json?: ElementJSON[]) => {
  // rerun layouts. probably optimize TODO
  game.contextualizeBoardToPlayer(game.players.atPosition(position));
  game.board.applyLayouts();

  return ({ boardJSON: json || game.board.allJSON() })
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
