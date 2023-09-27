import Action from './action';
import type { Player } from '../player';

import { GameElement, Piece } from '../board';

import type {
  Argument,
  BoardSelection,
  BoardQuerySingle,
  SelectionDefinition
} from './types';

export default class MoveAction<P extends Player, E extends Piece<P>, S extends GameElement<P>> extends Action<P> {
  constructor({piece, to, prompt, promptTo, move}: {
    piece: BoardQuerySingle<P, E> | BoardSelection<P, E>;
    to: BoardQuerySingle<P, S> | BoardSelection<P, S>;
    prompt: string;
    promptTo?: string;
    move?: (...a: Argument<P>[]) => void;
  }) {
    let selections: SelectionDefinition<P>[] = [];
    let movePiece: (...a: Argument<P>[]) => void;

    if (noChoice(piece) && noChoice(to)) {
      movePiece = () => resolve(piece)!.putInto(resolve(to)!);
    }

    if (noChoice(piece) && !noChoice(to)) {
      selections = [{
        prompt: promptTo || prompt,
        selectOnBoard: {
          chooseFrom: to.chooseFrom,
        },
        clientContext: { drag: piece }
      }];
      movePiece = (to: S) => resolve(piece)!.putInto(to);
    }

    if (!noChoice(piece) && noChoice(to)) {
      selections = [{
        prompt: prompt,
        selectOnBoard: {
          chooseFrom: piece.chooseFrom,
        },
        clientContext: { drop: to }
      }];
      movePiece = (piece: E) => piece.putInto(resolve(to, [piece])!);
    }

    if (!noChoice(piece) && !noChoice(to)) {
      selections = [{
        prompt: prompt,
        selectOnBoard: {
          chooseFrom: piece.chooseFrom,
        },
        clientContext: { drag: piece }
      }, {
        prompt: promptTo || prompt,
        selectOnBoard: {
          chooseFrom: to.chooseFrom,
        },
        clientContext: { drop: to }
      }];
      movePiece = (piece: E, to: S) => piece.putInto(to);
    }

    super({
      prompt,
      selections,
      move: (...args: any[]) => {
        movePiece(...args);
        if (move) move(...args);
      }
    });
  }
}

const noChoice = <P extends Player>(s: BoardQuerySingle<P, GameElement<P>> | BoardSelection<P, GameElement<P>>): s is BoardQuerySingle<P, GameElement<P>> => {
  return typeof s !== 'object' || !('chooseFrom' in s);
}

const resolve = <P extends Player, T extends GameElement<P>>(q: BoardQuerySingle<P, T>, ...args: Argument<P>[]) => {
  if (typeof q === 'string') throw Error("not impl");
  return (typeof q === 'function') ? q(...args) : q;
}
