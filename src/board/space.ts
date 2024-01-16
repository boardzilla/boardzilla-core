import GameElement from './element.js'
import ElementCollection from './element-collection.js'

import graphology from 'graphology';
import { dijkstra } from 'graphology-shortest-path';
import { bfsFromNode } from 'graphology-traversal';

import type Board from './board.js';
import type { ElementClass, ElementAttributes } from './element.js';
import type { ElementFinder } from './element-collection.js';
import type Player from '../player/player.js';

export type ElementEventHandler<T extends GameElement> = {callback: (el: T) => void} & Record<any, any>;

/**
 * Spaces are areas of the board. The spaces of your board are declared during
 * setup in {@link createGame} and never change during play.
 * @category Board
 */
export default class Space<P extends Player<P, B> = any, B extends Board<P, B> = any> extends GameElement<P, B> {
  _eventHandlers: {
    enter: ElementEventHandler<GameElement>[],
    exit: ElementEventHandler<GameElement>[],
  } = { enter: [], exit: [] };

  isSpace() { return true; }

  create<T extends GameElement>(className: ElementClass<T>, name: string, attributes?: ElementAttributes<T>): T {
    const el = super.create(className, name, attributes);
    this.triggerEvent("enter", el);
    return el;
  }

  addEventHandler<T extends GameElement>(type: keyof Space['_eventHandlers'], handler: ElementEventHandler<T>) {
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

  triggerEvent(event: keyof Space['_eventHandlers'], element: GameElement) {
    for (const handler of this._eventHandlers[event]) {
      if (event === 'enter' && !(element instanceof handler.type)) continue;
      if (event === 'exit' && !(element instanceof handler.type)) continue;
      handler.callback(element);
    }
  }

  /**
   * Make this space adjacent with another space for the purposes of adjacency
   * and path-finding functions. Using `connectTo` on a space creates a custom
   * graph of adjacency for the container of this space that overrides the
   * standard adjacency based on the built-in row/column placement.
   * @category Structure
   *
   * @param space - {@link Space} to connect to
   * @param distance - Add a custom distance to this connection for the purposes
   * of distance-measuring.
   */
  connectTo(space: Space<P, B>, distance: number = 1) {
    if (!this._t.parent || this._t.parent !== space._t.parent) throw Error("Cannot connect two spaces that are not in the same parent space");

    if (!this._t.parent._t.graph) {
      this._t.parent._t.graph = new graphology.UndirectedGraph<{space: Space<P, B>}, {distance: number}>();
    }
    const graph = this._t.parent._t.graph;
    if (!graph.hasNode(this._t.id)) graph.addNode(this._t.id, {space: this});
    if (!graph.hasNode(space._t.id)) graph.addNode(space._t.id, {space});
    graph.addEdge(this._t.id, space._t.id, {distance});
    return this;
  }

  /**
   * Finds the shortest distance to another space, traveling thru multiple
   * connections
   * @category Structure
   *
   * @param space - {@link Space} to measure distance to
   * @returns shortest distance measured by the `distance` values added to each
   * connection in {@link connectTo}
   */
  distanceTo(space: Space<P, B>) {
    if (!this._t.parent?._t.graph) return undefined;
    try {
      const graph = this._t.parent._t.graph;
      const path = dijkstra.bidirectional(graph, this._t.id, space._t.id, 'distance');
      let distance = 0;
      for (let n = 1; n != path.length; n++) {
        distance += graph.getEdgeAttributes(graph.edge(path[n - 1], path[n])).distance;
      }
      return distance;
    } catch(e) {
      return undefined;
    }
  }

  /**
   * Finds the nearest space connected to this space, measured by distance. Uses
   * the same parameters as {@link GameElement#first}
   * @category Queries
   */
  closest<F extends Space<P, B>>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  closest(className?: ElementFinder<Space<P, B>>, ...finders: ElementFinder<Space<P, B>>[]): Space<P, B> | undefined;
  closest<F extends Space<P, B>>(className?: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): F | Space<P, B> | undefined {
    let classToSearch: ElementClass<Space<P, B>> = Space<P, B>;
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      if (className) finders = [className, ...finders];
    } else {
      classToSearch = className;
    }
    if (!this._t.parent?._t.graph) return undefined;
    const others = this.others(classToSearch, ...finders);
    return others.sortBy(el => {
      const distance =  this.distanceTo(el);
      return distance === undefined ? Infinity : distance;
    })[0];
  }

  /**
   * Finds all spaces connected to this space by a distance no more than
   * `distance`
   *
   * @category Queries
   */
  withinDistance(distance: number) {
    const c = new ElementCollection<Space<P, B>>();
    try {
      const graph = this._t.parent!._t.graph!;
      bfsFromNode(graph, this._t.id, node => {
        const el = graph.getNodeAttributes(node).space;
        const d = this.distanceTo(el);
        if (d === undefined) return false;
        if (d > distance) return true;
        if (el !== this) c.push(el);
      });
    } catch(e) {
      throw Error("No connections on this space");
    }
    return c;
  }

  _otherFinder<T extends GameElement>(finders: ElementFinder<T>[]): ElementFinder<GameElement> {
    let otherFinder: ElementFinder<GameElement> = el => el !== (this as GameElement);
    for (const finder of finders) {
      if (typeof finder === 'object') {
        if (finder.adjacent !== undefined) {
          const adj = finder.adjacent;
          otherFinder = (el: Space<P, B>) => this.adjacentTo(el) === adj && el !== (this as GameElement)
          delete(finder.adjacent);
        }
        if (finder.withinDistance !== undefined) {
          const distance = finder.withinDistance;
          otherFinder = (el: Space<P, B>) => {
            const d = this.distanceTo(el);
            if (d === undefined) return false;
            return d <= distance && el !== (this as GameElement);
          }
          delete(finder.withinDistance);
        }
      }
    }
    return otherFinder
  }
}
