import React, { useState, useRef, useEffect } from 'react';
import { gameStore } from '../../';
import classNames from 'classnames';

import {
  Piece,
  GameElement,
} from '../../../game/board'
import { serialize } from '../../../game/action/utils'

import type { ElementJSON } from '../../../game/board/types';
import type { PendingMove } from '../../../game/action/types';
import type { Player } from '../../../game/player';

const elementAttributes = (el: GameElement<Player>) => {
  return Object.fromEntries(Object.entries(el).filter(([key, val]) => (
    !['_t', '_ctx', '_ui', 'name', '_visible', 'game', 'pile', 'board', '_eventHandlers', 'className'].includes(key) && typeof val !== 'function'
  )).map(([key, val]) => (
    [`data-${key.toLowerCase()}`, serialize(val)]
  )));
}

const defaultAppearance = () => null;

const Element = ({element, json, selected, onSelectElement}: {
  element: GameElement<Player>,
  json: ElementJSON,
  selected: GameElement<Player>[],
  onSelectElement: (element: GameElement<Player>, moves: PendingMove<Player>[]) => void,
}) => {
  const [boardSelections, move, position] = gameStore(s => [s.boardSelections, s.move, s.position, s.boardJSON]);
  const [transform, setTransform] = useState<string>(); // temporary transform from new to old used to animate
  const [animating, setAnimating] = useState(false); // currently animating
  const [animatedFrom, setAnimatedFrom] = useState<string>(); // track position animated from to prevent client and server update both triggering same animation
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wrapper.current && transform) {
      const cancel = (e: TransitionEvent) => {
        if (e.propertyName === 'transform') {
          element.doneMoving();
          setAnimating(false);
          wrapper.current?.removeEventListener('transitionend', cancel);
        }
      };
      setAnimating(true);
      setTransform(undefined); // remove transform and let it transition to new location
      wrapper.current?.addEventListener('transitionend', cancel);
    }
  }, [wrapper, transform])

  const clickMoves = boardSelections.get(element);
  const isSelected = selected.includes(element) || move?.args.some(a => a === element || a instanceof Array && a.includes(element));;
  const baseClass = element instanceof Piece ? 'Piece' : 'Space';
  const appearance = element._ui.appearance.render || defaultAppearance;
  const absoluteTransform = element.absoluteTransform();

  let style: React.CSSProperties = {};

  // initially place into old position
  const moveTransform = element.getMoveTransform();
  const computedStyle = element._ui.computedStyle;
  if (!moveTransform) element.doneMoving();
  if (moveTransform && !transform && !animating && animatedFrom !== element._t.was) {
    const transformToNew = `translate(${moveTransform.translateX}%, ${moveTransform.translateY}%) scaleX(${moveTransform.scaleX}) scaleY(${moveTransform.scaleY})`;
    setTransform(transformToNew);
    setAnimatedFrom(element._t.was);
    return null; // don't render this one, to prevent untransformed render
  }

  if (computedStyle) {
    style = Object.fromEntries(Object.entries(computedStyle).map(([key, val]) => ([key, `${val}%`])))
  }
  style.fontSize = absoluteTransform.height * 0.04 + 'rem'

  let contents: JSX.Element[] = [];
  if ((element._t.children.length || 0) !== (json.children?.length || 0)) {
    console.error('JSON does not match board. This can be caused by client rendering while server is updating and should fix itself as the final render is triggered.', element, json);
    //throw Error('JSON does not match board');
    return null;
  }
  for (let i = 0; i !== element._t.children.length; i++) {
    const el = element._t.children[i];
    if (!el._ui.computedStyle || el._ui.appearance.render === false) continue;
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

  if (element._ui.appearance.connections) {
    if (!element._t.graph) return;
    let { thickness, style, color, fill, label, labelScale } = element._ui.appearance.connections;
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
          x: (source._ui.computedStyle.left + source._ui.computedStyle?.width / 2) * absoluteTransform.width / 100,
          y: (source._ui.computedStyle.top + source._ui.computedStyle?.height / 2) * absoluteTransform.height / 100
        }
        const destination = {
          x: (target._ui.computedStyle.left + target._ui.computedStyle?.width / 2) * absoluteTransform.width / 100,
          y: (target._ui.computedStyle.top + target._ui.computedStyle?.height / 2) * absoluteTransform.height / 100
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
              transform={`translate(${(origin.x + destination.x) / 2 - labelScale! * absoluteTransform.width * .5}
  ${(origin.y + destination.y) / 2 - labelScale! * absoluteTransform.height * .5})
  scale(${labelScale})`}
            >{label(args[1])}</g>);
        }
      }
    });
    contents.unshift(
      <svg key="svg-edges" style={{pointerEvents: 'none', position: 'absolute', width: '100%', height: '100%', left: 0, top: 0}} viewBox={`0 0 ${absoluteTransform.width} ${absoluteTransform.height}`}>{lines}</svg>
    );
    if (label) contents.push(
      <svg key="svg-edge-labels" style={{pointerEvents: 'none', position: 'absolute', width: '100%', height: '100%', left: 0, top: 0}} viewBox={`0 0 ${absoluteTransform.width} ${absoluteTransform.height}`}>{labels}</svg>
    );
  }

  const attrs = elementAttributes(element);
  if (element.player?.position === position) attrs.mine = 'true';

  return (
    <div
      style={{...style, transform, transition: animating ? 'transform 1.2s': undefined, transformOrigin: 'top left', position: 'absolute'}}
      ref={wrapper}
    >
      <div
        id={element.name}
        className={classNames(
          baseClass,
          {
            [element.constructor.name]: baseClass !== element.constructor.name,
            clickable: clickMoves?.length,
            selected: isSelected,
            zoomable: typeof element._ui.appearance.zoomable === 'function' ? element._ui.appearance.zoomable(element) : element._ui.appearance.zoomable,
          }
        )}
        onClick={clickMoves ? (e: React.MouseEvent<Element, MouseEvent>) => { e.stopPropagation(); onSelectElement(element, clickMoves) } : undefined}
        {...attrs}
      >
        {appearance(element)}
        {contents}
      </div>
    </div>
  );
};
// would like to memo but not yet clear how well this work - dont optimize yet
// memo(... (el1, el2) => (
//   JSON.stringify(el1.clickable) === JSON.stringify(el2.clickable) &&
//     JSON.stringify(el1.json) === JSON.stringify(el2.json)

export default Element;
