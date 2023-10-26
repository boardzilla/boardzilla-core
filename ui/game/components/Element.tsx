import React, { useState, useRef, useEffect, useCallback } from 'react';
import { gameStore } from '../../';
import classNames from 'classnames';
import { DraggableCore } from 'react-draggable';

import {
  Piece,
  GameElement,
} from '../../../game/board'
import { serialize } from '../../../game/action/utils'

import type { ElementJSON } from '../../../game/board/types';
import type { PendingMove } from '../../../game/action/types';
import type { Player } from '../../../game/player';
import type { DraggableData } from 'react-draggable';

const elementAttributes = (el: GameElement<Player>) => {
  return Object.fromEntries(Object.entries(el).filter(([key, val]) => (
    !['_t', '_ctx', '_ui', 'name', '_visible', 'game', 'pile', 'board', '_eventHandlers', 'className'].includes(key) && typeof val !== 'function'
  )).map(([key, val]) => (
    [`data-${key.toLowerCase()}`, serialize(val)]
  )));
}

const defaultAppearance = (el: GameElement<Player>) => <div className="bz-default">{el.name || el.constructor.name}</div>;

const Element = ({element, json, selected, onSelectElement, onMouseLeave}: {
  element: GameElement<Player>,
  json: ElementJSON,
  selected: GameElement<Player>[],
  onSelectElement: (moves: PendingMove<Player>[], ...elements: GameElement<Player>[]) => void,
  onMouseLeave?: () => void,
}) => {
  const [game, boardSelections, move, position, dragElement, setDragElement, dropElements, currentDrop, setCurrentDrop] = gameStore(s => [s.game, s.boardSelections, s.move, s.position, s.dragElement, s.setDragElement, s.dropElements, s.currentDrop, s.setCurrentDrop, s.boardJSON]);
  const [transform, setTransform] = useState<string>(); // temporary transform from new to old used to animate
  const [animating, setAnimating] = useState(false); // currently animating
  const [dragging, setDragging] = useState(false); // currently dragging
  const [animatedFrom, setAnimatedFrom] = useState<string>(); // track position animated from to prevent client and server update both triggering same animation
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wrapper.current && transform) {
      const cancel = (e: TransitionEvent) => {
        if (e.propertyName === 'transform') {
          console.log('transitionend', element.branch());
          element.doneMoving();
          setAnimating(false);
          wrapper.current?.removeEventListener('transitionend', cancel);
        }
      };
      wrapper.current?.addEventListener('transitionend', cancel);
      console.log('animating now');
      setAnimating(true);
      setTransform(undefined); // remove transform, while setting animating to let this transition to new location
    }
  }, [wrapper, transform])

  const branch = element.branch()
  const selections = boardSelections[branch];
  const isSelected = selected.includes(element) || move?.args.some(a => a === element || a instanceof Array && a.includes(element));;
  const baseClass = element instanceof Piece ? 'Piece' : 'Space';
  const appearance = element._ui.appearance.render || (element.board._ui.disabledDefaultAppearance ? () => null : defaultAppearance);
  const absoluteTransform = element.absoluteTransform();
  const clickable = !dragElement && selections?.clickMoves.length;
  const selectable = !dragElement && selections?.clickMoves.filter(m => m.action.slice(0, 4) !== '_god').length;
  const draggable = !animating && !transform && selections?.dragMoves.length; // ???
  const droppable = dropElements.find(({ element }) => element === branch);

  let style: React.CSSProperties = {};

  const onClick = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.stopPropagation();
    onSelectElement(selections.clickMoves, element);
  }, [onSelectElement, selections]);

  const onStartDrag = useCallback((e: MouseEvent, data: DraggableData) => {
    e.stopPropagation();
    if (wrapper.current) {
      wrapper.current?.setAttribute('data-lastx', String(data.lastX));
      wrapper.current?.setAttribute('data-lasty', String(data.lastY))
    }
  }, [wrapper]);

  const onDrag = useCallback((e: MouseEvent, data: DraggableData) => {
    e.stopPropagation();
    setDragging(true);
    setDragElement(branch);
    if (wrapper.current && element._ui.computedStyle) {
      wrapper.current.style.top = `calc(${element._ui.computedStyle.top}% - ${parseInt(wrapper.current.getAttribute('data-lasty') || '') - data.y}px)`;
      wrapper.current.style.left = `calc(${element._ui.computedStyle.left}% - ${parseInt(wrapper.current.getAttribute('data-lastx') || '') - data.x}px)`;
    }
  }, [branch, wrapper, style]);

  const onStopDrag = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    if (dragging) {
      if (currentDrop) {
        const move = dropElements.find(({ element }) => element === currentDrop)?.move;
        if (move) onSelectElement([move], element, game!.board.atBranch(currentDrop));
      }
      if (wrapper.current && element._ui.computedStyle) {
        wrapper.current.style.top = element._ui.computedStyle.top + '%';
        wrapper.current.style.left = element._ui.computedStyle.left + '%';
      }
    } else {
      onClick(e);
    }
    setDragging(false);
    setCurrentDrop(undefined);
    setDragElement(undefined);
  }, [dragging, currentDrop, onClick, onSelectElement, wrapper]);

  const onDrop = useCallback(() => {
    setCurrentDrop(branch);
  }, []);

  const onLeave = useCallback(() => {
    setCurrentDrop(undefined);
  }, []);

  // initially place into old position
  const moveTransform = element.getMoveTransform();
  const computedStyle = element._ui.computedStyle;
  if (!animating) {
    if (!moveTransform || animatedFrom === element._t.was) {
      console.log('doneMoving', branch, !!moveTransform)
      element.doneMoving();
    } else if (!transform) {
      const transformToNew = `translate(${moveTransform.translateX}%, ${moveTransform.translateY}%) scaleX(${moveTransform.scaleX}) scaleY(${moveTransform.scaleY})`;
      console.log('start animate transform', branch, transformToNew);
      setTransform(transformToNew);
      setAnimatedFrom(element._t.was);
      return null; // don't render this one, to prevent untransformed render
    }
  }
  
  if (computedStyle) {
    style = Object.fromEntries(Object.entries(computedStyle).map(([key, val]) => ([key, `${val}%`])))
  }
  if (dragging) {
    delete style.left;
    delete style.top;
  }
  style.fontSize = absoluteTransform.height * 0.04 + 'rem'

  let contents: JSX.Element[] | JSX.Element = [];
  if ((element._t.children.length || 0) !== (json.children?.length || 0)) {
    console.error('JSON does not match board. This can be caused by client rendering while server is updating and should fix itself as the final render is triggered.', element, json);
    //throw Error('JSON does not match board');
    return null;
  }
  for (let i = 0; i !== element._t.children.length; i++) {
    const el = element._t.order === 'stacking' ? element._t.children[element._t.children.length - i - 1] : element._t.children[i];
    const childJSON = element._t.order === 'stacking' ? json.children![json.children!.length - i - 1] : json.children![i];
    if (!el._ui.computedStyle || el._ui.appearance.render === false) continue;
    contents.push(
      <Element
        key={el.branch()}
        element={el}
        json={childJSON}
        selected={selected}
        onSelectElement={onSelectElement}
        onMouseLeave={droppable ? onDrop : undefined}
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

  // "base" semantic GameElement dom element
  contents = (
    <div
      id={element.name}
      className={classNames(
        baseClass,
        element._ui.appearance.className,
        {
          [element.constructor.name]: baseClass !== element.constructor.name,
          selected: isSelected,
          clickable, selectable, droppable
          // zoomable: !dragElement && (typeof element._ui.appearance.zoomable === 'function' ? element._ui.appearance.zoomable(element) : element._ui.appearance.zoomable),
        }
      )}
      onClick={clickable ? onClick : undefined}
      onMouseEnter={droppable ? onDrop : undefined}
      onMouseLeave={() => { if (droppable) onLeave(); if (onMouseLeave) onMouseLeave(); }}
      {...attrs}
    >
      {appearance(element)}
      {contents}
    </div>
  );

  // wrapper dom element for transforms and animations
  contents = (
    <div
      ref={wrapper}
      key={branch}
      className={classNames("transform-wrapper", { animating, dragging })}
      style={{ ...style, transform }}
    >
      {contents}
    </div>
  );

  contents = (
    <DraggableCore
      disabled={!draggable}
      // onStart={e => e.stopPropagation()}
      onStart={onStartDrag}
      onDrag={onDrag}
      onStop={onStopDrag}
      // position={position || {x:0, y:0}}
      // scale={(parentFlipped ? -1 : 1) * this.state.playAreaScale}
    >
      {contents}
    </DraggableCore>
  );

  if (!element._t.parent) console.log('GAMEELEMENTS render');

  return contents;
};
// would like to memo but not yet clear how well this work - dont optimize yet
// memo(... (el1, el2) => (
//   JSON.stringify(el1.clickable) === JSON.stringify(el2.clickable) &&
//     JSON.stringify(el1.json) === JSON.stringify(el2.json)

export default Element;
