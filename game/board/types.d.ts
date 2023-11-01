import type { Board, GameElement, ElementCollection } from './'
import type { Player } from '../'
import type Game from '../game'
import type React from 'react';

export type ElementJSON = ({className: string, children?: ElementJSON[]} & Record<string, any>);

export type ElementClass<P extends Player, T extends GameElement<P>> = {
  new(ctx: Partial<ElementContext<P>>): T;
  isGameElement: boolean; // here to help enforce types
  hiddenAttributes: string[];
}

export type GameElementSerialization = 'player' | 'name'; // | 'uuid' | 'x' | 'y' | 'left' | 'right' | 'top' | 'bottom' | 'columns' | 'rows' | 'layout' | 'zoom' | 'minWidth' | 'minHeight';
// export type PieceSerialization = GameElementSerialization; // | 'cell';
// export type InteractivePieceSerialization = PieceSerialization; // | 'component';
// export type SpaceSerialization = GameElementSerialization; // | 'label';
// export type BaseType<T> = (T extends Board ? Board : (T extends Space ? Space : Piece));

/**
 * The attributes of this class that inherits GameElement, excluding ones from
 * the base GameElement, except `name` and `player`
 */
export type ElementAttributes<P extends Player, T extends GameElement<P>> =
  Partial<Pick<T, {[K in keyof T]: K extends keyof GameElement<P> ? never : (T[K] extends (...a:any[]) => any ? never : K)}[keyof T] | 'name' | 'player'>>

export type ElementContext<P extends Player> = {
  game: Game<P, Board<P>>;
  top: GameElement<P>;
  removed: GameElement<P>;
  sequence: number;
  player?: P;
  classRegistry: ElementClass<P, GameElement<P>>[];
  moves: Record<string, string>;
  trackMovement: boolean;
};

/**
 * A query filter can be one of 3 different forms:
 * - *string*: will match elements with this name
 * - *object*: will match elements whose properties match the provided
 *     properties. For example, `deck.all(Card, {suit: 'H'})` would match all
 *     `Card` elements in `deck` with a `suit` property equal to `"H"`. There are
 *     some special property names allowed here:
 *   - *mine*: true/false whether this element belongs to the player in whose context the query is made
 *   - *empty* true/false whether this element is empty
 *   - *adjacent* true/false whether this element is adjacent by a connection to the
 *       element on which the query method was
 *       called. E.g. `france.other(Country, {adjacent: true})` will match
 *       `Country` elements that are connected to `france` by {@link
 *       Space#connectTo}
 *   - *withinDistance* Similar to adjacent but uses the provided number to
 *       determine if a connection is possible between elements whose cost is
 *       not greater than the provided value
 * - *function*: A function that accept an element as its argument and returns a
 *     boolean indicating whether it is a match, similar to `Array#filter`.
 */
export type ElementFinder<P extends Player, T extends GameElement<P>> = (
  ((e: T) => boolean) |
    (ElementAttributes<P, T> & {mine?: boolean, empty?: boolean, adjacent?: boolean, withinDistance?: number}) |
    string
);

export type ElementEventHandler<P extends Player, T extends GameElement<P>> = {callback: (el: T) => void} & Record<any, any>;

export type Box = { left: number, top: number, width: number, height: number };
export type Vector = { x: number, y: number };

export type ElementUI<P extends Player, T extends GameElement<P>> = {
  layouts: {
    applyTo: ElementClass<P, GameElement<P>> | GameElement<P> | ElementCollection<P, GameElement<P>> | string,
    attributes: {
      margin?: number | { top: number, bottom: number, left: number, right: number },
      area?: Box,
      rows?: number | {min: number, max?: number} | {min?: number, max: number},
      columns?: number | {min: number, max?: number} | {min?: number, max: number},
      slots?: Box[],
      size?: { width: number, height: number },
      aspectRatio?: number, // w / h
      scaling: 'fit' | 'fill' | 'none'
      gap?: number | { x: number, y: number },
      alignment: 'top' | 'bottom' | 'left' | 'right' | 'top left' | 'bottom left' | 'top right' | 'bottom right' | 'center',
      offsetColumn?: Vector,
      offsetRow?: Vector,
      direction: 'square' | 'ltr' | 'rtl' | 'rtl-btt' | 'ltr-btt' | 'ttb' | 'ttb-rtl' | 'btt' | 'btt-rtl',
      limit?: number,
      haphazardly?: number,
    }
  }[],
  appearance: {
    className?: string,
    render?: ((el: T) => React.JSX.Element | null) | false,
    aspectRatio?: number,
    zoomable?: boolean | ((el: T) => boolean),
    connections?: {
      thickness?: number,
      style?: 'solid' | 'double',
      color?: string,
      fill?: string,
      label?: (arg: any) => React.JSX.Element | null,
      labelScale?: number,
    },
  },
  computedStyle?: Box,
}

type ActionLayout<P extends Player> = {
  element: GameElement<P> | (() => GameElement<P>),
  top?: number,
  bottom?: number,
  left?: number,
  right?: number,
  width?: number,
  height?: number
};
