import { PlayerAttributes } from './types';

export default class Player {
  public id: string;
  public name: string;
  public color: string;
  public position: number; // table position, as opposed to turn order

  toJSON() {
    let {...attrs}: Record<any, any> = this;

    // remove methods
    attrs = Object.fromEntries(Object.entries(attrs).filter(
      ([, value]) => typeof value !== 'function'
    ));

    return attrs;
  }

  colorEncodedName() {
    return `<span color="${this.color}">${this.name}</span>`;
  }
}
