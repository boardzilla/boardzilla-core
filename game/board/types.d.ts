import type { GameElement } from './'
import type { Player } from '../'

export type ElementJSON = ({className: string, children?: ElementJSON[]} & Record<string, any>);

export type ElementClass<P extends Player, T extends GameElement<P>> = {
  new(ctx: Partial<ElementContext<P>>): T;
  isGameElement: boolean; // here to help enforce types
} & Record<any, any>

export type GameElementSerialization = 'player' | 'name'; // | 'uuid' | 'x' | 'y' | 'left' | 'right' | 'top' | 'bottom' | 'columns' | 'rows' | 'layout' | 'zoom' | 'minWidth' | 'minHeight';
// export type PieceSerialization = GameElementSerialization; // | 'cell';
// export type InteractivePieceSerialization = PieceSerialization; // | 'component';
// export type SpaceSerialization = GameElementSerialization; // | 'label';
// export type BaseType<T> = (T extends Board ? Board : (T extends Space ? Space : Piece));

export type ElementAttributes<P extends Player, T extends GameElement<P>> =
  Partial<Pick<T, {[K in keyof T]: K extends keyof GameElement<P> ? never : (T[K] extends (...a:any[]) => any ? never : K)}[keyof T] | 'name' | 'player'>>

export type ElementContext<P extends Player> = {
  top: GameElement<P>;
  removed: GameElement<P>;
  sequence: number;
  player?: P;
  classRegistry: ElementClass<P, GameElement<P>>[];
} & Record<string, any>;

export type ElementFinder<P extends Player, T extends GameElement<P>> = (
  ((e: T) => boolean) |
    (ElementAttributes<P, T> & {mine?: boolean, empty?: boolean, adjacent?: boolean, withinDistance?: number}) |
    string
);

export type ElementEventHandler<P extends Player, T extends GameElement<P>> = {callback: (el: T) => void} & Record<any, any>;

export type Box = { left: number, top: number, width: number, height: number };
export type Vector = { x: number, y: number };
