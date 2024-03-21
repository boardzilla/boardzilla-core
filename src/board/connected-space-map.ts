import AdjacencySpace from './adjacency-space.js';
import graphology, { DirectedGraph } from 'graphology';
import { dijkstra, edgePathFromNodePath } from 'graphology-shortest-path';
import Piece from './piece.js';
import GameElement from './element.js';
import { bfsFromNode } from 'graphology-traversal';
import ElementCollection from './element-collection.js';

import type { BaseGame } from './game.js';
import type Space from './space.js';
import type { ElementContext, ElementClass } from './element.js';
import type { ElementFinder } from './element-collection.js';

/**
 * Space element that has child Space elements with an adjacency relationship
 * with each other. Only Spaces can be directly added to an AdjacencySpace. No
 * adjacency is automically created with this class. Instead, each space
 * adjacency is created manually with {@link ConnectedSpaceMap#connect}. This is
 * useful for arbitrary adjacencies. See also {@link SquareGrid}, {@link
 * HexGrid} for standard adjacency layouts.
 */
export default class ConnectedSpaceMap<G extends BaseGame> extends AdjacencySpace<G> {
  _graph: DirectedGraph;

  static unserializableAttributes = [...AdjacencySpace.unserializableAttributes, '_graph'];

  constructor(ctx: ElementContext) {
    super(ctx);
    this._graph = new graphology.DirectedGraph<{space: Space<G>}, {distance: number}>();
    this.onEnter(Piece, () => { throw Error(`Only spaces can be added to space ${this.name}`); });
  }

  /**
   * Returns whether 2 elements contained within this space have an adjacency to
   * each other. The elements are considered adjacent if they are child Spaces
   * that have been connected, or if the provided elements are placed inside
   * such connected Spaces.
   * @category Adjacency
   */
  isAdjacent(el1: GameElement, el2: GameElement) {
    const n1 = this._positionedParentOf(el1);
    const n2 = this._positionedParentOf(el2);
    return this._graph.areNeighbors(n1._t.id, n2._t.id);
  }

  /**
   * Make these two Spaces adjacent. This creates a two-way adjacency
   * relationship. If called twice with the Spaces reversed, different distances
   * can be created for the adjacency in each direction.
   * @category Adjacency
   *
   * @param space1 - {@link Space} to connect
   * @param space2 - {@link Space} to connect
   * @param distance - Add a custom distance to this connection for the purposes
   * of distance-measuring. This distance is when measuring from space1 to space2.
   */
  connect(space1: Space<G>, space2: Space<G>, distance: number = 1) {
    this.connectOneWay(space1, space2, distance);
    // assume bidirectional unless directly called in reverse
    if (!this._graph.hasDirectedEdge(space2._t.id, space1._t.id)) this._graph.addDirectedEdge(space2._t.id, space1._t.id, {distance});
  }

  // @internal
  connectOneWay(space1: Space<G>, space2: Space<G>, distance: number = 1) {
    if (this !== space1._t.parent || this !== space2._t.parent) throw Error("Both spaces must be children of the space to be connected");

    if (!this._graph.hasNode(space1._t.id)) this._graph.addNode(space1._t.id, {space: space1});
    if (!this._graph.hasNode(space2._t.id)) this._graph.addNode(space2._t.id, {space: space2});

    this._graph.mergeEdge(space1._t.id, space2._t.id, {distance});
  }

  /**
   * Finds the shortest distance between two elements using this space. Elements
   * must be connected Spaces of this element or be elements inside such spaces.
   * @category Adjacency
   *
   * @param el1 - {@link GameElement} to measure distance from
   * @param el2 - {@link GameElement} to measure distance to
   * @returns shortest distance measured by the `distance` values added to each
   * connection in {@link connectTo}
   */
  distanceBetween(el1: GameElement, el2: GameElement) {
    const n1 = this._positionedParentOf(el1);
    const n2 = this._positionedParentOf(el2);
    return this._distanceBetweenNodes(String(n1._t.id), String(n2._t.id));
  }

  _distanceBetweenNodes(n1: string, n2: string): number {
    try {
      const path = dijkstra.bidirectional(this._graph, n1, n2, 'distance');
      const edgePath = edgePathFromNodePath(this._graph, path);
      return edgePath.reduce((distance, edge) => distance + this._graph.getEdgeAttribute(edge, 'distance'), 0);
    } catch(e) {
      return Infinity;
    }
  }

  /**
   * Finds all elements of the query type given that are within the provided
   * distance from the provided element, searching recursively through the
   * connected Spaces. This does *not* include the supplied element. Uses the
   * same query parameters as {@link all}.
   * @category Adjacency
   *
   * @param element - {@link GameElement} to measure distance from
   * @param distance - Distance to measure using the adjacency distances
   * @param {class} className - Optionally provide a class as the first argument
   * as a class filter. This will only match elements which are instances of the
   * provided class
   * @param finders - All other parameters are filters. See {@link
   * ElementFinder} for more information.
   */
  allWithinDistanceOf<F extends GameElement>(element: GameElement, distance: number, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  allWithinDistanceOf(element: GameElement, distance: number, className?: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): ElementCollection;
  allWithinDistanceOf(element: GameElement, distance: number, className?: any, ...finders: ElementFinder[]) {
    const source = String(this._positionedParentOf(element)._t.id);
    const nodes = new ElementCollection();
    bfsFromNode(this._graph, source, target => {
      const d = this._distanceBetweenNodes(source, target);
      if (d > distance) return true;
      nodes.push(this._graph.getNodeAttributes(target).space);
    });
    return nodes.all(className, (el: GameElement) => el !== element, ...finders);
  }

  /**
   * Finds all elements of the query type that are connected to the provided
   * element by any path, searching recursively through the connected
   * spaces. This includes the supplied element. This is useful for determining
   * the size of a contiguous connected area. Uses the same query parameters as
   * {@link all}.
   * @category Adjacency
   *
   * @param element - {@link GameElement} to measure distance from
   * @param {class} className - Optionally provide a class as the first argument
   * as a class filter. This will only match elements which are instances of the
   * provided class
   * @param finders - All other parameters are filters. See {@link
   * ElementFinder} for more information.
   */
  allConnectedTo<F extends GameElement>(element: GameElement, className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  allConnectedTo(element: GameElement, className?: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): ElementCollection;
  allConnectedTo(element: GameElement, className?: any, ...finders: ElementFinder[]) {
    const source = String(this._positionedParentOf(element)._t.id);
    const nodes = new ElementCollection();
    bfsFromNode(this._graph, source, target => {
      nodes.push(this._graph.getNodeAttributes(target).space);
    });
    return nodes.all(className, ...finders);
  }

  /**
   * Finds the nearest element of the query type given to the provided element,
   * searching recursively through the connected Spaces.
   * @category Adjacency
   *
   * @param element - {@link GameElement} to measure distance from
   * @param distance - Distance to measure using the adjacency distances
   * @param {class} className - Optionally provide a class as the first argument
   * as a class filter. This will only match elements which are instances of the
   * provided class
   * @param finders - All other parameters are filters. See {@link
   * ElementFinder} for more information.
   */
  closestTo<F extends GameElement>(element: GameElement, className: ElementClass<F>, ...finders: ElementFinder<F>[]): F | undefined;
  closestTo(element: GameElement, className?: ElementFinder<GameElement>, ...finders: ElementFinder<GameElement>[]): GameElement | undefined;
  closestTo<F extends GameElement>(element: GameElement, className?: any, ...finders: ElementFinder[]): F | GameElement | undefined {
    const source = this._positionedParentOf(element);
    let collection: ElementCollection;
    collection = this._t.children.all(className, (el: GameElement) => el !== element, ...finders);
    return collection.sortBy(el => this.distanceBetween(source, el))[0];
  }
}
