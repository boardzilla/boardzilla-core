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

const PlayerControls = ({move, error, selection, onSubmit}: {
  move?: IncompleteMove<Player>;
  error?: string;
  selection?: ResolvedSelection;
  onSubmit: (move?: IncompleteMove<Player>) => void;
}) => {
  const [game, player, selected] = gameStore(s => [s.game, s.player, s.selected, s.boardJSON]);
  console.log('render PlayerControls');

  if (!game || !player) return null;

  if (game.players.currentPosition && game.players.current() != player) {
    return <div>{`Not my turn, waiting for ${game.players.current()!.name}`}</div>;
  }

  if (!selection) return null;

  const onSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form) throw Error("No form in submit");
    if (!selection) throw Error("Submitted without a selection");
    let arg: Argument | undefined = undefined;
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
               <button key={serializeArg(k)} type="submit" name="selection" value={serializeArg(k)}>
                 {humanizeArg(v)}
               </button>
             ))
          }</>}

          {selection?.type === 'number' && (
            <>
              <input name="selection" type="number" min={selection.min} max={selection.max} />
              <button type="submit">Submit</button>
            </>
          )}

          {selection?.type === 'text' && (
            <>
              <input name="selection" />
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
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default PlayerControls;
