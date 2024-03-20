import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { gameStore } from '../../index.js';
import { n } from '../../../utils.js';
import Selection from './Selection.js';

import type { Player } from '../../../player/index.js';
import type { UIMove } from '../../lib.js';
import type { Argument } from '../../../action/action.js';

const ActionForm = ({ move, stepName, onSubmit }: {
  move: UIMove,
  stepName: string,
  onSubmit: (move?: UIMove, args?: Record<string, Argument<Player>>) => void,
  children?: React.ReactNode,
}) => {
  const [gameManager, position, uncommittedArgs, selected, disambiguateElement] = gameStore(s => [s.gameManager, s.position, s.uncommittedArgs, s.selected, s.disambiguateElement]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const action = useMemo(() => move.name === '__pass__' ? undefined : gameManager.getAction(move.name, gameManager.players.atPosition(position!)!), [gameManager, position, move]);

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
    const allArgs = {...uncommittedArgs, ...args};
    // provisionally consider the ambiguous board selection as part of this move for confirmation/validation
    if (disambiguateElement && disambiguateElement.moves.includes(move)) {
      const selection = move.selections[0];
      if (selection.type === 'board') {
        allArgs[move.selections[0].name] = selection.isMulti() ? selected : selected?.[0];
      }
    }
    return allArgs;
  }, [args, move, selected, uncommittedArgs, disambiguateElement]);

  const submitForm = useCallback((args: Record<string, Argument<Player> | undefined>) => {
    onSubmit(move, args as Record<string, Argument<Player>>);
    setArgs(initial());
    setErrors({});
  }, [onSubmit, initial, move])

  // return set of errors per selection from validation rules
  const validationErrors = useCallback((args: Record<string, Argument<Player> | undefined>) => {
    if (!action) return {};
    return Object.fromEntries(
      move.selections.filter(
        s => s.name !== '__action__' && s.name !== '__confirm__'
      ).map(
        s => [
          s.name,
          args[s.name] === undefined ? 'Missing' : action._getError(s, args)
        ]
      )
    );
  }, [action, move.selections]);

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
    if (!move.requireExplicitSubmit || !action) return undefined;
    if (Object.values(allArgs).some(a => a === undefined)) return undefined;
    for (const s of move.selections) {
      if (s.type === 'board' && s.isMulti() && (!selected || (selected.length < (s.min ?? 1) || selected.length > (s.max ?? Infinity)))) return undefined;
    }
    let confirm = 'Confirm';
    const args: Record<string, Argument<Player>> = Object.fromEntries(Object.entries(allArgs).filter(([_, v]) => v !== undefined)) as Record<string, Argument<Player>>;
    confirm = action._getConfirmation(move.selections[0], args) ?? confirm;
    return n(confirm, args)
  }, [move, action, allArgs, selected, validationErrors]);

  const confirmToShow = useMemo(() => {
    if (confirm) return confirm;
    if (stepName === 'disambiguate-board-selection') return move.prompt ?? move.name;
  }, [stepName, confirm, move]);

  const selectionsToShow = useMemo(() => move.selections.filter(s => s.name !== '__confirm__'), [move]);

  return (
    <form
      id={move.name}
      onSubmit={e => onSubmitForm(e)}
      className={`action ${move.name}`}
    >
      {move.prompt && stepName !== 'disambiguate-board-selection' && <div className="prompt">{move.prompt}</div>}

      {selectionsToShow.map(s => (
        <Selection
          key={s.name}
          value={allArgs[s.name]}
          error={errors[s.name]}
          onChange={(value: Argument<Player>) => handleChange(s.name, value)}
          selection={s}
        />
      ))}

      {confirmToShow && <button name="submit" type="submit">{confirmToShow}</button>}
    </form>
  );
};

export default ActionForm;
