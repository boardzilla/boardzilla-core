import React, { useEffect } from 'react';
import type { SetupComponentProps } from '../../index.js'

/**
 * Provide a game setting that can be turned on or off.
 * @param label - Text label to appear next to the toggle
 * @category UI
 */
export const toggleSetting = (label: string) => ({ name, settings, updateKey }: SetupComponentProps) => {
  useEffect(() => {
    if (settings[name] === undefined) updateKey(name, false);
  }, [name, settings, updateKey]);

  return (
    <div>
      <input id={name} type="checkbox" value={settings && settings[name]} onChange={e => updateKey(name, e.target.checked)}/>
      <label htmlFor={name}>{label}</label>
    </div>
  );
};

/**
 * Provide a game setting that can be selected from a list of options.
 * @param label - Text label to appear next to the option list
 * @param choices - List of choices as key-value pairs, where the value will be
 * the text choice for the host and the key will the result of calling {@link
 * Game#setting}
 * @category UI
 */
export const choiceSetting = (label: string, choices: Record<string, string>) => ({ name, settings, updateKey }: SetupComponentProps) => {
  useEffect(() => {
    if (settings[name] === undefined) updateKey(name, Object.keys(choices)[0]);
  }, [name, settings, updateKey]);

  return (
    <div>
      <label>{label}: </label>
      <select value={settings ? settings[name] || "" : ""} onChange={e => updateKey(name, e.target.value)}>
        {Object.entries(choices).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select>
    </div>
  );
};


/**
 * Provide a game setting that can be entered as text.
 * @param label - Text label to appear next to the text box
 * @category UI
 */
export const textSetting = (label: string) => ({ name, settings, updateKey }: SetupComponentProps) => (
  <div>
    <label>{label}: </label>
    <input value={settings ? settings[name] || "" : ""} onChange={e => updateKey(name, e.target.value)}/>
  </div>
)

/**
 * Provide a game setting that can be selected as a number.
 * @param label - Text label to appear next to the number select
 * @param min - The minimum number allowed
 * @param max - The maximum number allowed
 * @category UI
 */
export const numberSetting = (label: string, min: number, max: number) => ({ name, settings, updateKey }: SetupComponentProps) => {
  useEffect(() => {
    if (settings[name] === undefined) updateKey(name, min);
  }, [name, settings, updateKey]);

  return (
    <div>
      <label>{label}: </label>
      <input type="number" min={min} max={max} value={settings ? settings[name] || String(min) : String(min)} onChange={e => updateKey(name, parseInt(e.target.value))}/>
    </div>
  );
};
