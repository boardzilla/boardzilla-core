import { GameElement, ElementCollection } from './';

import type { Player } from '../player';
import { Board, Piece, Space } from '../';

export const boardClasses = <P extends Player>() => ({
  Board: Board<P>,
  Space: Space<P>,
  Piece: Piece<P>
});

export function union<P extends Player>(...queries: (GameElement<P> | ElementCollection<P, GameElement<P>> | undefined)[]): ElementCollection<P, GameElement<P>> {
  let c = new ElementCollection<P, GameElement<P>>();
  for (const q of queries) {
    if (q) {
      if ('forEach' in q) {
        q.forEach(e => c.push(e));
      } else {
        c.push(q);
      }
    }
  };
  return c;
}
