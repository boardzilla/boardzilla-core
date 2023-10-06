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

const defaultAppearance = (element: GameElement<Player>, children: JSX.Element[]) => (
  <>
    {element.name || element.constructor.name}
    {children}
  </>
);

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

  const htmlElement = isA(element, Piece) ? {
    tag: 'span',
    base: 'Piece'
  } : {
    tag: 'div',
    base: 'Space'
  };

  const appearance = (uiOptions.appearance && uiOptions.appearance[json.className]) ?
                      uiOptions.appearance[json.className] : defaultAppearance;

  let style = {};
  if (element._ui?.computedStyle) {
    style = Object.fromEntries(Object.entries(element._ui.computedStyle).map(([key, val]) => ([key, `${val}%`])))
  }

  return React.createElement(
    htmlElement.tag,
    {
      id: element.name,
      style,
      className: classNames(
        htmlElement.base,
        {
          [element.constructor.name]: htmlElement.base !== element.constructor.name,
          hilite: isHilited || isClickable,
          selected: isSelected,
        }
      ),
      onClick: isClickable ? (e: Event) => { e.stopPropagation(); onSelectElement(element) } : null,
      ...elementAttributes(element)
    },
    appearance(
      element,
      element._t.children.map((el, i) => {
        return <Element
                 key={el.branch()}
                 element={el}
                 json={json.children![i]}
                 clickables={clickables}
                 hilites={hilites}
                 selected={selected}
                 onSelectElement={onSelectElement}/>
      })
    )
  );
};
// would like to memo but not yet clear how well this work - dont optimize yet
// memo(... (el1, el2) => (
//   JSON.stringify(el1.clickable) === JSON.stringify(el2.clickable) &&
//     JSON.stringify(el1.json) === JSON.stringify(el2.json)

export default Element;
