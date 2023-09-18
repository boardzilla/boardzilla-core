import type { Board, Space, Piece, GameElement } from './'
import type { Player } from '../'
import type { Game } from '../'

type ElementJSON = ({className: string, children?: ElementJSON[]} & Record<any, any>);

type ElementClass<T extends GameElement> = {
  new(ctx: Partial<ElementContext>): T;
  isGameElement: boolean;
} & Record<any, any>

export type GameElementSerialization = 'player' | 'name'; // | 'uuid' | 'x' | 'y' | 'left' | 'right' | 'top' | 'bottom' | 'columns' | 'rows' | 'layout' | 'zoom' | 'minWidth' | 'minHeight';
// export type PieceSerialization = GameElementSerialization; // | 'cell';
// export type InteractivePieceSerialization = PieceSerialization; // | 'component';
// export type SpaceSerialization = GameElementSerialization; // | 'label';
export type BaseType<T> = (T extends Board ? Board : (T extends Space ? Space : Piece));

type ElementAttributes<T extends GameElement> =
  Partial<Pick<T, {[K in keyof T]: K extends keyof GameElement ? never : (T[K] extends (...a:any[]) => any ? never : K)}[keyof T] | 'name' | 'player'>>

type ElementContext = {
  top: GameElement;
  removed: GameElement;
  sequence: number;
  player?: Player;
  classRegistry: ElementClass<GameElement>[];
  game?: Game<Player, Board>;
} & Record<string, any>;

type ElementFinder<T extends GameElement> = (
  ((e: T) => boolean) |
    (ElementAttributes<T> & {mine?: boolean, adjacent?: boolean, withinDistance?: number}) |
    string
);

type ElementEventHandler<T extends GameElement> = {callback: (el: T) => void} & Record<any, any>;
