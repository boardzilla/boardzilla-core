import React from 'react';
import { serializeArg } from '../../../action/utils.js';

import type { ResolvedSelection } from '../../../action/selection.js';
import type { Player } from '../../../player/index.js';
import type { Argument } from '../../../action/action.js';

const Selection = ({selection, value, error, onChange} : {
  selection: ResolvedSelection<Player>,
  value: Argument<Player> | undefined,
  error?: string,
  onChange: (value: Argument<Player>) => void
}) => (
  <div className={`selection ${selection.name}`}>
    {selection.prompt && selection.type !== 'button' && !selection.isBoardChoice() && <span className="prompt">{selection.prompt}</span>}

    {selection.type === 'choices' && selection.choices && (
      selection.choices instanceof Array ? selection.choices.map(c => ([c, c])) : Object.entries(selection.choices)).map(([k, v]) => (
        <button
          type="button"
          className={k === value ? 'selected' : ''}
          key={String(serializeArg(k))}
          onClick={() => onChange(k)}
        >
          {v.toString()}
        </button>
      )
      )}

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
