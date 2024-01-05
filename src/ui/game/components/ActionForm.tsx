import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { gameStore } from '../../index.js';
import { n } from '../../../utils.js';
import Selection from './Selection.js';

import type { Player } from '../../../player/index.js';
import type { UIMove } from '../../index.js';
import type { Argument } from '../../../action/action.js';
import type { ResolvedSelection } from '../../../action/selection.js';

const ActionForm = ({ move, stepName, onSubmit, children }: {
  move: UIMove,
  stepName: string,
  onSubmit: (move?: UIMove, args?: Record<string, Argument<Player>>) => void,
  children?: React.ReactNode,
}) => {
  const [selected] = gameStore(s => [s.selected]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const initial = useCallback(() => {
    const args: Record<string, Argument<Player> | undefined> = {...move.args};
    for (const s of move.selections) {
      if (s.name !== '__action__' && s.name !== '__confirm__' && !s.isBoardChoice()) args[s.name] = s.initial;
    }
    return args;
  }, [move]);

  const [args, setArgs] = useState<Record<string, Argument<Player> | undefined>>(initial());

  useEffect(() => setArgs(initial()), [initial, move]);

  const allArgs = useMemo(() => {
    const args2 = {...move.args, ...args};
    for (const s of move.selections) {
      if (s.type === 'board') {
        args2[s.name] = s.isMulti() ? selected : selected[0];
        break
      }
    }
    return args2;
  }, [args, move, selected]);

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
          args[s.name] === undefined ? 'Missing' : s.error(args as Record<string, Argument<Player>>)
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
    if (validate(allArgs)) submitForm(allArgs);
    setArgs(initial());
  }, [allArgs, validate, submitForm, initial])

  const handleChange = useCallback((name: string, arg: Argument<Player>) => {
    let newArgs = allArgs;
    if (name !== '__action__' && name !== '__confirm__') newArgs[name] = arg;

    if (Object.values(allArgs).every(a => a !== undefined)) {
      if (validate(newArgs) && !move.requireExplicitSubmit) return submitForm(allArgs);
    } else {
      setErrors({});
    }
    setArgs(a => ({...a, [name]: arg}));
  }, [allArgs, validate, submitForm, move]);

  const confirm = useMemo(() => {
    if (Object.values(validationErrors(allArgs)).some(e => e)) return undefined;
    if (!move.requireExplicitSubmit) return undefined;
    if (Object.values(allArgs).some(a => a === undefined)) return undefined;
    for (const s of move.selections) {
      if (s.type === 'board' && s.isMulti() && (selected.length < (s.min ?? 1) || selected.length > (s.max ?? Infinity))) return undefined;
    }

    let confirm = 'Confirm';
    const args: Record<string, Argument<Player>> = Object.fromEntries(Object.entries(allArgs).filter(([_, v]) => v !== undefined)) as Record<string, Argument<Player>>;
    if (move.selections[0]?.confirm) {
      confirm = move.selections[0].confirm[0];
      Object.assign(args, typeof move.selections[0].confirm[1] === 'function' ? move.selections[0].confirm[1](args) : move.selections[0].confirm[1])
    }
    return n(confirm, args)
  }, [move, allArgs, selected, validationErrors]);

  return (
    <form
      id={move.name}
      onSubmit={e => onSubmitForm(e)}
      className={`action ${move.name}`}
    >
      {children && <span className="prompt">{children}</span>}

      {move.selections.filter(s => s.name !== '__confirm__').map((s: ResolvedSelection<Player>) => (
        <Selection
          key={s.name}
          value={allArgs[s.name]}
          error={errors[s.name]}
          onChange={(value: Argument<Player>) => handleChange(s.name, value)}
          selection={s}
        />
      ))}

      {(confirm || stepName === 'disambiguate-board-selection') && (
        <button name="submit" type="submit">{confirm ?? move.prompt}</button>
      )}
    </form>
  );
};

export default ActionForm;
