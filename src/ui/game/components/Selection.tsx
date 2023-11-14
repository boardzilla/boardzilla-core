import React from 'react';

import type { ResolvedSelection } from '../../../action/selection.js';
import type { Player } from '../../../player/index.js';
import { humanizeArg } from '../../../action/index.js';
import { serializeArg } from '../../../action/utils.js';


const Selection = ({selection} : {
  selection: ResolvedSelection<Player>
}) => (
  <>
    {selection.type === 'choices' && selection.choices && (
      <>
        <div className="prompt">{selection.prompt}</div>
        {(selection.choices instanceof Array ?
          selection.choices.map(c => ([c, c])) :
          Object.entries(selection.choices)).map(([k, v]) => (
            <button key={String(serializeArg(k))} type="submit" name={selection.name} value={String(serializeArg(k))}>
              {humanizeArg(v)}
            </button>
          ))
        }
      </>
    )}

    {selection.type === 'number' && (
      <>
        <input
          name={selection.name}
          type="number"
          min={selection.min}
          max={selection.max}
          defaultValue={String(selection.initial || '')}
          autoComplete='off'
        />
        <button type="submit">{selection.prompt}</button>
      </>
    )}

    {selection.type === 'text' && (
      <>
        <input name={selection.name} defaultValue={String(selection.initial || '')} autoComplete='off'/>
        <button type="submit">{selection.prompt}</button>
      </>
    )}

    {selection.type === 'button' && <button name={selection.name} value='confirm' type="submit">{selection.prompt}</button>}
  </>
);

export default Selection;
