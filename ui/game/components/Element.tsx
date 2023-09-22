import React, { memo } from 'react';
import { gameStore } from '../../';
import classNames from 'classnames';

import {
  Piece,
  GameElement,
  isA
} from '../../../game'

import type { ElementJSON } from '../../../game/board/types'

const elementAttributes = (el: GameElement) => {
  const { _t, _ctx, name, _visible, _eventHandlers, ...rest } = el;
  return Object.fromEntries(Object.entries(rest).map(([key, val]) => [`data-${key.toLowerCase()}`, val]));
}

const defaultAppearance = (element: GameElement, children: JSX.Element[]) => (
  <>
    {element.name || className(element)}
    {children}
  </>
);

const className = (element: GameElement) => element.constructor.name;

const Element = ({element, json, clickables, hilites, selected, onSelectElement}: {
  element: GameElement,
  json: ElementJSON,
  clickables: GameElement[],
  hilites: GameElement[],
  selected: GameElement[],
  onSelectElement: (e: GameElement) => void,
}) => {
  //console.log("updated", element.branch());
  const [player, uiOptions] = gameStore(s => [s.player, s.uiOptions]);

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

  const appearance = (uiOptions.appearance && uiOptions.appearance[className(element)]) ?
                      uiOptions.appearance[className(element)] : defaultAppearance;;

  return React.createElement(
    htmlElement.tag,
    {
      id: element.name,
      className: classNames(
        htmlElement.base,
        element.constructor.name,
        {
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