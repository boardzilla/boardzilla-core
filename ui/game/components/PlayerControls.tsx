import React, { useCallback, useMemo } from 'react';
import { gameStore } from '../../';
import { humanizeArg } from '../../../game/action';
import { serializeArg, deserializeArg } from '../../../game/action/utils';

import type { Player } from '../../../game/player';
import type { GameElement } from '../../../game/board';
import type {
  Argument,
  SerializedArg,
  PendingMove
} from '../../../game/action/types';

const PlayerControls = ({onSubmit, disambiguateElement}: {
  onSubmit: (move?: PendingMove<Player>, value?: Argument<Player>) => void,
  disambiguateElement?: { element: GameElement<Player>, moves: PendingMove<Player>[] }; // element selected has multiple moves
}) => {
  const [game, position, move, selected, step, moves, prompt] = gameStore(s => [s.game, s.position, s.move, s.selected, s.step, s.pendingMoves, s.prompt]);
  console.log('render PlayerControls', moves, move);

  const onSubmitForm = useCallback((e: React.FormEvent<HTMLFormElement>, pendingMove: PendingMove<Player>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form) throw Error("No form in submit");
    let arg: Argument<Player> | undefined = undefined;
    if (pendingMove.selection?.type === 'board' && pendingMove.selection.isMulti()) {
      arg = selected;
    } else if (pendingMove.selection?.type === 'board' && disambiguateElement) {
      arg = selected[0];
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
  }, [onSubmit, game])

  const controls = useMemo(() => {
    const layouts: Record<string, {moves: PendingMove<Player>[], style: React.CSSProperties}> = {};
    const messages: (PendingMove<Player> | string)[] = moves || [];

    if (!position || !game.players.currentPosition.includes(position)) messages.push('out-of-turn');

    if (disambiguateElement) {
      const elementPosition = disambiguateElement.element.relativeTransformToBoard();
      const style: React.CSSProperties = {};
      if (elementPosition.left > 100 - elementPosition.left - elementPosition.width) {
        style.right = `calc(${100 - elementPosition.left}% + 1rem)`;
      } else {
        style.left = `calc(${elementPosition.left + elementPosition.width}% + 1rem)`;
      }
      style.top = `${elementPosition.top}%`;
      layouts['disambiguate-board-selection'] = { moves: disambiguateElement.moves, style };
    } else {
      for (const pendingMove of messages) {
        if (!move && typeof pendingMove === 'object' && pendingMove.action.slice(0, 4) === '_god') continue; // don't need to display these as top-level choices
        let layoutName = "";
        const actionLayout = typeof pendingMove === 'object' ? "action:" + pendingMove.action : undefined;
        const stepLayout = 'step:' + (typeof pendingMove === 'string' ? pendingMove : step);
        if (actionLayout && game.board._ui.stepLayouts[actionLayout]) {
          layoutName = actionLayout;
        } else if (stepLayout && game.board._ui.stepLayouts[stepLayout]) {
          layoutName = stepLayout;
        }

        if (layoutName) {
          const existing = layouts[layoutName];
          if (existing) {
            if (typeof pendingMove === 'object') existing.moves.push(pendingMove);
          } else {
            let style: React.CSSProperties = { left: 0, top: 0 };
            const layout = game.board._ui.stepLayouts[layoutName];
            const position = (typeof layout.element === 'function' ? layout.element() : layout.element)._ui.computedStyle;
            if (position) style = {
              left: layout.left !== undefined ? (layout.left * position.width / 100) + position.left + '%' : undefined,
              top: layout.top !== undefined ? (layout.top * position.height / 100) + position.top + '%' : undefined,
              right: layout.right !== undefined ? 100 + ((layout.right * position.width / 100) - position.left - position.width) + '%' : undefined,
              bottom: layout.bottom !== undefined ? 100 + ((layout.bottom * position.height / 100) - position.top - position.height) + '%' : undefined,
              width: layout.width !== undefined ? (layout.width * position.width / 100) + '%' : undefined,
              height: layout.height !== undefined ? (layout.height * position.height / 100) + '%' : undefined,
            }
            layouts[layoutName] = {moves: typeof pendingMove === 'object' ? [pendingMove] : [], style};
          }
        }
      }
    }
    return layouts;
  }, [game, moves, move, position, disambiguateElement]); // TODO check this works: game.players.currentPosition so the out of turn can move?

  if (!position) return null;

  return Object.entries(controls).map(([layoutName, {moves, style}]) => {
    const boardPrompts = moves.map(m => m.selection.type === 'board' ? m.selection.prompt : undefined).filter(p => p);
    const boardPrompt = new Set(boardPrompts).size === 1 ? boardPrompts[0] : prompt;
    const boardID = boardPrompt ? moves.find(m => m.selection.prompt === boardPrompt)?.action : '';

    return (
      <div key={layoutName} className={`player-controls ${layoutName.replace(":", "-")}`} style={style}>
        {layoutName === 'step:out-of-turn' && (
          `${game.players.current().map(p => p.name).join(' ,')} is taking their turn`
        )}
        {boardPrompt && <div id={boardID} className="prompt">{boardPrompt}</div>}
        {moves.map(pendingMove => (
          <form key={pendingMove.action + pendingMove.selection.prompt} id={pendingMove.action} onSubmit={e => onSubmitForm(e, pendingMove)}>
            <div>
              {pendingMove.selection.type === 'choices' && pendingMove.selection.choices && (
                <>
                  <div className="prompt">{pendingMove.selection.prompt}</div>
                  {(pendingMove.selection.choices instanceof Array ?
                    pendingMove.selection.choices.map(c => ([c, c])) :
                    Object.entries(pendingMove.selection.choices)).map(([k, v]) => (
                      <button key={String(serializeArg(k))} type="submit" name="selection" value={String(serializeArg(k))}>
                        {humanizeArg(v)}
                      </button>
                    ))
                  }
                </>
              )}

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

              {pendingMove.selection.type === 'board' &&
                (pendingMove.selection.isMulti()) &&
                (selected.length >= (pendingMove.selection.min ?? 1) && selected.length <= (pendingMove.selection.max ?? Infinity)) && (
                  <button type="submit">Done</button>
                )
              }

              {pendingMove.selection.type === 'board' && layoutName === 'disambiguate-board-selection' && (
                <button type="submit">{pendingMove.selection.prompt}</button>
              )}
            </div>
          </form>
        ))}

        {(move || layoutName === 'disambiguate-board-selection') && (
          <>
            <button onClick={() => onSubmit()}>Cancel</button>
          </>
        )}
      </div>
    )
  });
};

export default PlayerControls;
