import React from 'react';
import { gameStore } from '../../';
import { humanizeArg } from '../../../game/action';
import { serializeArg, deserializeArg } from '../../../game/action/utils';

import type { Player } from '../../../game/player';
import type {
  ResolvedSelection,
  Argument,
  SerializedArg,
  IncompleteMove
} from '../../../game/action/types';

const PlayerControls = ({move, selection, onSubmit}: {
  move?: IncompleteMove<Player>;
  selection?: ResolvedSelection<Player>;
  onSubmit: (move?: IncompleteMove<Player>) => void;
}) => {
  const [game, position, selected] = gameStore(s => [s.game, s.position, s.selected, s.boardJSON]);
  console.log('render PlayerControls');

  if (!game || !position) return null;
  const player = game.players.atPosition(position);
  if (!player) return null;

  if (game.players.currentPosition && game.players.current() != player) {
    return <div>{`Not my turn, waiting for ${game.players.current()!.name}`}</div>;
  }

  if (!selection) return null;

  const onSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form) throw Error("No form in submit");
    if (!selection) throw Error("Submitted without a selection");
    let arg: Argument<Player> | undefined = undefined;
    if (selection?.type === 'board' && (selection.min !== undefined || selection.max !== undefined)) {
      arg = selected;
    } else {
      const value = new FormData(form, (e.nativeEvent as SubmitEvent).submitter).get('selection')?.toString();
      if (value) {
        arg = value;
        if (selection.type === 'number') arg = parseInt(arg.toString());
        if (selection.type === 'choices') arg = deserializeArg(arg as SerializedArg, game);
      }
    }
    if (arg) {
      if (move?.action) {
        move.args.push(arg);
      } else {
        move = {
          action: arg.toString(),
          args: [],
          player: player!
        }
      }
    }
    onSubmit(move);
  }

  return (
    <div id="player-controls">
      {selection?.prompt}
      
      <form onSubmit={onSubmitForm}>
        <div>
          {selection?.type === 'choices' && <>{
            (selection.choices instanceof Array ?
             selection.choices.map(c => ([c, c])) :
             Object.entries(selection.choices)).map(([k,v]) => (
               <button key={String(serializeArg(k))} type="submit" name="selection" value={String(serializeArg(k))}>
                 {humanizeArg(v)}
               </button>
             ))
          }</>}

          {selection?.type === 'number' && (
            <>
              <input
                name="selection"
                type="number"
                min={selection.min}
                max={selection.max}
                defaultValue={selection.default === undefined ? "" : String(selection.default)}
              />
              <button type="submit">Submit</button>
            </>
          )}

          {selection?.type === 'text' && (
            <>
              <input name="selection" defaultValue={selection.default === undefined ? "" : String(selection.default)}/>
              <button type="submit">Submit</button>
            </>
          )}

          {selection?.type === 'button' && <button name="selection" value="confirm" type="submit">Submit</button>}

          {selection?.type === 'board' && (selection.min !== undefined || selection.max !== undefined) && (
            <button type="submit">Confirm</button>
          )}

          {move && (
            <>
              <button onClick={() => onSubmit()}>Cancel</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default PlayerControls;
