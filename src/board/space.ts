import GameElement from './element.js'

import type { BaseGame } from './game.js';
import type Player from '../player/player.js';
import type { ElementClass, ElementAttributes } from './element.js';
import { Piece } from '../index.js';

export type ElementEventHandler<T extends GameElement> = {callback: (el: T) => void} & Record<any, any>;

/**
 * Spaces are areas of the game. The spaces of your game are declared during
 * setup in {@link createGame} and never change during play.
 * @category Board
 */
export default class Space<G extends BaseGame, P extends Player = NonNullable<G['player']>> extends GameElement<G, P> {

  static unserializableAttributes = [...GameElement.unserializableAttributes, '_eventHandlers', '_visOnEnter', '_screen'];

  _eventHandlers: {
    enter: ElementEventHandler<GameElement>[],
    exit: ElementEventHandler<GameElement>[],
  } = { enter: [], exit: [] };

  _visOnEnter?: {
    default: boolean,
    except?: number[] | 'owner'
  }

  _screen?: 'all' | 'all-but-owner' | number[];

  /**
   * Show pieces to all players when they enter this space
   * @category Visibility
   */
  contentsWillBeShown() {
    this._visOnEnter = {default: true};
  }

  /**
   * Show pieces when they enter this space to its owner
   * @category Visibility
   */
  contentsWillBeShownToOwner() {
    this._visOnEnter = {default: false, except: 'owner'};
  }

  /**
   * Show piece to these players when they enter this space
   * @category Visibility
   */
  contentsWillBeShownTo(...players: P[]) {
    this._visOnEnter = {default: false, except: players.map(p => p.position)};
  }

  /**
   * Hide pieces to all players when they enter this space
   * @category Visibility
   */
  contentsWillBeHidden() {
    this._visOnEnter = {default: false};
  }

  /**
   * Hide piece to these players when they enter this space
   * @category Visibility
   */
  contentsWillBeHiddenFrom(...players: P[]) {
    this._visOnEnter = {default: true, except: players.map(p => p.position)};
  }

  /**
   * Call this to screen view completely from players. Blocked spaces completely
   * hide their contents, like a physical screen. No information about the
   * number, type or movement of contents inside this Space will be revealed to
   * the specified players
   *
   * @param players = Players for whome the view is blocked
   */
  blockViewFor(players: 'all' | 'none' | 'all-but-owner' | Player[]) {
    this._screen = players === 'none' ? undefined : players instanceof Array ? players.map(p => p.position) : players
  }

  isSpace() { return true; }

  create<T extends GameElement>(className: ElementClass<T>, name: string, attributes?: ElementAttributes<T>): T {
    const el = super.create(className, name, attributes);
    if ('showTo' in el) this.triggerEvent("enter", el as unknown as Piece<G>);
    return el;
  }

  addEventHandler<T extends GameElement>(type: keyof Space<G>['_eventHandlers'], handler: ElementEventHandler<T>) {
    if (this._ctx.gameManager?.phase === 'started') throw Error('Event handlers cannot be added once game has started.');
    this._eventHandlers[type].push(handler);
  }

  /**
   * Attach a callback to this space for every element that enters or is created
   * within.
   * @category Structure
   *
   * @param type - the class of element that will trigger this callback
   * @param callback - Callback will be called each time an element enters, with
   * the entering element as the only argument.
   *
   * @example
   * deck.onEnter(Card, card => card.hideFromAll()) // card placed in the deck are automatically turned face down
   */
  onEnter<T extends GameElement>(type: ElementClass<T>, callback: (el: T) => void) {
    this.addEventHandler<T>("enter", { callback, type });
  }

  /**
   * Attach a callback to this space for every element that is moved out of this
   * space.
   * @category Structure
   *
   * @param type - the class of element that will trigger this callback
   * @param callback - Callback will be called each time an element exits, with
   * the exiting element as the only argument.
   *
   * @example
   * deck.onExit(Card, card => card.showToAll()) // cards drawn from the deck are automatically turned face up
   */
  onExit<T extends GameElement>(type: ElementClass<T>, callback: (el: T) => void) {
    this.addEventHandler<T>("exit", { callback, type });
  }

  triggerEvent(event: keyof Space<G>['_eventHandlers'], element: Piece<G>) {
    if (this._visOnEnter) {
      element._visible = {
        default: this._visOnEnter.default,
        except: this._visOnEnter.except === 'owner' ? (this.owner ? [this.owner.position] : undefined) : this._visOnEnter.except
      }
    }

    for (const handler of this._eventHandlers[event]) {
      if (event === 'enter' && !(element instanceof handler.type)) continue;
      if (event === 'exit' && !(element instanceof handler.type)) continue;
      handler.callback(element);
    }
  }
}
