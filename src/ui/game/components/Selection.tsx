import React from 'react';

import type { ResolvedSelection } from '../../../action/selection.js';
import type { Argument } from '../../../action/action.js';

const Selection = ({selection, value, error, setErrors, onChange} : {
  selection: ResolvedSelection,
  value: Argument | undefined,
  error?: string,
  setErrors: (errors: Record<string, string>) => void,
  onChange: (value: Argument) => void
}) => (
  <div className={`selection ${selection.name}`}>
    {selection.prompt && selection.type !== 'button' && <span className="prompt">{selection.prompt}</span>}

    {selection.type === 'choices' && selection.choices?.map(choice => (
      <button
        type="button"
        className={(typeof choice === 'object' && 'choice' in choice ? choice.choice : choice) === value ? 'selected' : ''}
        key={String(choice)}
        onClick={() => onChange((typeof choice === 'object' && 'choice' in choice ? choice.choice : choice))}
      >
        {String(typeof choice === 'object' && 'label' in choice ? choice.label : choice)}
      </button>
    ))}

    {selection.type === 'choices' && selection.invalidOptions?.map(choice => (
      <button
        type="button"
        className='invalid'
        key={String(choice.option)}
        onClick={() => setErrors({ [String(selection.name)]: choice.error })}
      >
        {String(choice.label ?? choice.option)}
      </button>
    ))}

    {selection.type === 'number' && (
      <input
        name={selection.name}
        type="number"
        min={selection.min ?? 1}
        max={selection.max}
        onChange={e => onChange(parseInt(e.target.value))}
        value={String(value)}
        autoComplete='off'
      />
    )}

    {selection.type === 'text' && (
      <input
        name={selection.name}
        onChange={e => onChange(e.target.value)}
        value={String(value)}
        autoComplete='off'/>
    )}

    {selection.type === 'button' &&
      <button name={selection.name} value='confirm' type="submit">{selection.prompt ?? String(selection.value)}</button>
    }

    {error && <div className="error">{error}</div>}
  </div>
);

export default Selection;
