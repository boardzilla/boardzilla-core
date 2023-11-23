import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { DraggableCore } from 'react-draggable';
import { gameStore } from '../../index.js';

import {
  Piece,
  GameElement,
} from '../../../board/index.js'
import { serialize, humanizeArg } from '../../../action/utils.js'

import type { ElementJSON } from '../../../board/element.js';
import type { PendingMove } from '../../../game.js';
import type { Player } from '../../../player/index.js';
import type { DraggableData } from 'react-draggable';

const elementAttributes = (el: GameElement<Player>) => {
  return Object.fromEntries(Object.entries(el).filter(([key, val]) => (
    !['_t', '_ctx', '_ui', 'name', '_visible', 'game', 'pile', 'board', '_eventHandlers', 'className'].includes(key) && typeof val !== 'function' && typeof val !== 'object'
  )).map(([key, val]) => (
    [`data-${key.toLowerCase()}`, serialize(val)]
  )));
}

const defaultAppearance = (el: GameElement<Player>) => <div className="bz-default">{humanizeArg(el)}</div>;

const Element = ({element, json, selected, onSelectElement, onMouseLeave}: {
  element: GameElement<Player>,
  json: ElementJSON,
  selected: GameElement<Player>[],
  onSelectElement: (moves: PendingMove<Player>[], ...elements: GameElement<Player>[]) => void,
  onMouseLeave?: () => void,
}) => {
  const [game, boardSelections, move, position, dragElement, setDragElement, dropElements, currentDrop, setCurrentDrop, setZoomable, zoomElement] = gameStore(s => [s.game, s.boardSelections, s.move, s.position, s.dragElement, s.setDragElement, s.dropElements, s.currentDrop, s.setCurrentDrop, s.setZoomable, s.zoomElement, s.boardJSON]);
  const [dragging, setDragging] = useState(false); // currently dragging
  const [animatedFrom, setAnimatedFrom] = useState<string>(); // track position animated from to prevent client and server update both triggering same animation
  const wrapper = useRef<HTMLDivElement>(null);
  const branch = element.branch()
  const selections = boardSelections[branch];
  const isSelected = selected.includes(element) || Object.values(move?.args || {}).some(a => a === element || a instanceof Array && a.includes(element));
  const baseClass = element instanceof Piece ? 'Piece' : 'Space';
  const appearance = element._ui.appearance.render || (element.board._ui.disabledDefaultAppearance ? () => null : defaultAppearance);
  const absoluteTransform = element.absoluteTransform();
  const clickable = !dragElement && selections?.clickMoves.length;
  const selectable = !dragElement && selections?.clickMoves.filter(m => m.action.slice(0, 4) !== '_god').length;
  const draggable = !!selections?.dragMoves.length; // ???
  const droppable = dropElements.find(({ element }) => element === branch);

  const onClick = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.stopPropagation();
    onSelectElement(selections.clickMoves, element);
  }, [element, onSelectElement, selections]);

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
  }, [element._ui.computedStyle, setDragElement, branch, wrapper]);

  const onStopDrag = useCallback((e: MouseEvent, data: DraggableData) => {
    e.stopPropagation();
    if (dragging) {
      if (wrapper.current && element._ui.computedStyle) {
        wrapper.current.style.top = element._ui.computedStyle.top + '%';
        wrapper.current.style.left = element._ui.computedStyle.left + '%';
      }
      if (currentDrop) {
        const move = dropElements.find(({ element }) => element === currentDrop)?.move;
        if (move) onSelectElement([move], element, game!.board.atBranch(currentDrop));
        if (wrapper.current) {
          element.board._ui.dragOffset[element.branch()] = {
            x: data.x - parseInt(wrapper.current.getAttribute('data-lastx') || ''),
            y: data.y - parseInt(wrapper.current.getAttribute('data-lasty') || ''),
          }
        }
      }
    }
    setDragging(false);
    setCurrentDrop(undefined);
    setDragElement(undefined);
  }, [dragging, currentDrop, onSelectElement, wrapper, dropElements, element, game, setCurrentDrop, setDragElement]);

  const onDrop = useCallback(() => {
    setCurrentDrop(branch);
  }, [setCurrentDrop, branch]);

  const onLeave = useCallback(() => {
    setCurrentDrop(undefined);
  }, [setCurrentDrop]);

  useEffect(() => {
    const moveTransform = element.getMoveTransform();
    if (!moveTransform || animatedFrom === element._t.was) {
      //console.log(moveTransform ? `not moving ${branch} - already moved from ${element._t.was}` : `no move for ${branch}`);
      element.doneMoving();
    } else if (wrapper.current) {
      //console.log(`moving ${branch} from ${element._t.was}`, moveTransform);
      let transformToNew = `translate(${moveTransform.translateX}%, ${moveTransform.translateY}%) scaleX(${moveTransform.scaleX}) scaleY(${moveTransform.scaleY})`;
      if (element.board._ui.dragOffset[branch]) {
        transformToNew = `translate(${element.board._ui.dragOffset[branch].x}px, ${element.board._ui.dragOffset[branch].y}px) ` + transformToNew;
        delete element.board._ui.dragOffset[branch];
      }
      // move to 'old' position without animating
      wrapper.current!.style.transition = 'none';
      wrapper.current!.style.transform = transformToNew;
      wrapper.current!.classList.add('animating');
      setTimeout(() => {
        // move to 'new' by removing transform and animate
        wrapper.current!.style.removeProperty('transition');
        wrapper.current!.style.removeProperty('transform');
      }, 0);
      setAnimatedFrom(element._t.was);

      const cancel = (e: TransitionEvent) => {
        if (e.propertyName === 'transform' && e.target === wrapper.current) {
          element.doneMoving();
          wrapper.current!.classList.remove('animating');
          setAnimatedFrom(undefined);
          wrapper.current!.removeEventListener('transitionend', cancel);
        }
      };
      wrapper.current?.addEventListener('transitionend', cancel);
    }
  }, [element, branch, wrapper, animatedFrom])

  let style = useMemo(() => {
    let styleBuilder: React.CSSProperties = {};
    const { computedStyle } = element._ui;

    if (computedStyle) {
      styleBuilder = Object.fromEntries(Object.entries(computedStyle).map(([key, val]) => ([key, `${val}%`])));
    }
    if (dragging) {
      delete styleBuilder.left;
      delete styleBuilder.top;
    }
    styleBuilder.fontSize = absoluteTransform.height * 0.04 + 'rem'

    return styleBuilder;
  }, [element, dragging, absoluteTransform]);

  useEffect(() => {
    if (zoomElement !== element && wrapper.current?.getAttribute('data-zoomed')) {
      // no longer zoomed - go back to normal size
      wrapper.current.removeAttribute('data-zoomed');
      wrapper.current.style.transform = '';
    }
    if (zoomElement !== element && zoomElement && wrapper.current?.style.zIndex) {
      // something else is zoomed - go back to normal z-index so we don't overlap it
      wrapper.current.style.zIndex = '';
    }
    if (zoomElement === element && wrapper.current && !wrapper.current?.style.transform) {
      // this is zoomed, calculate zoom transform
      const transform = element.relativeTransformToBoard();
      const scale = Math.max(1, Math.min(80 / transform.height, 80 / transform.width));
      const left = (50 - scale * transform.width / 2 - transform.left) * 100 / transform.width;
      const top = (50 - scale * transform.height / 2 - transform.top) * 100 / transform.height;
      wrapper.current.style.transform = `translate(${left}%, ${top}%) scale(${scale}) `;
      wrapper.current.style.zIndex = '300';
      wrapper.current.setAttribute('data-zoomed', '1');
      const cancel = (e: TransitionEvent) => {
        if (e.propertyName === 'transform' && e.target === wrapper.current && !wrapper.current?.style.transform && wrapper.current?.style.zIndex) {
          wrapper.current.style.zIndex = '';
          wrapper.current!.removeEventListener('transitionend', cancel);
        }
      };
      wrapper.current?.addEventListener('transitionend', cancel);
    }
  }, [element, zoomElement]);

  let contents: React.JSX.Element[] | React.JSX.Element = [];
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
    const lines: React.JSX.Element[] = [];
    const labels: React.JSX.Element[] = [];
    element._t.graph.forEachEdge((...args) => {
      const source = args[4].space as GameElement<Player>;
      const target = args[5].space as GameElement<Player>;

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
              className="outer"
              x1={origin.x} y1={origin.y}
              x2={destination.x} y2={destination.y}
              transform={`translate(${(origin.y - destination.y) / distance * thickness!}, ${(origin.x - destination.x) / distance * -thickness!})`}
              strokeWidth={thickness!} stroke={color}
            />
          );
          lines.push(
            <line key={i++}
              className="outer"
              x1={origin.x} y1={origin.y}
              x2={destination.x} y2={destination.y}
              transform={`translate(${(origin.y - destination.y) / distance * -thickness!}, ${(origin.x - destination.x) / distance * thickness!})`}
              strokeWidth={thickness!} stroke={color}
            />
          );
        }
        lines.push(
          <line key={i++}
            className="inner"
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
            >{label({ distance: args[1].distance, to: args[4].space, from: args[5].space })}</g>);
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
          clickable, selectable, droppable,
        }
      )}
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => { if (droppable) onDrop(); if (element._ui.appearance.zoomable) setZoomable(element) }}
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
      className={classNames("transform-wrapper", { dragging })}
      style={{ ...style }}
    >
      {contents}
    </div>
  );

  contents = (
    <DraggableCore
      disabled={!draggable}
      onStart={onStartDrag}
      onDrag={onDrag}
      onStop={onStopDrag}
    >
      {contents}
    </DraggableCore>
  );

  //if (!element._t.parent) console.log('GAMEELEMENTS render');

  return contents;
};
// would like to memo but not yet clear how well this work - dont optimize yet
// memo(... (el1, el2) => (
//   JSON.stringify(el1.clickable) === JSON.stringify(el2.clickable) &&
//     JSON.stringify(el1.json) === JSON.stringify(el2.json)

export default Element;
