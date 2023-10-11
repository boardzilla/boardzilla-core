import React, { memo } from 'react';
import { gameStore } from '../../';
import classNames from 'classnames';

import {
  Piece,
  Space,
  GameElement,
  isA,
} from '../../../game'
import { serialize } from '../../../game/action/utils'

import type { ElementJSON } from '../../../game/board/types'
import type { Player } from '../../../game/player';

const elementAttributes = (el: GameElement<Player>) => {
  return Object.fromEntries(Object.entries(el).filter(([key, val]) => (
    !['_t', '_ctx', '_ui', 'name', '_visible', 'game', 'pile', 'board', '_eventHandlers', 'className'].includes(key) && typeof val !== 'function'
  )).map(([key, val]) => (
    [`data-${key.toLowerCase()}`, serialize(val)]
  )));
}

const defaultAppearance = (element: GameElement<Player>) => null;

const Element = ({element, json, clickables, hilites, selected, onSelectElement}: {
  element: GameElement<Player>,
  json: ElementJSON,
  clickables: GameElement<Player>[],
  hilites: GameElement<Player>[],
  selected: GameElement<Player>[],
  onSelectElement: (e: GameElement<Player>) => void,
}) => {
  //console.log("updated", element.branch());
  const [uiOptions] = gameStore(s => [s.uiOptions]);

  const isHilited = hilites.includes(element);
  const isSelected = selected.includes(element);
  const isClickable = clickables.includes(element)

  const baseClass = element instanceof Piece ? 'Piece' : 'Space';

  const appearance = element._ui.component || defaultAppearance;

  let style: React.CSSProperties = {};
  if (element._ui.computedStyle) {
    style = Object.fromEntries(Object.entries(element._ui.computedStyle).map(([key, val]) => ([key, `${val}%`])))
  }
  style.fontSize = element.absoluteTransform().height * 0.1 + 'vh'

  let contents = element._t.children.filter(c => c._ui.computedStyle).map((el, i) => {
    return <Element
             key={el.branch()}
             element={el}
             json={json.children![i]}
             clickables={clickables}
             hilites={hilites}
             selected={selected}
             onSelectElement={onSelectElement}/>
  });

  if (element._ui.showConnections) {
    if (!element._t.graph) return;
    let i = 0;
    const lines: JSX.Element[] = [];
    element._t.graph.forEachEdge((...args) => {
      const source = args[4].element as GameElement<Player>;
      const target = args[5].element as GameElement<Player>;

      if (source._ui.computedStyle && target._ui.computedStyle) {
        const origin = {
          x: source._ui.computedStyle.left + source._ui.computedStyle?.width / 2,
          y: source._ui.computedStyle.top + source._ui.computedStyle?.height / 2
        }
        const destination = {
          x: target._ui.computedStyle.left + target._ui.computedStyle?.width / 2,
          y: target._ui.computedStyle.top + target._ui.computedStyle?.height / 2
        }

        lines.push(
          <line key={i++}
            vectorEffect="non-scaling-stroke"
            x1={origin.x} y1={origin.y}
            x2={destination.x} y2={destination.y}
            strokeWidth='2px' stroke='black'
          />
        );
      }
    });
    contents.unshift(
      <svg key="svg-edges"  style={{position: 'absolute', width: '100%', height: '100%', left: 0, top: 0}} preserveAspectRatio="none" viewBox='0 0 100 100'>{lines}</svg>
    );
  }

  return React.createElement(
    'div',
    {
      id: element.name,
      style,
      className: classNames(
        baseClass,
        {
          [element.constructor.name]: baseClass !== element.constructor.name,
          hilite: isHilited || isClickable,
          selected: isSelected,
        }
      ),
      onClick: isClickable ? (e: Event) => { e.stopPropagation(); onSelectElement(element) } : null,
      ...elementAttributes(element)
    },
    <>
      {appearance(element)}
      {contents}
    </>
  );
};
// would like to memo but not yet clear how well this work - dont optimize yet
// memo(... (el1, el2) => (
//   JSON.stringify(el1.clickable) === JSON.stringify(el2.clickable) &&
//     JSON.stringify(el1.json) === JSON.stringify(el2.json)

export default Element;
