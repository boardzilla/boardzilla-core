import { GameElement, ElementCollection } from './';

export function union(...queries: (GameElement | ElementCollection<GameElement> | undefined)[]): ElementCollection<GameElement> {
  let c = new ElementCollection<GameElement>();
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
