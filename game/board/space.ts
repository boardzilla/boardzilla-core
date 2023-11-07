import GameElement from './element.js'
import ElementCollection from './element-collection.js'

import { UndirectedGraph } from 'graphology';
import { dijkstra } from 'graphology-shortest-path';
import { bfs } from 'graphology-traversal';

import type {
  ElementFinder,
  ElementClass,
  ElementAttributes,
  ElementEventHandler
} from './types.d.ts';
import type { Player } from '../player/index.js';

/**
 * Spaces are areas of the board. The spaces of your board are declared during
 * setup in {@link createGame} and never change during play.
 * @category Board
 */
export default class Space<P extends Player> extends GameElement<P> {
  _eventHandlers: {
    enter: ElementEventHandler<P, GameElement<P>>[],
  } = { enter: [] };

  /** internal */
  isSpace() { return true; }

  /** internal */
  createElement<T extends GameElement<P>>(className: ElementClass<P, T>, name: string, attrs?: ElementAttributes<P, T>): T {
    const el = super.createElement(className, name, attrs);
    this.triggerEvent("enter", el);
    return el;
  }

  /** internal */
  addEventHandler<T extends GameElement<P>>(type: "enter", handler: ElementEventHandler<P, T>) {
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
  onEnter<T extends GameElement<P>>(type: ElementClass<P, T>, callback: (el: T) => void) {
    this.addEventHandler<T>("enter", { callback, type });
  }

  /** internal */
  triggerEvent(event: "enter", entering: GameElement<P>) {
    for (const handler of this._eventHandlers[event]) {
      if (event === 'enter' && !(entering instanceof handler.type)) continue;
      handler.callback(entering);
    }
  }

  /**
   * Make this space adjacent with another space for the purposes of adjacency
   * and path-finding functions.
   * @category Structure
   *
   * @param space - {@link Space} to connect to
   * @param distance - Add a custom distance to this connection for the purposes
   * of distance-measuring.
   */
  connectTo(space: Space<P>, distance: number = 1) {
    if (!this._t.parent || this._t.parent !== space._t.parent) throw Error("Cannot connect two spaces that are not in the same parent space");

    if (!this._t.parent._t.graph) {
      this._t.parent._t.graph = new UndirectedGraph<{space: Space<P>}, {distance: number}>();
    }
    const graph = this._t.parent._t.graph;
    if (!graph.hasNode(this._t.id)) graph.addNode(this._t.id, {space: this});
    if (!graph.hasNode(space._t.id)) graph.addNode(space._t.id, {space});
    graph.addEdge(this._t.id, space._t.id, {distance});
    return this;
  }

  /**
   * If this space is adjacent to another space
   * @category Structure
   */
  adjacentTo(space: Space<P>) {
    if (!this._t.parent?._t.graph) return false;
    return this._t.parent!._t.graph.areNeighbors(this._t.id, space._t.id);
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
  distanceTo(space: Space<P>) {
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
  closest<F extends Space<P>>(className?: ElementFinder<P, Space<P>>, ...finders: ElementFinder<P, Space<P>>[]): Space<P> | undefined;
  closest<F extends Space<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  closest<F extends Space<P>>(className?: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | Space<P> | undefined {
    let classToSearch: ElementClass<P, Space<P>> = Space<P>;
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
    const c = new ElementCollection<P, Space<P>>();
    try {
      const graph = this._t.parent!._t.graph!;
      bfs(graph, node => {
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

  /** internal */
  _otherFinder<T extends GameElement<P>>(finders: ElementFinder<P, T>[]): ElementFinder<P, GameElement<P>> {
    let otherFinder: ElementFinder<P, GameElement<P>> = el => el !== (this as GameElement<P>);
    for (const finder of finders) {
      if (typeof finder === 'object') {
        if (finder.adjacent !== undefined) {
          const adj = finder.adjacent;
          otherFinder = (el: Space<P>) => this.adjacentTo(el) === adj && el !== (this as GameElement<P>)
          delete(finder.adjacent);
        }
        if (finder.withinDistance !== undefined) {
          const distance = finder.withinDistance;
          otherFinder = (el: Space<P>) => {
            const d = this.distanceTo(el);
            if (d === undefined) return false;
            return d <= distance && el !== (this as GameElement<P>);
          }
          delete(finder.withinDistance);
        }
      }
    }
    return otherFinder
  }
}
