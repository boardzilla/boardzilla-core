import ElementCollection from './element-collection';
import { isA, shuffleArray, times } from '../utils';
import { scale, translate, cellSizeForArea } from './utils';
import { serializeObject, deserializeObject } from '../action/utils';
import random from 'random-seed';

import type {
  ElementAttributes,
  ElementContext,
  ElementClass,
  ElementFinder,
  ElementJSON,
  ElementUI,
  Box,
  Vector
} from './types';

import type { Player } from '../player';
import type { Game } from '../';
import type Board from './board';
import type { Sorter } from '../types';

import type { UndirectedGraph } from 'graphology';

export default class GameElement<P extends Player> {
  name: string;
  player?: P;
  board: Board<P>;
  game: Game<P, Board<P>>;
  top: typeof this.first;
  bottom: typeof this.last;
  topN: typeof this.firstN;
  bottomN: typeof this.lastN;

  // ctx shared for all elements in the tree
  _ctx: ElementContext<P>

  // tree info
  _t: {
    children: ElementCollection<P, GameElement<P>>,
    parent?: GameElement<P>,
    id: number,
    order?: 'normal' | 'stacking',
    was?: string,
    graph?: UndirectedGraph,
  };

  _visible?: {
    default: boolean,
    except?: number[]
  }

  static isGameElement = true;
  static hiddenAttributes: string[] = [];

  constructor(ctx: Partial<ElementContext<P>>) {
    this._ctx = ctx as ElementContext<P>;
    if (!ctx.top) {
      this._ctx.top = this;
      this._ctx.sequence = 0;
    }

    this._t = {
      children: new ElementCollection(),
      id: this._ctx.sequence++,
    }

    Object.getPrototypeOf(this).top = this.first;
    Object.getPrototypeOf(this).topN = this.firstN;
    Object.getPrototypeOf(this).bottom = this.last;
    Object.getPrototypeOf(this).bottomN = this.lastN;
  }

  setId(id?: number) {
    if (id !== undefined) {
      this._t.id = id;
      if (this._ctx.sequence < id) this._ctx.sequence = id;
    }
  }

  all<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  all<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  all<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children.all<GameElement<P>>(GameElement<P>, className, ...finders);
    }
    return this._t.children.all<F>(className, ...finders);
  }

  first<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  first<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  first<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: 1}, className, ...finders)[0];
    }
    return this._t.children.all<F>(className, ...finders)[0];
  }

  firstN<F extends GameElement<P>>(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  firstN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  firstN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: n}, className, ...finders);
    }
    return this._t.children._finder(className, {limit: n}, ...finders);
  }

  last<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): GameElement<P> | undefined;
  last<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | undefined;
  last<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | GameElement<P> | undefined {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: 1, order: 'desc'}, className, ...finders)[0];
    }
    return this._t.children._finder(className, {limit: 1, order: 'desc'}, ...finders)[0];
  }

  lastN<F extends GameElement<P>>(n: number, className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  lastN<F extends GameElement<P>>(n: number, className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  lastN<F extends GameElement<P>>(n: number, className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (typeof n !== 'number') throw Error('first argument must be number of matches');
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return this._t.children._finder<GameElement<P>>(GameElement<P>, {limit: n, order: 'desc'}, className, ...finders);
    }
    return this._t.children._finder(className, {limit: n, order: 'desc'}, ...finders);
  }

  // find sibling elements
  others<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): ElementCollection<P, GameElement<P>>;
  others<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F>;
  others<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): ElementCollection<P, F> | ElementCollection<P, GameElement<P>> {
    if (!this._t.parent) new ElementCollection<P, GameElement<P>>();
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      const otherFinder = this._otherFinder<GameElement<P>>([className, ...finders]);
      return this._t.parent!._t.children._finder<GameElement<P>>(GameElement<P>, {}, otherFinder, className, ...finders);
    }
    const otherFinder = this._otherFinder<GameElement<P>>(finders);
    return this._t.parent!._t.children._finder(className, {}, otherFinder, ...finders);
  }

  has<F extends GameElement<P>>(className: ElementFinder<P, GameElement<P>>, ...finders: ElementFinder<P, GameElement<P>>[]): boolean;
  has<F extends GameElement<P>>(className: ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): boolean;
  has<F extends GameElement<P>>(className: ElementFinder<P, F> | ElementClass<P, F>, ...finders: ElementFinder<P, F>[]): F | boolean {
    if ((typeof className !== 'function') || !('isGameElement' in className)) {
      return !!this.first(className, ...finders);
    } else {
      return !!this.first(className, ...finders);
    }
  }

  _otherFinder<T extends GameElement<P>>(finders: ElementFinder<P, T>[]): ElementFinder<P, GameElement<P>> {
    return (el: T) => el !== (this as GameElement<P>);
  }

  setOrder(order: typeof this._t.order) {
    this._t.order = order;
  }

  container<T extends GameElement<P>>(className?: ElementClass<P, T>): T | undefined {
    if (!className) return this._t.parent as T;
    if (this._t.parent) return isA(this._t.parent, className) ?
      this._t.parent as T:
      this._t.parent.container(className);
  }

  isEmpty() {
    return !this._t.children.length;
  }

  sortBy<E extends GameElement<P>>(key: Sorter<E> | (Sorter<E>)[], direction?: "asc" | "desc") {
    return this._t.children.sortBy(key, direction)
  }

  shuffle() {
    shuffleArray(this._t.children, this.game?.random || Math.random);
  }

  owner() {
    return this.player !== undefined ? this.player : this._t.parent?.player;
  }

  get mine() {
    if (!this._ctx.player) return false;
    return this.owner() === this._ctx.player;
  }

  showToAll() {
    delete(this._visible);
  }

  showOnlyTo(player: number) {
    this._visible = {
      default: false,
      except: [player]
    };
  }

  showTo(...player: number[]) {
    if (this._visible === undefined) return;
    if (this._visible.default) {
      if (!this._visible.except) return;
      this._visible.except = this._visible.except.filter(i => !player.includes(i));
    } else {
      this._visible.except = Array.from(new Set([...(this._visible.except instanceof Array ? this._visible.except : []), ...player]))
    }
  }

  hideFromAll() {
    this._visible = {default: false};
  }

  hideFrom(...player: number[]) {
    if (this._visible?.default === false && !this._visible.except) return;
    if (this._visible === undefined || this._visible.default === true) {
      this._visible = {
        default: true,
        except: Array.from(new Set([...(this._visible?.except instanceof Array ? this._visible.except : []), ...player]))
      };
    } else {
      if (!this._visible.except) return;
      this._visible.except = this._visible.except.filter(i => !player.includes(i));
    }
  }

  isVisibleTo(p: number) {
    if (this._visible === undefined) return true;
    if (this._visible.default) {
      return !this._visible.except || !(this._visible.except.includes(p));
    } else {
      return this._visible.except?.includes(p) || false;
    }
  }

  isVisible() {
    if (!this._ctx.player) throw Error('Cannot use isVisible outside of a player context');
    return this.isVisibleTo(this._ctx.player.position);
  }

  static hide<P extends Player, T extends GameElement<P>>(this: ElementClass<P, T>, ...attrs: (string & keyof T)[]): void {
    this.hiddenAttributes = attrs;
  }

  // unused?
  hidden(): this {
    return Object.create(
      Object.getPrototypeOf(this),
      Object.fromEntries(
        Object.entries(
          Object.getOwnPropertyDescriptors(this)).filter(
            ([attr]) => !(this.constructor as typeof GameElement<P>).hiddenAttributes.includes(attr)
          )
      )
    );
  }

  create<T extends GameElement<P>>(className: ElementClass<P, T>, name: string, attrs?: ElementAttributes<P, T>): T {
    if (this.game?.phase === 'started') throw Error('Board elements cannot be created once game has started.');
    const el = this.createElement(className, name, attrs);
    el._t.parent = this;
    if (this._t.order === 'stacking') {
      this._t.children.unshift(el);
    } else {
      this._t.children.push(el);
    }
    return el;
  }

  createMany<T extends GameElement<P>>(n: number, className: ElementClass<P, T>, name: string, attrs?: ElementAttributes<P, T>): ElementCollection<P, T> {
    return new ElementCollection<P, T>(...times(n, () => this.create(className, name, attrs)));
  }

  createElement<T extends GameElement<P>>(className: ElementClass<P, T>, name: string, attrs?: ElementAttributes<P, T>): T {
    if (!this._ctx.classRegistry.includes(className)) {
      // importing classes from webpack are not equivalent. this ensures(?) we are using the same classes
      const classNameBasedOnName = this._ctx.classRegistry.find(c => c.name === className.name) as ElementClass<P, T>;
      if (!classNameBasedOnName) throw Error(`No class found ${className.name}. Declare any classes in \`game.defineBoard\``);
      className = classNameBasedOnName;
    }
    const el = new className(this._ctx);
    el.game = this.game;
    el.board = this.board;
    el.name = name;
    Object.assign(el, attrs);
    return el;
  }

  branch() {
    const branches = [];
    let node = this as GameElement<P>;
    while (node._t.parent) {
      branches.unshift(node._t.parent._t.children.indexOf(node));
      node = node._t.parent;
    }
    branches.unshift(this._ctx.removed._t.children.indexOf(node) >= 0 ? 1 : 0);
    return branches.join("/");
  }

  atBranch(b: string) {
    let branch = b.split('/');
    let index = parseInt(branch[0]);
    let node = index === 0 ? this._ctx.top : this._ctx.removed._t.children[index - 1];
    branch.shift();
    while (branch[0] !== undefined) {
      node = node._t.children[parseInt(branch[0])];
      branch.shift();
    }
    return node;
  }

  atID(id: number): GameElement<P> | undefined {
    return this._t.children.find(c => c._t.id === id) || this._t.children.find(c => c.atID(id))?.atID(id)
  }

  isDescendantOf(el: GameElement<P>): boolean {
    return this._t.parent === el || !!this._t.parent?.isDescendantOf(el)
  }

  toJSON(seenBy?: number) {
    let attrs: Record<any, any>;
    let { _t, _ctx, _ui, game, board, ...rest } = this;
    if ('pile' in rest) delete rest.pile;
    if ('_eventHandlers' in rest) delete rest['_eventHandlers'];

    // remove methods
    rest = Object.fromEntries(Object.entries(rest).filter(
      ([, value]) => typeof value !== 'function'
    )) as typeof rest;

    // remove hidden attributes
    if (seenBy !== undefined && !this.isVisibleTo(seenBy)) {
      rest = Object.fromEntries(Object.entries(rest).filter(
        ([attr]) => !(this.constructor as typeof GameElement<P>).hiddenAttributes.includes(attr)
      )) as typeof rest;
    }

    attrs = rest;

    const json: ElementJSON = Object.assign(serializeObject(attrs, seenBy !== undefined), { className: this.constructor.name });
    if (seenBy === undefined || 'isSpace' in this) json._id = _t.id;
    if (_t.children.length) json.children = Array.from(_t.children.map(c => c.toJSON(seenBy)));
    if (_t.order) json.order = _t.order;
    if (_t.was) json.was = _t.was;
    return json;
  }

  createChildrenFromJSON(childrenJSON: ElementJSON[], branch: string) {
    // truncate non-spaces
    const spaces = this._t.children.filter(c => 'isSpace' in c);
    this._t.children = new ElementCollection();

    for (let i = 0; i !== childrenJSON.length; i++) {
      const json = childrenJSON[i];
      let { className, children, was, _id, name, order, ...rest } = json;
      if (this.game) rest = deserializeObject({...rest}, this.game);
      let child: GameElement<P> | undefined = undefined;
      if (_id !== undefined) { // try to match space, preserve the object and any references
        child = spaces.find(c => c._t.id === _id);
        if (child) {
          // reset all on child
          for (const key of Object.keys(child)) {
            if (!['_ctx', '_t', '_ui', '_eventHandlers', 'board', 'game', 'name'].includes(key) && !(key in rest))
              rest[key] = undefined;
          }
          Object.assign(child, rest);
        }
      }
      if (!child) {
        const elementClass = this._ctx.classRegistry.find(c => c.name === className);
        if (!elementClass) throw Error(`No class found ${className}. Declare any classes in \`game.defineBoard\``);
        child = this.createElement(elementClass, name, rest) as GameElement<P>;
        child.setId(_id);
        child._t.parent = this;
        child._t.order = order;
        child._t.was = was;
        if (this._ctx.trackMovement) child._t.was = branch + '/' + i;
      }
      this._t.children.push(child);
      child.createChildrenFromJSON(children || [], branch + '/' + i);
    };
  }

  /**
   * UI
   */

  _ui: ElementUI<P, GameElement<P>> = {
    layouts: [{
      applyTo: GameElement,
      attributes: {
        margin: 0,
        scaling: 'none',
        alignment: 'center',
        gap: 0,
        direction: 'square'
      }
    }],
    appearance: {},
  }

  // viewport relative to the board
  absoluteTransform(): Box {
    return this.board._ui.frame ? translate(this.relativeTransformToBoard(), this.board._ui.frame) : this.relativeTransformToBoard();
  }

  relativeTransformToBoard(): Box {
    let transform: Box = this._ui.computedStyle || { left: 0, top: 0, width: 100, height: 100 };
    let parent = this._t.parent;
    while (parent?._ui.computedStyle) {
      transform = translate(transform, parent._ui.computedStyle)
      parent = parent._t.parent;
    }
    return transform;
  }

  layout(applyTo: typeof this._ui.layouts[number]['applyTo'], attributes: Partial<typeof this._ui.layouts[number]['attributes']>) {
    const { area, margin, size, aspectRatio, scaling, gap, offsetColumn, offsetRow } = attributes;
    if (area && margin) console.warn('Both `area` and `margin` supplied in layout. `margin` is ignored');
    if (size && aspectRatio) console.warn('Both `size` and `aspectRatio` supplied in layout. `aspectRatio` is ignored');
    if (gap && (offsetColumn || offsetRow)) console.warn('Both `gap` and `offset` supplied in layout. `gap` is ignored');
    if (!size) {
      if (scaling === 'none' && aspectRatio) throw Error("Layout `scaling` must be 'fit' or 'fill' for `aspectRatio` and no `size`");
      if (!scaling) attributes.scaling = 'fit';
    }
    this._ui.layouts.push({ applyTo, attributes: Object.assign({ margin: 0, scaling: 'none', alignment: 'center', direction: 'square' }, attributes) });

    this._ui.layouts.sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (a.applyTo instanceof GameElement) aVal = 3
      if (b.applyTo instanceof GameElement) bVal = 3
      if (typeof a.applyTo === 'string') aVal = 2
      if (typeof b.applyTo === 'string') bVal = 2
      if (a.applyTo instanceof Array) aVal = 1
      if (b.applyTo instanceof Array) bVal = 1
      if (aVal !== 0 || bVal !== 0) return aVal - bVal;
      const ac = a.applyTo as ElementClass<P, any>;
      const bc = b.applyTo as ElementClass<P, any>;
      return ac.prototype instanceof bc ? 1 : (bc.prototype instanceof ac ? -1 : 0);
    });

    for (const child of this._t.children) child._ui.computedStyle = undefined;
    // TODO invalidate on children mutate
  }

  // recalc all elements computedStyle
  applyLayouts(force=false) {
    if (this._ui.appearance.render === false) return;

    if (!this._ui.computedStyle) {
      force = true;
      this._ui.computedStyle = { left: 0, top: 0, width: 100, height: 100 };
    }

    const layoutItems = this.getLayoutItems();
    const absoluteTransform = this.absoluteTransform();

    for (let l = this._ui.layouts.length - 1; l >= 0; l--) {
      const { attributes } = this._ui.layouts[l];
      let children = layoutItems[l];
      if (!children) continue;

      let cellBox: (n: number) => Box | undefined;
      let cell: ((n: number) => { row: number, column: number });

      const { slots, direction, gap, scaling, alignment, limit } = attributes;
      let { size, aspectRatio, offsetColumn, offsetRow, haphazardly } = attributes;
      const area = this.getArea(attributes);
      if (limit) children = children.slice(0, limit);

      if (slots) {
        cellBox = n => n < slots.length ? slots[n] : undefined
      } else {
        // calculate # of rows/cols
        const minRows = typeof attributes.rows === 'number' ? attributes.rows : attributes.rows?.min || 1;
        const minColumns = typeof attributes.columns === 'number' ? attributes.columns : attributes.columns?.min || 1;
        const maxRows = typeof attributes.rows === 'number' ? attributes.rows : attributes.rows?.max || Infinity;
        const maxColumns = typeof attributes.columns === 'number' ? attributes.columns : attributes.columns?.max || Infinity;
        let rows = minRows;
        let columns = minColumns;
        const alignOffset = {
          left: alignment.includes('left') ? 0 : (alignment.includes('right') ? 1 : 0.5),
          top: alignment.includes('top') ? 0 : (alignment.includes('bottom') ? 1 : 0.5),
        };

        // expand grid as needed in direction specified
        if (rows * columns < children.length) {
          if (['ltr', 'ltr-btt', 'rtl', 'rtl-btt'].includes(direction)) {
            columns = Math.max(columns, Math.min(maxColumns, Math.ceil(children.length / rows)));
            rows = Math.max(rows, Math.min(maxRows, Math.ceil(children.length / columns)));
          }
          if (['ttb', 'btt', 'ttb-rtl', 'btt-rtl'].includes(direction)) {
            rows = Math.max(rows, Math.min(maxRows, Math.ceil(children.length / columns)));
            columns = Math.max(columns, Math.min(maxColumns, Math.ceil(children.length / rows)));
          }
        }

        if (direction === 'ltr')
          cell = (n: number) => ({ column: n % columns, row: Math.floor(n / columns) });
        else if (direction === 'ltr-btt')
          cell = (n: number) => ({ column: n % columns, row: rows - 1 - Math.floor(n / columns) });
        else if (direction === 'rtl')
          cell = (n: number) => ({ column: columns - 1 - n % columns, row: Math.floor(n / columns) });
        else if (direction === 'rtl-btt')
          cell = (n: number) => ({ column: columns - 1 - n % columns, row: rows - 1 - Math.floor(n / columns) });
        else if (direction === 'ttb')
          cell = (n: number) => ({ column: Math.floor(n / rows), row: n % rows });
        else if (direction === 'btt')
          cell = (n: number) => ({ column: Math.floor(n / rows), row: rows - 1 - n % rows });
        else if (direction === 'ttb-rtl')
          cell = (n: number) => ({ column: columns - 1 - Math.floor(n / rows), row: n % rows });
        else if (direction === 'btt-rtl')
          cell = (n: number) => ({ column: columns - 1 - Math.floor(n / rows), row: rows - 1 - n % rows });
        else {
          // for square, expand/shrink grid as needed in either direction
          let vColumns = Math.ceil(Math.sqrt(children.length));
          let vRows = Math.ceil(children.length / vColumns);
          if (vColumns > maxColumns) {
            vColumns = maxColumns;
            vRows = Math.ceil(children.length / vColumns);
          }
          if (vRows > maxRows) {
            vRows = maxRows;
            vColumns = Math.min(maxColumns, Math.ceil(children.length / vRows));
          }
          if (vRows > rows) rows = vRows;
          if (vColumns > columns) columns = vColumns;

          // center used cells within the minimum grid, possibly using fractional row/col
          //console.log('virtual grid', vColumns, vRows, columns, rows);
          cell = n => ({
            column: (alignOffset.left === 1 ? vColumns - 1 - n % vColumns : n % vColumns) + alignOffset.left * (columns - vColumns),
            row: (alignOffset.top === 1 ? vRows - 1 - Math.floor(n / vColumns) : Math.floor(n / vColumns)) + alignOffset.top * (rows - vRows)
          });
        }

        // calculate offset or gap
        let cellGap: Vector | undefined = undefined;

        if (offsetColumn || offsetRow) {
          if (!offsetRow) offsetRow = { x: -offsetColumn!.y, y: offsetColumn!.x };
          if (!offsetColumn) offsetColumn = { x: offsetRow!.y, y: -offsetRow!.x };
        } else {
          // gaps are absolute and convert by ratio
          cellGap = {
            x: (gap && (typeof gap === 'number' ? gap : gap.x) || 0) / absoluteTransform.width * 100,
            y: (gap && (typeof gap === 'number' ? gap : gap.y) || 0) / absoluteTransform.height * 100,
          };
        }

        if (!size) {
          // start with largest size needed to accommodate
          size = cellSizeForArea(rows, columns, area, cellGap, offsetColumn, offsetRow);

          if (!aspectRatio) {
            // find all aspect ratios of child elements and choose best fit
            let minRatio = Infinity;
            let maxRatio = 0;
            for (const c of children) {
              const r = c._ui.appearance.aspectRatio;
              if (r !== undefined) {
                if (r < minRatio) minRatio = r;
                if (r > maxRatio) maxRatio = r;
              }
            }
            if (minRatio < Infinity || maxRatio > 0) {
              if (maxRatio > 1 && minRatio < 1) aspectRatio = 1;
              else if (minRatio > 1) aspectRatio = minRatio;
              else aspectRatio = maxRatio;
            }
          }

          if (aspectRatio) {
            aspectRatio *= absoluteTransform.height / absoluteTransform.width;
            if (aspectRatio > 1) {
              size.height = size.width / aspectRatio;
            } else {
              size.width = aspectRatio * size.height;
            }
          }
        }

        if (haphazardly) {
          haphazardly *= .2 + Math.max(0, cellGap ?
            cellGap.x / size.width + cellGap.y / size.height :
            (Math.abs(offsetColumn!.x) + Math.abs(offsetColumn!.y) + Math.abs(offsetRow!.y) + Math.abs(offsetColumn!.y) - 200) / 100);
        } else {
          haphazardly = 0;
        }
        //console.log('haphazardly', haphazardly);

        const startingOffset = {x: 0, y: 0};
        const cellBoxRC = ({ row, column }: { row: number, column: number }): Box | undefined => {
          //console.log('cell # ', n, row, column, size, area, cellGap);
          if (column > maxColumns || row > maxRows) return;

          return {
            left: area!.left + startingOffset.x + (
              cellGap ?
                column * (size!.width + cellGap!.x) :
                (size!.width * (column * offsetColumn!.x + row * offsetRow!.x)) / 100
            ),
            top: area!.top + startingOffset.y + (
              cellGap ?
                row * (size!.height + cellGap!.y) :
                (size!.height * (row * offsetRow!.y + column * offsetColumn!.y)) / 100
            ),
            width: size!.width,
            height: size!.height,
          }
        }

        // find the edge boxes and calculate the total size needed
        const getTotalArea = (): Box => {
          const boxes = [
            cellBoxRC({ row: 0, column: 0 })!,
            cellBoxRC({ row: rows - 1, column: 0 })!,
            cellBoxRC({ row: rows - 1, column: columns - 1 })!,
            cellBoxRC({ row: 0, column: columns - 1 })!,
          ];

          const cellArea = {
            top: Math.min(...boxes.map(b => b.top)),
            bottom: Math.max(...boxes.map(b => b.top + b.height)),
            left: Math.min(...boxes.map(b => b.left)),
            right: Math.max(...boxes.map(b => b.left + b.width)),
          };

          return {
            width: cellArea.right - cellArea.left,
            height: cellArea.bottom - cellArea.top,
            left: cellArea.left,
            top: cellArea.top
          }
        }
        let totalAreaNeeded = getTotalArea();

        //console.log('size, area', size, area, totalAreaNeeded)

        let scale: Vector = {x: 1, y: 1};

        if (scaling === 'fill') {
          // match the dimension furthest, spilling one dimesion out of bounds
          const s = Math.max(area.width / totalAreaNeeded.width, area.height / totalAreaNeeded.height);
          scale = {x: s, y: s};
        } else if (scaling === 'fit') {
          // match the closest dimension, pushing one dimesion inside
          const s = Math.min(area.width / totalAreaNeeded.width, area.height / totalAreaNeeded.height);
          scale = {x: s, y: s};
        }

        // bound by max size for min rows/cols
        const largestCellSize = cellSizeForArea(minRows, minColumns, area, cellGap, offsetColumn, offsetRow);

        if (size.width * scale.x > largestCellSize.width) {
          const reduction = largestCellSize.width / size.width / scale.x;
          scale.x *= reduction;
          scale.y *= reduction;
        }
        if (size.height * scale.y > largestCellSize.height) {
          const reduction = largestCellSize.height / size.height / scale.y;
          scale.x *= reduction;
          scale.y *= reduction;
        }

        size.width *= scale.x;
        size.height *= scale.y;

        if (!cellGap) { // non-othogonal grid
          if (scaling === 'fill') {
            // reduce offset along dimesion needed to squish
            if (area.width * scale.x / totalAreaNeeded.width > area.height * scale.y / totalAreaNeeded.height) {
              const offsetScale = (area.height - size.height) / (totalAreaNeeded.height * scale.y - size.height);
              if (offsetScale < 1) {
                scale.y = area.height / totalAreaNeeded.height;
                offsetColumn!.y *= offsetScale;
                offsetRow!.y *= offsetScale;
              }
            } else {
              const offsetScale = (area.width - size.width) / (totalAreaNeeded.width * scale.x - size.width);
              if (offsetScale < 1) {
                scale.x = area.width / totalAreaNeeded.width;
                offsetColumn!.x *= offsetScale;
                offsetRow!.x *= offsetScale;
              }
            }

            totalAreaNeeded = getTotalArea();
          }
          // align in reduced area
          startingOffset.x += area.left - totalAreaNeeded.left + alignOffset.left * (area.width - totalAreaNeeded.width);
          startingOffset.y += area.top - totalAreaNeeded.top + alignOffset.top * (area.height - totalAreaNeeded.height);

        } else { // orthogonal

          if (scaling === 'fill') {
            // reduce gap to squish it to fit, creating overlap
            if (rows > 1) cellGap.y = Math.min(cellGap.y || 0, (area.height - rows * size.height) / (rows - 1));
            if (columns > 1) cellGap.x = Math.min(cellGap.x || 0, (area.width - columns * size.width) / (columns - 1));
          }

          // center in reduced area
          const newWidth = columns * (size.width + cellGap.x!) - cellGap.x!;
          startingOffset.x += alignOffset.left * (area.width - newWidth);
          const newHeight = rows * (size.height + cellGap.y!) - cellGap.y!;
          startingOffset.y += alignOffset.top * (area.height - newHeight);
        }

        //console.log('size, area after fit/fill adj', size, area, scale, cellGap)
        cellBox = n => cellBoxRC(cell(n));
      }

      // apply the final box to each child
      const prandom = random.create('ge' + this.name).random;
      for (let i = 0; i !== children.length; i++) {
        const box = cellBox(i);
        if (!box) continue;
        const child = children[i];
        let aspectRatio = child._ui.appearance.aspectRatio;
        if (aspectRatio) aspectRatio *= absoluteTransform.height / absoluteTransform.width;

        let { width, height } = box;
        if (aspectRatio && aspectRatio !== width / height) {
          if (aspectRatio > width / height) {
            height = width / aspectRatio;
          } else {
            width = aspectRatio * height;
          }
        }
        let left = box.left + (box.width - width) / 2;
        let top = box.top + (box.height - height) / 2;
        if (haphazardly) {
          let wiggle = {x: 0, y: 0};
          let overlap = Infinity;
          for (let tries = 0; tries < 10; tries ++) {
            const rx = prandom();
            const ry = prandom();
            const w = {
              x: haphazardly ? Math.min(
                area.left + area.width - left - width,
                Math.max(area.left - left, (rx - ((left - area.left) / (area.width - width) - .5) / 2 - .5) * haphazardly * (size!.width + size!.height))
              ): 0,
              y: haphazardly ? Math.min(
                area.top + area.height - top - height,
                Math.max(area.top - top, (ry - ((top - area.top) / (area.height - height) - .5) / 2 - .5) * haphazardly * (size!.width + size!.height))
              ): 0
            }
            let worstOverlapThisTry = Infinity;
            if (children.every(c => {
              if (!c._ui.computedStyle) return true;
              const cbox = c._ui.computedStyle;
              const childOverlap = Math.min(
                Math.max(0, cbox.left + cbox.width - left - w.x),
                Math.max(0, cbox.top + cbox.height - top - w.y),
                Math.max(0, left + width + w.x - cbox.left),
                Math.max(0, top + height + w.y - cbox.top)
              );
              if (childOverlap === 0) return true;
              worstOverlapThisTry = Math.min(childOverlap, worstOverlapThisTry);
            })) {
              wiggle = w;
              break;
            }
            if (worstOverlapThisTry < overlap) {
              overlap = worstOverlapThisTry;
              wiggle = w;
            }
          }
          left += wiggle.x
          top += wiggle.y
        }
        child._ui.computedStyle = { width, height, left, top };

        child.applyLayouts(force);
      }
    }
  }

  getLayoutItems() {
    const layoutItems: GameElement<P>[][] = [];
    for (const child of this._t.children) {
      for (let l = this._ui.layouts.length - 1; l >= 0; l--) {
        const { applyTo } = this._ui.layouts[l];

        if ((typeof applyTo === 'function' && child instanceof applyTo) ||
          (typeof applyTo === 'string' && child.name === applyTo) ||
          child === applyTo ||
          (applyTo instanceof ElementCollection && applyTo.includes(child))) {

          layoutItems[l] = layoutItems[l] ? layoutItems[l].concat([child]) : [child];
          break;
        }
      }
    }
    return layoutItems;
  }

  // calculate working area
  getArea(attributes: { margin?: number | { top: number, bottom: number, left: number, right: number }, area?: Box }): Box {
    let { area, margin } = attributes;
    if (area) return area;
    if (!margin) return { left: 0, top: 0, width: 100, height: 100 };

    // margins are absolute, so translate
    const absoluteTransform = this.absoluteTransform();
    const transform: Vector = {
      x: absoluteTransform.width / 100,
      y: absoluteTransform.height / 100
    }

    if (typeof margin === 'number') margin = { left: margin, right: margin, top: margin, bottom: margin };
    margin.left /= transform.x;
    margin.right /= transform.x;
    margin.top /= transform.y;
    margin.bottom /= transform.y;

    return {
      left: margin.left,
      top: margin.top,
      width: 100 - margin.left - margin.right,
      height: 100 - margin.top - margin.bottom
    };
  }

  appearance(appearance: ElementUI<P, this>['appearance']) {
    Object.assign(this._ui.appearance, appearance);
  }

  getMoveTransform() {
    if (!this._ui.computedStyle || !this._t.was || this._t.was === this.branch()) return;
    const previousPosition = this.board._ui.previousStyles[this._t.was];
    if (!previousPosition) return;
    const newPosition = this.relativeTransformToBoard();
    return {
      scaleX: previousPosition.width / newPosition.width,
      scaleY: previousPosition.height / newPosition.height,
      translateX: (previousPosition.left - newPosition.left) / newPosition.width * 100,
      translateY: (previousPosition.top - newPosition.top) / newPosition.height * 100,
    };
  }

  doneMoving() {
    const branch = this.branch();
    this._t.was = branch;
    if (this._ui.computedStyle) {
      this.board._ui.previousStyles[branch] = this.relativeTransformToBoard();
    }
  }
}
