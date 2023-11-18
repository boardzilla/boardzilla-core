import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { gameStore } from '../../index.js';
import Selection from './Selection.js';

import type { Player } from '../../../player/index.js';
import type { PendingMove } from '../../../game.js';
import type { Argument } from '../../../action/action.js';
import type { ResolvedSelection } from '../../../action/selection.js';

const ActionForm = ({ move, stepName, onSubmit }: {
  move: PendingMove<Player>,
  stepName: string,
  onSubmit: (move?: PendingMove<Player>, args?: Record<string, Argument<Player>>) => void,
}) => {
  const [pendingMove, selected] = gameStore(s => [s.move, s.selected]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const initial = useCallback(() => {
    const args: Record<string, Argument<Player> | undefined> = {...move.args};
    for (const s of move.selections) {
      if (s.name !== '__action__' && s.name !== '__confirm__') args[s.name] = s.initial;
    }
    return args;
  }, [move]);

  const [args, setArgs] = useState<Record<string, Argument<Player> | undefined>>(initial());

  useEffect(() => setArgs(initial()), [initial, move]);

  useEffect(() => {
    for (const s of move.selections) {
      if (s.type === 'board') {
        setArgs(a => ({...a, [s.name]: s.isMulti() ? selected : selected[0]}));
      }
    }
  }, [move, selected]);


  const submitForm = useCallback((args: Record<string, Argument<Player> | undefined>) => {
    onSubmit(move, args as Record<string, Argument<Player>>);
    setArgs(initial());
    setErrors({});
  }, [onSubmit, initial, move])

  // return set of errors per selection from validation rules
  const validationErrors = useCallback((args: Record<string, Argument<Player> | undefined>) => {
    return Object.fromEntries(
      move.selections.filter(
        s => s.name !== '__action__' && s.name !== '__confirm__'
      ).map(
        s => [
          s.name,
          args[s.name] === undefined ? 'Missing' : s.validate(args as Record<string, Argument<Player>>)
        ]
      )
    );
  }, [move.selections]);

  // display errors
  const validate = useCallback((args: Record<string, Argument<Player> | undefined>) => {
    const errors = validationErrors(args);
    setErrors(errors);

    return Object.values(errors).every(e => !e);
  }, [validationErrors]);

  const onSubmitForm = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validate(args)) submitForm(args);
    setArgs(initial());
  }, [args, validate, submitForm, initial])

  const singleSubmit = useMemo(() => (
    move.selections.length === 1 && (['board', 'choices', 'button'].includes(move.selections[0].type)) && !move.selections[0].confirm && !move.selections[0].isMulti()
  ), [move]);

  const handleChange = useCallback((name: string, arg: Argument<Player>) => {
    let newArgs = args;
    if (name !== '__action__' && name !== '__confirm__') newArgs[name] = arg;

    if (Object.values(args).every(a => a !== undefined)) {
      if (validate(newArgs) && singleSubmit) return submitForm(args);
    } else {
      setErrors({});
    }
    setArgs(a => ({...a, [name]: arg}));
  }, [args, validate, submitForm, singleSubmit]);

  const confirm = useMemo(() => {
    if (Object.values(validationErrors(args)).some(e => e)) return undefined;
    if (singleSubmit) return undefined;
    if (Object.values(args).some(a => a === undefined)) return undefined;
    for (const s of move.selections) {
      if (s.type === 'board' && s.isMulti() && (selected.length < (s.min ?? 1) || selected.length > (s.max ?? Infinity))) return undefined;
    }

    return move.selections[0].confirm ? (
      typeof move.selections[0].confirm === 'function' ?
        move.selections[0].confirm(args as Record<string, Argument<Player>>) :
        move.selections[0].confirm
    ) : 'Confirm';
  }, [move, args, singleSubmit, selected, validationErrors]);

  return (
    <form
      id={move.action}
      onSubmit={e => onSubmitForm(e)}
      className={`action ${move.action}`}
    >
      {move.prompt && move.selections.some(s => s.type !== 'board') && <span className="prompt">{move.prompt}</span>}

      {move.selections.map((s: ResolvedSelection<Player>) => (
        <Selection
          key={s.name}
          value={args[s.name]}
          error={errors[s.name]}
          onChange={(value: Argument<Player>) => handleChange(s.name, value)}
          selection={s}
        />
      ))}

      {stepName === 'disambiguate-board-selection' && (
        <button type="submit">{move.prompt}</button>
      )}

      {confirm && <button name="submit" type="submit">{confirm}</button>}
      {(pendingMove || selected.length > 0) && stepName !== 'disambiguate-board-selection' && <button onClick={() => onSubmit()}>Cancel</button>}
    </form>
  );
};

export default ActionForm;
