
export default class Player {
  name: string;
  color: string;
  position: number; // table position, as opposed to turn order
  settings?: any

  toJSON() {
    let {...attrs}: Record<any, any> = this;

    // remove methods
    attrs = Object.fromEntries(Object.entries(attrs).filter(
      ([, value]) => typeof value !== 'function'
    ));

    return attrs;
  }
}
