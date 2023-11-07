import React from 'react';
import type { SetupComponentProps } from '../../../game/index.js'

export const toggleSetting = (label: string) => ({ name, settings, updateKey }: SetupComponentProps) => (
  <div>
    <label>{label}: </label>
    <input type="checkbox" value={settings && settings[name]} onChange={e => updateKey(name, e.target.checked)}/>
  </div>
)

export const choiceSetting = (label: string, choices: Record<string, string>) => ({ name, settings, updateKey }: SetupComponentProps) => (
  <div>
    <label>{label}: </label>
    <select value={settings ? settings[name] || "" : ""} onChange={e => updateKey(name, e.target.value)}>
      {Object.entries(choices).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
    </select>
  </div>
)

export const textSetting = (label: string) => ({ name, settings, updateKey }: SetupComponentProps) => (
  <div>
    <label>{label}: </label>
    <input value={settings ? settings[name] || "" : ""} onChange={e => updateKey(name, e.target.value)}/>
  </div>
)

export const numberSetting = (label: string, min: number, max: number) => ({ name, settings, updateKey }: SetupComponentProps) => (
  <div>
    <label>{label}: </label>
    <input type="number" min={min} max={max} value={settings ? settings[name] || "" : ""} onChange={e => updateKey(name, e.target.value)}/>
  </div>
)
