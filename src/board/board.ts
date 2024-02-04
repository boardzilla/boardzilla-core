import Space from './space.js'
import { deserializeObject } from '../action/utils.js';

import type {
  default as GameElement,
  ElementJSON,
  ElementClass,
  ElementContext,
  Box,
  ElementUI,
} from './element.js';
import type Player from '../player/player.js';

/**
 * Type for layout of player controls
 * @category UI
 */
export type ActionLayout = {
  /**
   * The element to which the controls will anchor themselves
   */
  element: GameElement,
  /**
   * Maximum width of the controls as a percentage of the anchor element
   */
  width?: number,
  /**
   * Maximum height of the controls as a percentage of the anchor element
   */
  height?: number,
  /**
   * Boardzilla will automatically anchor the controls to {@link GameElement}'s
   * selected as part of the action. Include the name of the selection here to
   * prevent that behaviour.
   */
  noAnchor?: string[],
  /**
   * Position of the controls
   * <ul>
   * <li>inset: Inside the element
   * <li>beside: To the left or right of the element
   * <li>stack: Above or below the element
   * </ul>
   */
  position?: 'inset' | 'beside' | 'stack'
  /**
   * Distance from the left edge of the anchor element as a percentage of the
   * element's width
   */
  left?: number,
  /**
   * Distance from the right edge of the anchor element as a percentage of the
   * element's width
   */
  right?: number,
  /**
   * Distance from the top edge of the anchor element as a percentage of the
   * element's height
   */
  center?: number,
  /**
   * Distance from the left edge of the anchor element to the center of the
   * controls as a percentage of the element's width
   */
  top?: number,
  /**
   * Distance from the bottom edge of the anchor element as a percentage of the
   * element's height
   */
  bottom?: number,
  /**
   * For `'beside'` or `'stack'`, `gap` is the distance between the controls and
   * the element as a percentage of the entire board's size.
   */
  gap?: number,
};

export type BoardSize = {
  name: string,
  aspectRatio: number,
  fixed?: 'landscape' | 'portrait'
};

/**
 * Base class for the board. Represents the current state of the game and
 * contains all game elements (spaces and pieces). All games contain a single
 * Board class that inherits from this class and on which custom properties and
 * methods for a specific game can be added.
 *
 * @category Board
 */
export default class Board<P extends Player<P, B> = any, B extends Board<P, B> = any> extends Space<P, B> {
  /**
   * An element containing all game elements that are not currently in
   * play. When elements are removed from the game, they go here, and can be
   * retrieved, using
   * e.g. `board.pile.first('removed-element').putInto('destination-area')`.
   * @category Structure
   */
  pile: GameElement<P>;

  constructor(ctx: Partial<ElementContext<P, B>>) {
    super({ ...ctx, trackMovement: false });
    this.board = this as unknown as B; // ???
    this._ctx.removed = this.createElement(Space<P, B>, 'removed'),
    this.pile = this._ctx.removed;
  }

  /**
   * This method must be called inside {@link createGame} with all custom Space
   * and Piece class declared in your game.
   * @category Structure
   */
  registerClasses(...classList: ElementClass[]) {
    this._ctx.classRegistry = this._ctx.classRegistry.concat(classList);
  }

  // also gets removed elements
  allJSON(seenBy?: number): ElementJSON[] {
    return [this.toJSON(seenBy)].concat(
      this._ctx.removed._t.children.map(el => el.toJSON(seenBy))
    );
  }

  fromJSON(boardJSON: ElementJSON[]) {
    let { className, children, _id, order, ...rest } = boardJSON[0];
    if (this._ctx.game) rest = deserializeObject({...rest}, this._ctx.game);
    if (this.constructor.name !== className) throw Error(`Cannot create board from JSON. ${className} must equal ${this.constructor.name}`);

    // reset all on self
    for (const key of Object.keys(this)) {
      if (!['_ctx', '_t', '_ui', '_eventHandlers', 'board', 'game', 'pile'].includes(key) && !(key in rest))
        rest[key] = undefined;
    }
    Object.assign(this, {...rest});
    if (children) this.createChildrenFromJSON(children, '0');
    if (order) this._t.order = order;
    this._ctx.removed.createChildrenFromJSON(boardJSON.slice(1), '1');
  }

  // UI

  _ui: ElementUI<this> & {
    boardSize: BoardSize,
    boardSizes?: (screenX: number, screenY: number, mobile: boolean) => BoardSize
    setupLayout?: (board: B, player: P, boardSize: string) => void;
    frame?: Box;
    disabledDefaultAppearance?: boolean;
    stepLayouts: Record<string, ActionLayout>;
    previousStyles: Record<any, Box>;
    announcements: Record<string, (board: B) => JSX.Element>;
    infoModals: {
      title: string,
      condition?: (board: B) => boolean,
      modal: (board: B) => JSX.Element
    }[];
  } = {
    boardSize: {name: '_default', aspectRatio: 1},
    layouts: [],
    appearance: {},
    stepLayouts: {},
    previousStyles: {},
    announcements: {},
    infoModals: [],
  };

  // restore default layout rules before running setupLayout
  resetUI() {
    super.resetUI();
    this._ui.stepLayouts = {};
    this._ui.previousStyles ||= {};
  }

  setBoardSize(this: B, boardSize: BoardSize) {
    if (boardSize.name !== this._ui.boardSize.name) {
      this._ui.boardSize = boardSize;
    }
  }

  getBoardSize(screenX: number, screenY: number, mobile: boolean) {
    return this._ui.boardSizes && this._ui.boardSizes(screenX, screenY, mobile) || { name: '_default', aspectRatio: 1 };
  }

  applyLayouts(this: B, base?: (b: B) => void) {
    if (this._ui.setupLayout) {
      this.resetUI();
      this._ui.setupLayout(this, this._ctx.player!, this._ui.boardSize.name);
    }
    if (base) base(this);

    const aspectRatio = this._ui.boardSize.aspectRatio;
    this._ui.frame = {
      left: 0,
      top: 0,
      width: aspectRatio < 1 ? aspectRatio * 100 : 100,
      height: aspectRatio > 1 ? 100 / aspectRatio : 100
    };
    return super.applyLayouts();
  }

  /**
   * Apply default layout rules for all the placement of all player prompts and
   * choices, in relation to the board
   *
   * @param attributes - see {@link ActionLayout}
   *
   * @category UI
   */
  layoutControls(attributes: ActionLayout) {
    this._ui.stepLayouts["*"] = attributes;
  }

  /**
   * Apply layout rules to a particular step in the flow, controlling where
   * player prompts and choices appear in relation to the board
   *
   * @param step - the name of the step as defined in {@link playerActions}
   * @param attributes - see {@link ActionLayout}
   *
   * @category UI
   */
  layoutStep(step: string, attributes: ActionLayout) {
    if (!this._ctx.game.flow.getStep(step)) throw Error(`No such step: ${step}`);
    this._ui.stepLayouts["step:" + step] = attributes;
  }

  /**
   * Apply layout rules to a particular action, controlling where player prompts
   * and choices appear in relation to the board
   *
   * @param action - the name of the action as defined in {@link game#defineActions}
   * @param attributes - see {@link ActionLayout}
   *
   * @category UI
   */
  layoutAction(action: string, attributes: ActionLayout) {
    this._ui.stepLayouts["action:" + action] = attributes;
  }

  /**
   * Remove all built-in default appearance. If any elements have not been given a
   * custom appearance, this causes them to be hidden.
   *
   * @category UI
   */
  disableDefaultAppearance() {
    this._ui.disabledDefaultAppearance = true;
  }
}
