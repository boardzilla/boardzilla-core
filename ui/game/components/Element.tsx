import React, { memo } from 'react';
import { gameStore } from '../../';
import classNames from 'classnames';

import {
  Piece,
  GameElement,
} from '../../../game/board'
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

const Element = ({element, json, selected, onSelectElement}: {
  element: GameElement<Player>,
  json: ElementJSON,
  selected: GameElement<Player>[],
  onSelectElement: (e: GameElement<Player>) => void,
}) => {
  //console.log("updated", element.branch());
  const [uiOptions, boardSelections] = gameStore(s => [s.uiOptions, s.boardSelections]);

  const clickMove = boardSelections.get(element);
  const isSelected = selected.includes(element);
  const baseClass = element instanceof Piece ? 'Piece' : 'Space';
  const appearance = element._ui.component || defaultAppearance;
  const transform = element.absoluteTransform();

  let style: React.CSSProperties = {};

  if (element._ui.computedStyle) {
    style = Object.fromEntries(Object.entries(element._ui.computedStyle).map(([key, val]) => ([key, `${val}%`])))
  }
  style.fontSize = transform.height * 0.1 + 'vmin'

  let contents: JSX.Element[] = [];
  if ((element._t.children.length || 0) !== (json.children?.length || 0)) {
    console.error(element, json);
    throw Error('JSON does not match board');
  }
  for (let i = 0; i !== element._t.children.length; i++) {
    const el = element._t.children[i];
    if (!el._ui.computedStyle) continue;
    contents.push(
      <Element
        key={el.branch()}
        element={el}
        json={json.children![i]}
        selected={selected}
        onSelectElement={onSelectElement}
      />
    );
  }

  if (element._ui.showConnections) {
    if (!element._t.graph) return;
    let { thickness, style, color, fill, label, labelScale } = element._ui.showConnections;
    if (!thickness) thickness = .1;
    if (!style) style = 'solid';
    if (!color) color = 'black';
    if (!fill) color = 'white';
    if (!labelScale) labelScale = 0.05;

    let i = 0;
    const lines: JSX.Element[] = [];
    const labels: JSX.Element[] = [];
    element._t.graph.forEachEdge((...args) => {
      const source = args[4].element as GameElement<Player>;
      const target = args[5].element as GameElement<Player>;

      if (source._ui.computedStyle && target._ui.computedStyle) {
        const origin = {
          x: (source._ui.computedStyle.left + source._ui.computedStyle?.width / 2) * transform.width / 100,
          y: (source._ui.computedStyle.top + source._ui.computedStyle?.height / 2) * transform.height / 100
        }
        const destination = {
          x: (target._ui.computedStyle.left + target._ui.computedStyle?.width / 2) * transform.width / 100,
          y: (target._ui.computedStyle.top + target._ui.computedStyle?.height / 2) * transform.height / 100
        }

        const distance = Math.sqrt(Math.pow(origin.x - destination.x, 2) + Math.pow(origin.y - destination.y, 2))

        if (style === 'double') {
          lines.push(
            <line key={i++}
            x1={origin.x} y1={origin.y}
            x2={destination.x} y2={destination.y}
            transform={`translate(${(origin.y - destination.y) / distance * thickness!}, ${(origin.x - destination.x) / distance * -thickness!})`}
            strokeWidth={thickness!} stroke={color}
              />
          );
          lines.push(
            <line key={i++}
            x1={origin.x} y1={origin.y}
            x2={destination.x} y2={destination.y}
            transform={`translate(${(origin.y - destination.y) / distance * -thickness!}, ${(origin.x - destination.x) / distance * thickness!})`}
            strokeWidth={thickness!} stroke={color}
              />
          );
        }
        lines.push(
          <line key={i++}
            x1={origin.x} y1={origin.y}
            x2={destination.x} y2={destination.y}
            strokeWidth={2 * thickness!} stroke={fill}
          />
        );
        if (label) {
          labels.push(
            <g
              key={`label${i}`}
              transform={`translate(${(origin.x + destination.x) / 2 - labelScale! * transform.width * .5}
  ${(origin.y + destination.y) / 2 - labelScale! * transform.height * .5})
  scale(${labelScale})`}
            >{label(args[1])}</g>);
        }
      }
    });
    contents.unshift(
      <svg key="svg-edges" style={{pointerEvents: 'none', position: 'absolute', width: '100%', height: '100%', left: 0, top: 0}} viewBox={`0 0 ${transform.width} ${transform.height}`}>{lines}</svg>
    );
    if (label) contents.push(
      <svg key="svg-edge-labels" style={{pointerEvents: 'none', position: 'absolute', width: '100%', height: '100%', left: 0, top: 0}} viewBox={`0 0 ${transform.width} ${transform.height}`}>{labels}</svg>
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
          clickable: !!clickMove,
          selected: isSelected,
        }
      ),
      onClick: clickMove ? (e: Event) => { e.stopPropagation(); onSelectElement(element) } : null,
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
