// import type GameManager from '../game-manager.js';
import { times } from '../utils.js';
export type Box = { left: number, top: number, width: number, height: number };
export type Vector = { x: number, y: number };
export type Direction = 'left' | 'right' | 'down' | 'up';
export type SingleArgument = string | number | boolean | GameElement | Player;
export type Argument = SingleArgument | SingleArgument[];
export type LayoutAttributes<T extends GameElement> = {
 margin?: number | { top: number, bottom: number, left: number, right: number },
  area?: Box,
  rows?: number | {min: number, max?: number} | {min?: number, max: number},
  columns?: number | {min: number, max?: number} | {min?: number, max: number},
  extensionMargin?: number,
  slots?: Box[],
  size?: { width: number, height: number },
  aspectRatio?: number, // w / h
  scaling?: 'fit' | 'fill'
  gap?: number | { x: number, y: number },
  alignment: 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'bottom left' | 'top right' | 'bottom right' | 'center',
  offsetColumn?: Vector | number,
  offsetRow?: Vector | number,
  direction: 'square' | 'ltr' | 'rtl' | 'rtl-btt' | 'ltr-btt' | 'ttb' | 'ttb-rtl' | 'btt' | 'btt-rtl',
  limit?: number,
  maxOverlap?: number,
  haphazardly?: number,
  sticky?: boolean,
  showBoundingBox?: string | boolean,
  drawer?: {
    closeDirection: Direction,
    tab: ((el: T) => React.ReactNode) | false,
    closedTab?: ((el: T) => React.ReactNode) | false,
    openIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
    closeIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
  }
};

export type ElementUI<T extends GameElement> = {
  layouts: {
    applyTo: ElementClass<GameElement<T['game']>> | GameElement | ElementCollection<GameElement> | string,
    attributes: LayoutAttributes<T>
  }[],
  appearance: {
    className?: string,
    render?: ((el: T) => JSX.Element | null) | false,
    aspectRatio?: number,
    effects?: { attributes: ElementAttributes<T>, name: string }[],
    info?: ((el: T) => JSX.Element | null | boolean) | boolean,
    connections?: {
      thickness?: number,
      style?: 'solid' | 'double',
      color?: string,
      fill?: string,
      label?: ({distance, to, from}: {distance: number, to: Space, from: Space }) => React.ReactNode,
      labelScale?: number,
    },
  },
  computedStyle?: Box,
  computedLayouts?: {
    area: Box,
    grid?: {
      anchor: Vector,
      origin: { column: number, row: number },
      columns: number,
      rows: number,
      offsetColumn: Vector,
      offsetRow: Vector,
    },
    showBoundingBox?: string | boolean,
    children: GameElement[],
    drawer: ElementUI<T>['layouts'][number]['attributes']['drawer']
  }[],
  ghost?: boolean,
};

export type ElementClass<T extends GameElement> = {
  new(ctx: ElementContext): T;
  isGameElement: boolean; // here to help enforce types
  // visibleAttributes?: string[];
}

export type ElementAttributes<T extends GameElement> =
  Partial<Pick<T, {[K in keyof T]: K extends keyof GameElement ? never : K}[keyof T]>>

export type ElementContext = {
  // gameManager: GameManager<B>;
  top: GameElement;
  namedSpaces: Record<string, Space>
  uniqueNames: Record<string, boolean>
  removed: GameElement;
  sequence: number;
  player?: Player;
  classRegistry: ElementClass<GameElement>[];
  moves: Record<string, string>;
  trackMovement: boolean;
};

export type ElementFinder<T extends GameElement = any> = (
  ((e: T) => boolean) |
    (ElementAttributes<T> & {mine?: boolean, empty?: boolean, adjacent?: boolean, withinDistance?: number}) |
    string
);

export type PlayerAttributes<T extends Player = Player> = {
  [
    K in keyof InstanceType<{new(...args: any[]): T}>
      as InstanceType<{new(...args: any[]): T}>[K] extends (...args: unknown[]) => unknown ? never : (K extends '_players' | 'game' | 'gameManager' ? never : K)
  ]: InstanceType<{new(...args: any[]): T}>[K]
}

class Player {
  name: string;
  game: Game
}

class PlayerCollection<P extends Player> extends Array<P> {
  game: Game
  className: {new(...a: any[]): P};
  addPlayer(attrs: any) {
    const player = new this.className(attrs);
    Object.assign(player, attrs, {_players: this});
    this.push(player);
    if (this.game) {
      player.game = this.game;
    }
  }
}

class GameElement<B extends Game = Game> {
  game: B
  _ctx: ElementContext;
  _t: {
    children: ElementCollection<GameElement>,
    parent?: GameElement,
    order?: 'normal' | 'stacking',
  }
  name: string;
  space: Space = new Space<B>({});
  static isGameElement = true;

  constructor(ctx: Partial<ElementContext>) {
    this._ctx = ctx as ElementContext;
    if (!ctx.top) {
      this._ctx.top = this;
      this._ctx.sequence = 0;
    }
    if (!this._ctx.namedSpaces) {
      this._ctx.uniqueNames = {};
      this._ctx.namedSpaces = {};
    }

    this._t = {
      children: new ElementCollection<GameElement>()
    }
  }

  create<T extends GameElement>(className: ElementClass<T>, name: string, attributes?: ElementAttributes<T>): T {
    // if (this._ctx.gameManager?.phase === 'started') throw Error('Game elements cannot be created once game has started.');
    const el = this.createElement(className, name, attributes);
    el._t.parent = this;
    if (this._t.order === 'stacking') {
      this._t.children.unshift(el);
    } else {
      this._t.children.push(el);
    }
    if ('isSpace' in el && name) {
      if (name in this._ctx.uniqueNames) { // no longer unique
        delete this._ctx.namedSpaces[name];
        this._ctx.uniqueNames[name] = false
      } else {
        this._ctx.namedSpaces[name] = el as unknown as Space<B>;
        this._ctx.uniqueNames[name] = true;
      }
    }
    return el;
  }

  createMany<T extends GameElement>(n: number, className: ElementClass<T>, name: string, attributes?: ElementAttributes<T> | ((n: number) => ElementAttributes<T>)): ElementCollection<T> {
    return new ElementCollection<T>(...times(n, i => this.create(className, name, typeof attributes === 'function' ? attributes(i) : attributes)));
  }

  createElement<T extends GameElement>(className: ElementClass<T>, name: string, attrs?: ElementAttributes<T>): T {
    if (!this._ctx.classRegistry.includes(className)) {
      const classNameBasedOnName = this._ctx.classRegistry.find(c => c.name === className.name) as ElementClass<T>;
      if (!classNameBasedOnName) throw Error(`No class found ${className.name}. Declare any classes in \`game.registerClasses\``);
      className = classNameBasedOnName;
    }
    const el = new className(this._ctx);
    el.game = this.game;
    el.name = name;
    new ElementCollection<Space<B>>();
    Object.assign(el, attrs);
    return el;
  }

  adjacencies<F extends GameElement<B>>(className: ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F>;
  adjacencies(className?: ElementFinder<GameElement<B>>, ...finders: ElementFinder<GameElement<B>>[]): ElementCollection<GameElement<B>>;
  adjacencies<F extends GameElement<B>>(className?: ElementFinder<F> | ElementClass<F>, ...finders: ElementFinder<F>[]): ElementCollection<F> | ElementCollection<GameElement<B>> {
    return new ElementCollection<Space<B>>();
  }

  _ui: ElementUI<this> = {
    layouts: [],
    appearance: {},
  };

  resetUI() {
    this._ui.layouts = [{
      applyTo: GameElement<B>,
      attributes: {
        margin: 0,
        scaling: 'fit',
        alignment: 'center',
        gap: 0,
        direction: 'square',
      }
    }];
    this._ui.appearance = {};
    this._ui.computedStyle = undefined;
    for (const child of this._t.children) child.resetUI();
  }
}

class Space<B extends Game = Game> extends GameElement<B> {
}

class Game<P extends Player = Player> extends Space {
  player: P
  pile: GameElement;
  players: PlayerCollection<P> = new PlayerCollection<P>;

  constructor() {
    super({});
  }
}

export default class ElementCollection<T extends GameElement> extends Array<T> {
}
