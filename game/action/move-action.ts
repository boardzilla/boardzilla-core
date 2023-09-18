import Action from './action';
import Selection from './selection';

import { GameElement, Piece } from '../board';

import type {
  Argument,
  BoardSelection,
  BoardQuerySingle,
  SelectionDefinition
} from './types';

export default class MoveAction<P extends Piece, S extends GameElement> extends Action {
  constructor({piece, to, prompt, promptTo, move}: {
    piece: BoardQuerySingle<P> | BoardSelection<P>;
    to: BoardQuerySingle<S> | BoardSelection<S>;
    prompt: string;
    promptTo?: string;
    move?: (...a: Argument[]) => void;
  }) {
    let selections: SelectionDefinition[] = [];
    let movePiece: (...a: Argument[]) => void;

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
      movePiece = (to: S) => resolve(piece, [])!.putInto(to);
    }

    if (!noChoice(piece) && noChoice(to)) {
      selections = [{
        prompt: prompt,
        selectOnBoard: {
          chooseFrom: piece.chooseFrom,
        },
        clientContext: { drop: to }
      }];
      movePiece = (piece: P) => piece.putInto(resolve(to, [piece])!);
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
      movePiece = (piece: P, to: S) => piece.putInto(to);
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

const noChoice = (s: BoardQuerySingle<GameElement> | BoardSelection<GameElement>): s is BoardQuerySingle<GameElement> => {
  return typeof s !== 'object' || !('chooseFrom' in s);
}


const resolve = <T extends GameElement>(q: BoardQuerySingle<T>, ...args: Argument[]) => {
  if (typeof q === 'string') throw Error("not impl");
  return (typeof q === 'function') ? q(...args) : q;
}
