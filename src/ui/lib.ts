import React, { CSSProperties } from 'react'
import DieComponent from './game/components/Die.js'
import { SerializedArg, serializeArg } from '../action/utils.js';
import Selection from '../action/selection.js'
import { GameElement, Die } from '../board/index.js'

import type { GameStore } from './store.js';
import type { default as GameManager, SerializedMove, PendingMove } from '../game-manager.js'
import type { Box, ElementJSON } from '../board/element.js'
import type { ResolvedSelection } from '../action/selection.js';
import type { BaseGame } from '../board/game.js'
import type { ActionLayout, Piece, PieceGrid } from '../board/index.js'

type GamePendingMoves = ReturnType<GameManager['getPendingMoves']>;

// this feels like the makings of a class
export type UIMove = PendingMove & {
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

// refresh move and selections
export function updateSelections(store: GameStore): GameStore {
  let { gameManager, position, move, placement } = store;
  if (!position) return store;

  const player = gameManager.players.atPosition(position);
  if (!player) return store;
  let state: GameStore = {
    ...store,
    error: undefined
  };
  let pendingMoves: GamePendingMoves
  let maySubmit = !!move;
  let autoSubmit = false;

  pendingMoves = gameManager.getPendingMoves(player, move?.name, move?.args);

  if (move && !pendingMoves?.moves) {
    // perhaps an update came while we were in the middle of a move
    console.error('move may no longer be valid. retrying getPendingMoves', move, pendingMoves);
    move = undefined;
    pendingMoves = gameManager.getPendingMoves(player);
  }

  let moves = pendingMoves?.moves;

  if (moves?.length === 1 && moves[0].selections.length === 1) {
    if (!move) move = decorateUIMove(moves[0]);

    const selection = moves[0].selections[0];
    if (selection.type === 'place' && !placement) {
      let piece = selection.clientContext.placement.piece as string | Piece<BaseGame>;
      if (typeof piece === 'string') piece = moves[0].args[piece] as Piece<BaseGame>;
      const into = selection.clientContext.placement.into as PieceGrid<BaseGame>;
      const clone = piece.cloneInto(into);
      clone._ui.ghost = true;
      if (selection.rotationChoices) {
        // find the closest allowable rotation to the current rotation
        clone.rotation = clone.rotation === undefined ?
          selection.rotationChoices[0] :
          [...selection.rotationChoices].sort((r1, r2) => {
            const a1 = Math.abs(((r1 - clone.rotation!) % 360 + 360) % 360 - 180);
            const a2 = Math.abs(((r2 - clone.rotation!) % 360 + 360) % 360 - 180);
            return a1 < a2 ? 1 : -1;
          })[0];
      }

      state = {
        ...state,
        ...updateBoard(gameManager, position),
      };
      state.placement = {
        piece: clone,
        into,
        layout: into._ui.computedLayouts![0],
        rotationChoices: selection.rotationChoices,
      };
    }

    if (selection.type === 'board' && selection.initial && state.selected === undefined) {
      state.selected = selection.initial as GameElement[]
      state.uncommittedArgs[selection.name] = selection.initial;
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
          move = decorateUIMove({
            ...moves[0],
            args: {...moves[0].args, [moves[0].selections[0].name]: arg}
          });
          if (gameManager.getPendingMoves(player, move.name, move.args)?.moves.length === 0) {
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
      const player = gameManager.players.atPosition(position);
      if (player) {
        state.cancellable = false;

        // serialize now before we alter our state to ensure proper references
        const serializedMove: SerializedMove = {
          name: move.name,
          args: Object.fromEntries(Object.entries(move.args).map(([k, v]) => [k, serializeArg(v)]))
        }

        console.debug(
          `${autoSubmit ? 'Autoplay' : 'Submitting'} valid move from player #${position}:\n` +
            `⮕ ${move.name}({${Object.entries(move.args).map(([k, v]) => `${k}: ${v}`).join(', ')}})`
        );
        //moveCallbacks.push((error: string) => console.error(`move ${moves} failed: ${error}`));
        const message: MoveMessage = {
          type: "move",
          id: '0', // String(moveCallbacks.length),
          data: serializedMove
        };

        if (autoSubmit) {
          // no need to run locally, just queue the submit and remove any moves from being presented
          // not using game queue because updates must come in *before* this if revealed information alters our forced move
          state.automove = window.setTimeout(() => window.top!.postMessage(message, "*"), 500); // speed
        } else {
          // run the move locally and submit in parallel

          state = { ...state, ...clearMove() };
          if (state.placement) {
            // remove temporary placement piece only once the full move is submitted
            removePlacementPiece(state.placement);
            state.placement = undefined;
          }

          try {
            state.error = gameManager.processMove({ player, ...move });

            if (state.error) {
              // should probably never reach this point since the error would
              // have been caught with any possible choices presented
              throw Error(state.error);
            } else {
              try {
                gameManager.play();
              } catch (e) {
                // this is a nice-to-have to speed up animations by
                // "pre-playing" the flow. this could legitimately fail until
                // the updated state is received from the server so exceptions
                // here are ignored.
              }
              gameManager.sequence = Math.floor(gameManager.sequence) + 0.5; // intermediate local update that will need to be merged
              let json: any = undefined;
              if (gameManager.intermediateUpdates.length) {
                json = gameManager.intermediateUpdates[0][0].board
                gameManager.game.fromJSON(json);
                gameManager.intermediateUpdates = [];
              }
              state = {
                ...state,
                ...updateBoard(gameManager, position, json),
              }

              window.top!.postMessage(message, "*");
            }
          } catch (e) {
            // first line of defense for bad game logic. cancel all moves and
            // surface the error but update board anyways to prevent more errors
            console.error(
              `Game attempted to complete move but was unable to process:\n` +
                `⮕ ${move!.name}({${Object.entries(move!.args).map(
                  ([k, v]) => `${k}: ${v}`
                ).join(', ')}})\n`
            );
            console.error(e.message);
            console.debug(e.stack);
          }
        }
      }
      move = undefined;
    }
  }

  if (autoSubmit) return state;

  if (pendingMoves) {
    pendingMoves.moves = pendingMoves.moves.map(move => decorateUIMove(move));
  }

  state = {
    ...state,
    move,
    step: pendingMoves?.step,
    prompt: pendingMoves?.prompt,
    pendingMoves: pendingMoves?.moves as UIMove[],
  };

  if (gameManager.players.currentPosition.length > 0) {
    const allowedActions = gameManager.allowedActions(gameManager.players.allCurrent()[0]);
    state.step = allowedActions.step;
    let description = allowedActions.description || 'taking their turn';

    const actionsWithDescription = allowedActions.actions.filter(a => a.description);
    if (actionsWithDescription.length === 1) {
      description = actionsWithDescription[0].description!;
      if (!gameManager.players.currentPosition.includes(position)) state.otherPlayerAction = actionsWithDescription[0].name;
    }
    state.actionDescription = `${gameManager.players.currentPosition.length > 1 ? 'Players are' : gameManager.players.current() + ' is'} ${description}`;
  }

  Object.assign(state, updateBoardSelections(state));
  Object.assign(state, updateControls(state));
  Object.assign(state, updatePrompts(state));

  return state;
}

// find the best layout for the current moves, going in this order:
// - the last selected, visible game element as part of the current move(s) that hasn't been disabled via layoutAction.noAnchor
// - a supplied layoutAction for the only current move
// - a supplied layoutStep belonging to the step to which the current move(s) belong
export function updateControls(store: GameStore): Pick<GameStore, "controls"> {
  const { gameManager, position, pendingMoves, selected, move, boardSelections, disambiguateElement, otherPlayerAction, step } = store;

  if (!pendingMoves?.length && (!position || gameManager.players.currentPosition.includes(position))) {
    return { controls: undefined };
  }

  let layout: ActionLayout | undefined = undefined;
  let name: string = '';
  let moves = pendingMoves || [];
  let style: CSSProperties = { };

  if (!layout && disambiguateElement?.element) {
    layout = { element: disambiguateElement.element, position: 'beside', gap: 2 };
    moves = disambiguateElement.moves;
    name = 'disambiguate-board-selection';
  }

  if (!layout && selected?.length === 1) {
    const clickMoves = boardSelections[selected[0].branch()]?.clickMoves;
    if (clickMoves?.length === 1 && !clickMoves[0].selections[0].isMulti()) {
      layout = { element: selected[0], position: 'beside', gap: 2 };
      name = 'action:' + moves[0].name;
      moves = clickMoves;
    }
  }

  // anchor to last element in arg list
  if (!layout && move && !pendingMoves?.[0].selections[0].isBoardChoice()) {
    const element = Object.entries(move.args).reverse().find(([name, el]) => (
      !gameManager.game._ui.stepLayouts["action:" + move.name]?.noAnchor?.includes(name) && el instanceof GameElement
    ));
    if (element && (element[1] as GameElement)._ui?.computedStyle) {
      layout = { element: element[1] as GameElement, position: 'beside', gap: 2 };
      name = 'action:' + element[0];
    }
  }

  if (!layout && pendingMoves?.length) {
    const moves = pendingMoves.filter(m => move || m.name.slice(0, 4) !== '_god'); // no display for these normally

    if (moves.length === 1) {
      // skip non-board moves if board elements already selected (cant this be more specific? just moves that could apply?)
      if (!selected?.length || moves[0].selections.some(s => s.type !== 'board')) {
        const actionLayout = gameManager.game._ui.stepLayouts["action:" + moves[0].name];
        if (actionLayout?.element?._ui?.computedStyle) {
          layout = actionLayout;
          name = 'action:' + moves[0].name;
        }
      }
    }
  }

  if (!layout && otherPlayerAction) {
    const actionLayout = gameManager.game._ui.stepLayouts["action:" + otherPlayerAction];
    if (actionLayout?.element?._ui?.computedStyle) {
      layout = actionLayout;
      name = 'action:' + otherPlayerAction;
    }
  }

  if (!layout && step) {
    name = 'step:' + step;
    layout = gameManager.game._ui.stepLayouts[name];
  }

  if (!layout) {
    name = '*';
    layout = gameManager.game._ui.stepLayouts[name];
  }

  if (layout) {
    const box: Box = layout.element.relativeTransformToBoard();

    if (layout.position === 'beside' || layout.position === 'stack') {
      if (box.left > 100 - box.left - box.width) {
        style.right = `clamp(0%, calc(${100 - box.left - (layout.position === 'beside' ? 0 : box.width)}% + ${layout.position === 'beside' ? layout.gap : 0}vw), 100%)`;
        style.left = undefined;
      } else {
        style.left = `clamp(0%, calc(${box.left + (layout.position === 'beside' ? box.width : 0)}% + ${layout.position === 'beside' ? layout.gap : 0}vw), 100%)`;
      }

      if (box.top > 100 - box.top - box.height) {
        style.bottom = `clamp(0%, calc(${100 - box.top - (layout.position === 'beside' ? box.height : 0)}% + ${layout.position === 'beside' ? 0 : layout.gap}vw), 100%)`;
        style.top = undefined;
      } else {
        style.top = `clamp(0%, calc(${box.top + (layout.position === 'beside' ? 0: box.height)}% + ${layout.position === 'beside' ? 0 : layout.gap}vw), 100%)`;
      }
    } else {
      // inset
      if (layout.right !== undefined) {
        style.right = 100 + ((layout.right * box.width / 100) - box.left - box.width) + '%';
      } else if (layout.center !== undefined) {
        style.left ??= ((layout.center - 50) * box.width / 100) + box.left + '%';
        style.right = 100 + ((50 - layout.center) * box.width / 100) - box.left - box.width + '%';
        style.margin = '0 auto';
      } else {
        style.left ??= ((layout.left ?? 0) * box.width / 100) + box.left + '%';
      }

      if (layout.bottom !== undefined) {
        style.bottom = 100 + ((layout.bottom * box.height / 100) - box.top - box.height) + '%';
      } else {
        style.top = ((layout.top ?? 0) * box.height / 100) + box.top + '%';
      }
    }

    if (layout.width !== undefined) style.maxWidth = (layout.width * box.width / 100) + '%';
    if (layout.height !== undefined) style.maxHeight = (layout.height * box.height / 100) + '%';
  } else {
    style = {left: 0, bottom: 0};
  }

  return { controls: {style, name, moves} };
}

export function updateBoardSelections(store: GameStore): Pick<GameStore, "boardSelections"> {
  const { pendingMoves, move } = store;
  if (!pendingMoves?.length) return { boardSelections: {} };

  // populate boardSelections
  const boardSelections: Record<string, {
    clickMoves: UIMove[],
    dragMoves: {
      move: UIMove,
      drag: Selection | ResolvedSelection,
    }[],
    error?: string
  }> = {};
  for (const p of pendingMoves) {
    for (const sel of p.selections) {
      if (sel.type === 'board' && sel.boardChoices) {
        const boardChoices = [...new Set(sel.boardChoices)];
        const boardMove = {...p, selections: [sel]}; // simple board move of single selection to attach to element
        for (const el of boardChoices) {
          boardSelections[el.branch()] ??= { clickMoves: [], dragMoves: [] };
          boardSelections[el.branch()].clickMoves.push(boardMove);
        }
        for (const {option, error} of sel.invalidOptions) {
          boardSelections[(option as GameElement).branch()] ??= { clickMoves: [], dragMoves: [] };
          boardSelections[(option as GameElement).branch()].error = error;
        }
        let { dragInto, dragFrom } = sel.clientContext as { dragInto?: Selection | GameElement, dragFrom?: Selection | GameElement };
        if (dragInto) {
          if (dragInto instanceof GameElement) {
            // convert to confirmation for a single drop target
            dragInto = new Selection('__confirm__', { selectOnBoard: { chooseFrom: [dragInto] } });
          }
          for (const el of boardChoices) {
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
  return { boardSelections };
}

export function updatePrompts(store: GameStore): Partial<GameStore> {
  const { controls, prompt, actionDescription, gameManager, position, disambiguateElement } = store;
  if (actionDescription && !gameManager.players.currentPosition.includes(position!)) return { boardPrompt: actionDescription };
  if (!controls) return { boardPrompt: undefined };
  const state: Partial<GameStore> = {};
  const moves = [...controls.moves];

  const boardMoves = moves.filter(m => m.selections.some(s => s.isBoardChoice()));
  if (!boardMoves.length) return {};

  if (disambiguateElement) {
    state.boardPrompt = undefined;
  } else if (boardMoves.length > 1) {
    state.boardPrompt = prompt;
  }

  for (const move of boardMoves) {
    // promote a board selection prompt to the move prompt
    move.prompt = move.selections[0].prompt ?? move.prompt ?? prompt;
    if (!move.prompt) {
      move.prompt = move.name;
      console.error(`No prompts defined for choosing "${move.selections[0].name}" in "${move.name}" action. Add either an action prompt or selection prompt.`);
    }
    move.selections[0].prompt = undefined;
    if (state.boardPrompt) {
      move.prompt = undefined;
    }
  }

  state.controls = {...controls, moves}
  return state;
}

export function removePlacementPiece(placement: NonNullable<GameStore['placement']>) {
  const position = placement.into._t.children.indexOf(placement.piece);
  placement.into._t.children.splice(position, 1);
}

// function to ensure react detects a change. must be called immediately after any function that alters board state
export function updateBoard(gameManager: GameManager, position: number, json?: ElementJSON[]) {
  // rerun layouts. probably optimize TODO
  gameManager.contextualizeBoardToPlayer(gameManager.players.atPosition(position));
  gameManager.game.applyLayouts(game => {
    game.all(Die).appearance({
      render: (die: Die) => React.createElement(DieComponent, { die }),
      aspectRatio: 1,
    });
  });

  return ({ boardJSON: json || gameManager.game.allJSON() })
}

export function decorateUIMove(move: PendingMove | UIMove): UIMove {
  const requireExplicitSubmit = ('requireExplicitSubmit' in move && move.requireExplicitSubmit) ||
    move.selections.length !== 1 ||
    ['number', 'text'].includes(move.selections[0].type) ||
    !!move.selections[0].confirm ||
    move.selections[0].isMulti();

  return {
    ...move,
    requireExplicitSubmit,
  };
}

export function clearMove(): Partial<GameStore> {
  return {
    move: undefined,
    cancellable: false,
    error: undefined,
    uncommittedArgs: {},
    disambiguateElement: undefined,
    selected: undefined,
    dragElement: undefined,
    currentDrop: undefined,
  }
}
