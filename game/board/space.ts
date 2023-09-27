import GameElement from './element'
import ElementCollection from './element-collection'
import { isA } from '../utils';

import { UndirectedGraph } from 'graphology';
import { dijkstra } from 'graphology-shortest-path';
import { bfs } from 'graphology-traversal';

import type {
  ElementFinder,
  ElementClass,
  ElementAttributes,
  ElementEventHandler
} from './types';
import type { Player } from '../player';

export default class Space<P extends Player> extends GameElement<P> {
  _eventHandlers: {
    enter: ElementEventHandler<P, GameElement<P>>[],
  } = { enter: [] };

  isSpace() { return true; }

  createElement<T extends GameElement<P>>(className: ElementClass<P, T>, name: string, attrs?: ElementAttributes<P, T>): T {
    const el = super.createElement(className, name, attrs);
    this.triggerEvent("enter", el);
    return el;
  }

  addEventHandler<T extends GameElement<P>>(type: "enter", handler: ElementEventHandler<P, T>) {
    this._eventHandlers[type].push(handler);
  }

  onEnter<T extends GameElement<P>>(type: ElementClass<P, T>, callback: (el: T) => void) {
    this.addEventHandler<T>("enter", { callback, type });
  }

  triggerEvent(event: "enter", entering: GameElement<P>) {
    for (const handler of this._eventHandlers[event]) {
      if (event === 'enter' && !isA(entering, handler.type)) continue;
      handler.callback(entering);
    }
  }

  connectTo(el: GameElement<P>, cost: number = 1) {
    if (!this._t.parent || this._t.parent !== el._t.parent) throw Error("Cannot connect two elements that are on different spaces");
    
    if (!this._t.parent._t.graph) {
      this._t.parent._t.graph = new UndirectedGraph<{element: Space<P>}, {cost: number}>();
    }
    const graph = this._t.parent._t.graph;
    if (!graph.hasNode(this._t.id)) graph.addNode(this._t.id, {element: this});
    if (!graph.hasNode(el._t.id)) graph.addNode(el._t.id, {element: el});
    graph.addEdge(this._t.id, el._t.id, {cost});
    return this;
  }

  adjacentTo(el: GameElement<P>) {
    if (!this._t.parent?._t.graph) return false;
    return this._t.parent!._t.graph.areNeighbors(this._t.id, el._t.id);
  }

  distanceTo(el: GameElement<P>) {
    if (!this._t.parent?._t.graph) return undefined;
    try {
      const graph = this._t.parent._t.graph;
      const path = dijkstra.bidirectional(graph, this._t.id, el._t.id, 'cost');
      let distance = 0;
      for (let n = 1; n != path.length; n++) {
        distance += graph.getEdgeAttributes(graph.edge(path[n - 1], path[n])).cost;
      }
      return distance;
    } catch(e) {
      return undefined;
    }
  }

  closest<F extends GameElement<P>>(className?: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  closest<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  closest<F extends GameElement<P>>(className?: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    let classToSearch: ElementClass<P, GameElement<P>> = GameElement<P>;
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

  withinDistance(distance: number) {
    const c = new ElementCollection<P, Space<P>>();
    try {
      const graph = this._t.parent!._t.graph!;
      bfs(graph, node => {
        const el = graph.getNodeAttributes(node).element;
        const d = this.distanceTo(el);
        if (d === undefined) return false;
        if (d > distance) return true;
        if (el !== this) c.push(el);
      });
    } catch(e) { }
    return c;
  }

  _otherFinder<T extends GameElement<P>>(finders: ElementFinder<P, T>[]): ElementFinder<P, GameElement<P>> {
    let otherFinder: ElementFinder<P, GameElement<P>> = el => el !== (this as GameElement<P>);
    for (const finder of finders) {
      if (typeof finder === 'object') {
        if (finder.adjacent !== undefined) {
          const adj = finder.adjacent;
          otherFinder = (el: GameElement<P>) => this.adjacentTo(el) === adj && el !== (this as GameElement<P>)
          delete(finder.adjacent);
        }
        if (finder.withinDistance !== undefined) {
          const distance = finder.withinDistance;
          otherFinder = (el: GameElement<P>) => {
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
