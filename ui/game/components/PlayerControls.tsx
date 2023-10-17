import React from 'react';
import { gameStore } from '../../';
import { humanizeArg } from '../../../game/action';
import { serializeArg, deserializeArg } from '../../../game/action/utils';

import type { Player } from '../../../game/player';
import type {
  Argument,
  SerializedArg,
  PendingMove
} from '../../../game/action/types';

const PlayerControls = ({onSubmit}: { onSubmit: (move?: PendingMove<Player>, value?: Argument<Player>) => void }) => {
  const [game, position, move, selected, pendingMoves, prompt] = gameStore(s => [s.game, s.position, s.move, s.selected, s.pendingMoves, s.prompt]);
  console.log('render PlayerControls', pendingMoves);

  if (!game || !position) return null;
  const player = game.players.atPosition(position);
  if (!player) return null;

  if (game.players.currentPosition && game.players.current() != player) {
    return <div className="prompt">{`Not my turn, waiting for ${game.players.current()!.name}`}</div>;
  }

  if (!pendingMoves?.length) return null;

  const onSubmitForm = (e: React.FormEvent<HTMLFormElement>, pendingMove: PendingMove<Player>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form) throw Error("No form in submit");
    let arg: Argument<Player> | undefined = undefined;
    if (pendingMove.selection?.type === 'board' && (pendingMove.selection.min !== undefined || pendingMove.selection.max !== undefined)) {
      arg = selected;
    } else if (pendingMove.selection?.type === 'button') {
      arg = pendingMove.selection.value;
    } else {
      const value = new FormData(form, (e.nativeEvent as SubmitEvent).submitter).get('selection')?.toString();
      if (value) {
        arg = value;
        if (pendingMove.selection?.type === 'number') arg = parseInt(arg.toString());
        if (pendingMove.selection?.type === 'choices') arg = deserializeArg(arg as SerializedArg, game);
      }
    }
    onSubmit(pendingMove, arg);
  }

  const boardPrompts = pendingMoves.map(m => m.selection.type === 'board' ? m.selection.prompt : undefined).filter(p => p);
  const boardPrompt = new Set(boardPrompts).size === 1 ? boardPrompts[0] : prompt;

  return (
    <div>
      <div className="prompt">{boardPrompt}</div>
      {pendingMoves.map(pendingMove => (
        <form key={pendingMove.action} id={pendingMove.action} onSubmit={e => onSubmitForm(e, pendingMove)}>
          <div>
            {pendingMove.selection.type === 'choices' && pendingMove.selection.choices && <>{
              (pendingMove.selection.choices instanceof Array ?
               pendingMove.selection.choices.map(c => ([c, c])) :
               Object.entries(pendingMove.selection.choices)).map(([k, v]) => (
                 <button key={String(serializeArg(k))} type="submit" name="selection" value={String(serializeArg(k))}>
                   {humanizeArg(v)}
                 </button>
               ))
            }</>}

            {pendingMove.selection.type === 'number' && (
              <>
                <input
                  name="selection"
                  type="number"
                  min={pendingMove.selection.min}
                  max={pendingMove.selection.max}
                  defaultValue={String(pendingMove.selection.initial || '')}
                  autoComplete='off'
                />
                <button type="submit">{pendingMove.selection.prompt}</button>
              </>
            )}

            {pendingMove.selection.type === 'text' && (
              <>
                <input name="selection" defaultValue={String(pendingMove.selection.initial || '')} autoComplete='off'/>
                <button type="submit">{pendingMove.selection.prompt}</button>
              </>
            )}

            {pendingMove.selection.type === 'button' && <button name="selection" value='confirm' type="submit">{pendingMove.selection.prompt}</button>}

            {pendingMove.selection.type === 'board' && (pendingMove.selection.min !== undefined || pendingMove.selection.max !== undefined) && (
              <button type="submit">{pendingMove.selection.prompt}</button>
            )}

            {move && (
              <>
                <button onClick={() => onSubmit()}>Cancel</button>
              </>
            )}
          </div>
        </form>
      ))}
    </div>
  );
};

export default PlayerControls;
