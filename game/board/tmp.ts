type GameElement = {
  isGameElement: true;
  name: string
}

type Player = {
  isPlayer: true;
}

type Space = GameElement & {
  isSpace: true;
}

type ElementAttributes<T extends GameElement> =
  Partial<Pick<T, {[K in keyof T]: K extends keyof GameElement ? never : (T[K] extends (...a:any[]) => any ? never : K)}[keyof T] | 'name'>>

  type b = Pick<GameElement, never | 'isGameElement'>
const bb:b = () => {}
  
const aa:ElementAttributes<GameElement> = {name: 'a'};

type a = {a?:1, c?:3} & {b?:2, d:4}

const ab:a = {a:1, b:2, d:4};

type ElementFinder<T extends GameElement> = (
  ((e: T) => boolean) |
    (ElementAttributes<T> & {mine?: boolean, adjacent?: boolean, withinDistance?: number}) |
    string
);

const ef:ElementFinder<Space> = {adjacent: true};
