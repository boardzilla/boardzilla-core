import GameElement from './element.js'
import Space from './space.js'

import type { ElementAttributes, ElementClass } from './element.js'
import type Game from './game.js'
import type Player from '../player/player.js';
import type { BaseGame } from './game.js';

/**
 * Pieces are game elements that can move during play
 * @category Board
 */
export default class Piece<G extends Game, P extends Player = NonNullable<G['player']>> extends GameElement<G, P> {

  _visible?: {
    default: boolean,
    except?: number[]
  }

  createElement<T extends GameElement>(className: ElementClass<T>, name: string, attrs?: ElementAttributes<T>): T {
    if (className === Space as unknown as ElementClass<T> || Object.prototype.isPrototypeOf.call(Space, className)) {
      throw Error(`May not create Space "${name}" in Piece "${this.name}"`);
    }
    return super.createElement(className, name, attrs);
  }

  /**
   * Show this piece to all players
   * @category Visibility
   */
  showToAll() {
    delete(this._visible);
  }

  /**
   * Show this piece only to the given player
   * @category Visibility
   */
  showOnlyTo(player: Player | number) {
    if (typeof player !== 'number') player = player.position;
    this._visible = {
      default: false,
      except: [player]
    };
  }

  /**
   * Show this piece to the given players without changing it's visibility to
   * any other players.
   * @category Visibility
   */
  showTo(...player: Player[] | number[]) {
    if (typeof player[0] !== 'number') player = (player as Player[]).map(p => p.position);
    if (this._visible === undefined) return;
    if (this._visible.default) {
      if (!this._visible.except) return;
      this._visible.except = this._visible.except.filter(i => !(player as number[]).includes(i));
    } else {
      this._visible.except = Array.from(new Set([...(this._visible.except instanceof Array ? this._visible.except : []), ...(player as number[])]))
    }
  }

  /**
   * Hide this piece from all players
   * @category Visibility
   */
  hideFromAll() {
    this._visible = {default: false};
  }

  /**
   * Hide this piece from the given players without changing it's visibility to
   * any other players.
   * @category Visibility
   */
  hideFrom(...player: Player[] | number[]) {
    if (typeof player[0] !== 'number') player = (player as Player[]).map(p => p.position);
    if (this._visible?.default === false && !this._visible.except) return;
    if (this._visible === undefined || this._visible.default === true) {
      this._visible = {
        default: true,
        except: Array.from(new Set([...(this._visible?.except instanceof Array ? this._visible.except : []), ...(player as number[])]))
      };
    } else {
      if (!this._visible.except) return;
      this._visible.except = this._visible.except.filter(i => !(player as number[]).includes(i));
    }
  }

  /**
   * Returns whether this piece is visible to the given player
   * @category Visibility
   */
  isVisibleTo(player: Player | number) {
    if (typeof player !== 'number') player = player.position;
    if (this._visible === undefined) return true;
    if (this._visible.default) {
      return !this._visible.except || !(this._visible.except.includes(player));
    } else {
      return this._visible.except?.includes(player) || false;
    }
  }

  /**
   * Returns whether this piece is visible to all players, or to the current
   * player if called when in a player context (during an action taken by a
   * player or while the game is viewed by a given player.)
   * @category Visibility
   */
  isVisible() {
    if (this._ctx.player) return this.isVisibleTo(this._ctx.player.position);
    return this._visible?.default !== false && (this._visible?.except ?? []).length === 0;
  }

  /**
   * Provide list of attributes that remain visible even when these pieces are
   * not visible to players. E.g. In a game with multiple card decks with
   * different backs, identified by Card#deck, the identity of the card when
   * face-down is hidden, but the deck it belongs to is not, since the card art
   * on the back would identify the deck. In this case calling
   * `Card.revealWhenHidden('deck')` will cause all attributes other than 'deck'
   * to be hidden when the card is face down, while still revealing which deck
   * it is.
   * @category Visibility
   */
  static revealWhenHidden<T extends Piece<BaseGame>>(this: ElementClass<T>, ...attrs: (string & keyof T)[]): void {
    this.visibleAttributes = attrs;
  }

  /**
   * Move this piece into another element. This triggers any {@link
   * Space#onEnter | onEnter} callbacks in the destination.
   * @category Structure
   *
   * @param to - Destination element
   * @param options.position - Place the piece into a specific numbered position
   * relative to the other elements in this space. Positive numbers count from
   * the beginning. Negative numbers count from the end.
   * @param options.fromTop - Place the piece into a specific numbered position counting
   * from the first element
   * @param options.fromBottom - Place the piece into a specific numbered position
   * counting from the last element
   */
  putInto(to: GameElement, options?: {position?: number, row?: number, column?: number, fromTop?: number, fromBottom?: number}) {
    if (to.isDescendantOf(this)) throw Error(`Cannot put ${this} into itself`);
    let pos: number = to._t.order === 'stacking' ? 0 : to._t.children.length;
    if (options?.position !== undefined) pos = options.position >= 0 ? options.position : to._t.children.length + options.position + 1;
    if (options?.fromTop !== undefined) pos = options.fromTop;
    if (options?.fromBottom !== undefined) pos = to._t.children.length - options.fromBottom;
    const previousParent = this._t.parent;
    const position = this.position();
    if (this._t.moved) this.game.addDelay();
    const refs = this._ctx.trackMovement && previousParent === to && options?.row === undefined && options?.column === undefined && to.childRefs();
    this._t.parent!._t.children.splice(position, 1);
    this._t.parent = to;
    to._t.children.splice(pos, 0, this);
    if (refs) this.assignChildRefs(refs);

    if (previousParent !== to && previousParent instanceof Space) previousParent.triggerEvent("exit", this);
    if (previousParent !== to && this._ctx.trackMovement) this._t.moved = true;

    delete this.column;
    delete this.row;
    if (options?.row !== undefined) this.row = options.row;
    if (options?.column !== undefined) this.column = options.column;

    if (previousParent !== to && to instanceof Space) to.triggerEvent("enter", this);
  }

  cloneInto<T extends GameElement>(this: T, into: GameElement): T {
    let attrs = this.attributeList();
    delete attrs.column;
    delete attrs.row;

    const clone = into.createElement(this.constructor as ElementClass<T>, this.name, attrs);
    if (into._t.order === 'stacking') {
      into._t.children.unshift(clone);
    } else {
      into._t.children.push(clone);
    }
    clone._t.parent = into;
    clone._t.order = this._t.order;
    for (const child of this._t.children) if (child instanceof Piece) child.cloneInto(clone);
    return clone;
  }

  /**
   * Remove this piece from the playing area and place it into {@link
   * Game#pile}
   * @category Structure
   */
  remove() {
    return this.putInto(this._ctx.removed);
  }
}
