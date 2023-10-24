import Space from './space'
import { deserializeObject } from '../action/utils';

import type {
  ElementJSON,
  ElementClass,
  Box,
  ActionLayout
} from './types';
import type { GameElement } from './';
import type { Player } from '../player';

// TODO add B generic to all board elements
// e.g. can:
//   game: Game<P, typeof this>
//   board: typeof this

export default class Board<P extends Player> extends Space<P> {
  pile: GameElement<P>;

  constructor(...classes: ElementClass<P, GameElement<P>>[]) {
    super({ classRegistry: classes });
    this.board = this;
    this._ctx.removed = this.createElement(Space, 'removed');
    this._ctx.trackMovement = false;
    this.pile = this._ctx.removed;
    this._ui.stepLayouts = {};
    this._ui.previousStyles = {};
  }

  // also gets removed elements
  allJSON(seenBy?: number): ElementJSON[] {
    return [this.toJSON(seenBy)].concat(
      this._ctx.removed._t.children.map(el => el.toJSON(seenBy))
    );
  }

  fromJSON(boardJSON: ElementJSON[]) {
    let { className, children, _id, order, ...rest } = boardJSON[0];
    if (this.game) rest = deserializeObject({...rest}, this.game);
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

  _ui: GameElement<P>['_ui'] & {
    frame?: Box;
    disabledDefaultAppearance?: boolean;
    stepLayouts: Record<string, ActionLayout<P>>;
    previousStyles: Record<any, Box>;
  };

  applyLayouts(force=false) {
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

  layoutStep(step: string, attributes: ActionLayout<P>) {
    if (step !== 'out-of-turn' && !this.game.flow.getStep(step)) throw Error(`No such step: ${step}`);
    this._ui.stepLayouts["step:" + step] = attributes;
  }

  layoutAction(action: string, attributes: ActionLayout<P>) {
    this._ui.stepLayouts["action:" + action] = attributes;
  }

  disableDefaultAppearance() {
    this._ui.disabledDefaultAppearance = true;
  }
}
