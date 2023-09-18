import type {Argument, SerializedArgumentList, DeserializedArgumentList} from './types.d';

export const throttle = (() => {
  let throttled = false;
  return (fn: () => any) => {
    if (throttled) return;
    fn();
    setTimeout(() => throttled = false, 20);
    throttled = true;
  };
})();

export const findGameElement = (q: string) => document.querySelector('#game-dom')?.querySelector(q) as HTMLElement;

export const elByChoice = (c: string) => {
  const el = findGameElement(`[data-key="${c}"]`) as HTMLElement;
  if (!el) throw Error(`No element found: ${c}`);
  return el;
}

export const choiceByEl = (el?: HTMLElement) => el?.dataset?.key;

export const parentEl = (el?: HTMLElement) => el?.dataset?.parent;

export const parentChoice = (c: string) => parentEl(elByChoice(c));

export const zoneByEl = (c: string) => nearestEl(elByChoice(c), el => el.parentElement?.id == 'game-dom');

export const isEl = (c?: Argument) => typeof c === 'string' && (c.slice(0, 6) == '$uuid(' || c.slice(0, 4) == '$el(');

export const choiceAtPoint = (x: number, y: number, condition?: (e: HTMLElement) => boolean) => choiceByEl(elAtPoint(x, y, condition));

export const elAtPoint = (x: number, y: number, condition?: (e: HTMLElement) => boolean) => nearestEl(document.elementFromPoint(x, y) as HTMLElement, condition);

export const nearestEl = (el: HTMLElement | undefined, condition?: (e: HTMLElement) => boolean): HTMLElement | undefined => {
  if (!el || !el.parentElement) return undefined;
  return choiceByEl(el) && (!condition || condition(el)) ? el : nearestEl(el.parentElement, condition);
};

export const zoneInfoForPoint = (x: number, y: number) => {
  const el = elAtPoint(x, y, el => el.parentElement?.id == 'game-dom');
  if (el) return { el, x: x - el.getBoundingClientRect().x, y: y - el.getBoundingClientRect().y };
};

export const xmlToNode = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml').firstChild as Element;

export function choiceForXmlNode(node: null): undefined;
export function choiceForXmlNode(node: Element): string;
export function choiceForXmlNode(node: Element | null): string | undefined;
export function choiceForXmlNode(node: Element | null) {
  if (!node) return;
  if (node.getAttribute('uuid')) return `$uuid(${node.getAttribute('uuid')})`;
  const branch = [];
  while (node.parentElement) {
    branch.unshift(Array.from(node.parentElement.childNodes).indexOf(node) + 1);
    node = node.parentElement;
  }
  return `$el(${branch.join('-')})`;
};

export const isFlipped = (el: HTMLElement) => el.matches('.flipped, .flipped *');

export const xmlNodeByChoice = (doc: Element, choice: string) => {
  if (choice.slice(0, 6) === '$uuid(') return doc.querySelector(`[uuid="${choice.slice(6, -1)}"]`);
  if (choice.slice(0, 3) === '$p(') return doc.querySelector(`.player-mat[player="${choice.slice(3, -1)}"]`);
  const query = `game > ${choice.slice(4,-1).split('-').map((index) => `*:nth-child(${index})`).join(' > ')}`;
  return doc.querySelector(query.replace(/#(\d)/g, '#\\3$1 '));
};

export const currentGridPosition = (parent: HTMLElement, x: number, y: number, scale: number, interColumn=false, flipped=false) => {
  const tc = window.getComputedStyle(parent).gridTemplateColumns.split(' ');
  const tr = window.getComputedStyle(parent).gridTemplateRows.split(' ');
  let { left, top } = parent.getBoundingClientRect();
  const width = parseFloat(tc[0].slice(0, -2)) * scale;
  const height = parseFloat(tr[0].slice(0, -2)) * scale;
  if (flipped) {
    left -= width - parseFloat(tc[tc.length - 1].slice(0, -2)) * scale
    top -= height - parseFloat(tr[tr.length - 1].slice(0, -2)) * scale
  }
  const columns = tc.length;
  const rows = tr.length;
  let col = Math.min(Math.max(Math[interColumn ? 'ceil' : 'round']((x - left) / width), 0), columns - (interColumn ? 0 : 1));
  if ((parent.getAttribute('direction') === 'rtl') ? !flipped : flipped) col = columns - col - (interColumn ? 0 : 1);
  let row = Math.min(Math.max(Math.round((y - top) / height), 0), rows - 1);
  if (flipped) row = rows - row - 1;
  return col + row * columns;
}

export function deserialize(value: string): Argument;
export function deserialize(value: string[]): Argument[];
export function deserialize(value: Record<string, string>): Record<string, Argument>;
export function deserialize(value: string[] | Record<string, string>): Argument[] | Record<string, Argument>;
export function deserialize(value: SerializedArgumentList): DeserializedArgumentList {
  if (value instanceof Array) {
    return value.map(v => deserialize(v));
  }
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deserialize(v)]));
  if (value && value.slice && (value.slice(0, 4) === '$el(' || value.slice(0, 6) === '$uuid(' || value.slice(0, 3) === '$p(')) {
    return value;
  }
  if (typeof value === 'object') return value;
  return JSON.parse(value);
};

export function serialize(value: Argument): string;
export function serialize(value: Argument[]): string[];
export function serialize(value: Record<string, Argument>): Record<string, string>;
export function serialize(value: DeserializedArgumentList): SerializedArgumentList {
  //if (value === 'true') return true;
  //if (value === 'false') return false;
  if (typeof value === 'string' && /\$\w+\(.*\)/.test(value)) return value;
  return JSON.stringify(value);
};

export const times = <T>(n: number, fn: (n: number) => T) => Array.from(Array(n)).map((_, i) => fn(i + 1));

export const unescape = (s: string) => s.replace(/&(lt|gt|amp|apos|quot);/g, (_, c: string) => (String({ 'lt': '<', 'gt': '>', 'amp': '&', 'apos': "'", 'quot': '"' }[c])));
