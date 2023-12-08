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

export type ActionLayout = {
  element: GameElement,
  top?: number,
  bottom?: number,
  width?: number,
  height?: number,
  noAnchor?: string[],
} & ({
  left?: number,
  right?: never,
  leftOrRight?: never,
} | {
  left?: never,
  right?: number,
  leftOrRight?: never,
} | {
  left?: never,
  right?: never,
  leftOrRight?: number,
});

/** @category Board */
export default class Board<P extends Player<P, B> = any, B extends Board<P, B> = any> extends Space<P, B> {
  pile: GameElement<P>;
  constructor(ctx: Partial<ElementContext<P, B>>) {
    super({ ...ctx, trackMovement: false });
    this.board = this as unknown as B; // ???
    this._ctx.removed = this.createElement(Space<P, B>, 'removed'),
    this.pile = this._ctx.removed;
  }

  registerClasses(...classList: ElementClass[]) {
    this._ctx.classRegistry = this._ctx.classRegistry.concat(classList);
  }

  get players() {
    return this._ctx.game.players;
  }

  /**
   * The setting value created by the host
   *
   * @param key - Corresponds to the key in `settings` in your {@link createGame}
   */
  gameSetting(key: string) {
    return this._ctx.game.settings[key];
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
    this._ui.layoutsSet = false; // TODO optimize
  }

  // UI

  _ui: ElementUI<this> & {
    breakpoint?: string,
    breakpoints?: (aspectRatio: number) => string;
    setupLayout?: (board: B, player: P, breakpoint: string) => void;
    layoutsSet?: boolean;
    frame?: Box;
    disabledDefaultAppearance?: boolean;
    stepLayouts: Record<string, ActionLayout>;
    previousStyles: Record<any, Box>;
  } = {
    layouts: [],
    appearance: {},
    stepLayouts: {},
    previousStyles: {},
  };

  // restore default layout rules before running setupLayout
  resetUI() {
    super.resetUI();
    this._ui.stepLayouts = { 'step:out-of-turn': { element: this, top: 0, left: 0 } };
    this._ui.previousStyles ||= {};
  }

  setBreakpoint(breakpoint: string) {
    if (breakpoint !== this._ui.breakpoint) {
      if (this._ui.breakpoint) this._ui.layoutsSet = false
      this._ui.breakpoint = breakpoint;
    }
  }

  getBreakpoint(aspectRatio: number) {
    return this._ui.breakpoints && this._ui.breakpoints(aspectRatio) || '_default';
  }

  applyLayouts(this: B, force=false) {
    if (!this._ui.breakpoint) this.setBreakpoint('_default');
    if (!this._ui.layoutsSet) {
      this.resetUI();
      if (this._ui.setupLayout) this._ui.setupLayout(this, this._ctx.player!, this._ui.breakpoint!);
      this._ui.layoutsSet = true;
    }

    const aspectRatio = this._ui.appearance.aspectRatio;
    if (aspectRatio) {
      this._ui.frame = {
        left: 0,
        top: 0,
        width: aspectRatio < 1 ? aspectRatio * 100 : 100,
        height: aspectRatio > 1 ? 100 / aspectRatio : 100
      };
    }
    return super.applyLayouts(force);
  }

  layoutStep(step: string, attributes: ActionLayout) {
    if (step !== 'out-of-turn' && !this._ctx.game.flow.getStep(step)) throw Error(`No such step: ${step}`);
    this._ui.stepLayouts["step:" + step] = attributes;
  }

  layoutAction(action: string, attributes: ActionLayout) {
    this._ui.stepLayouts["action:" + action] = attributes;
  }

  disableDefaultAppearance() {
    this._ui.disabledDefaultAppearance = true;
  }
}
