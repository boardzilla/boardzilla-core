import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { DraggableCore } from 'react-draggable';
import { gameStore } from '../../index.js';
import { Tooltip } from 'react-tooltip';
import uuid from 'uuid-random';
import Drawer from './Drawer.js';

import {
  Piece,
  GameElement,
} from '../../../board/index.js'
import { serialize } from '../../../action/utils.js'

import type { Box, ElementJSON } from '../../../board/element.js';
import type { UIMove } from '../../index.js';
import type { Player } from '../../../player/index.js';
import type { DraggableData, DraggableEvent } from 'react-draggable';

const defaultAppearance = (el: GameElement<Player>) => <div className="bz-default">{el.toString()}</div>;

const Element = ({element, json, selected, onSelectElement, onSelectPlacement, onMouseLeave}: {
  element: GameElement<Player>,
  json: ElementJSON,
  selected: GameElement<Player>[],
  onSelectElement: (moves: UIMove[], ...elements: GameElement<Player>[]) => void,
  onSelectPlacement: ({ column, row }: { column: number, row: number }) => void,
  onMouseLeave?: () => void,
}) => {
  const [previousRenderedState, renderedState, boardSelections, move, position, setZoomable, zoomElement, dragElement, setDragElement, dragOffset, dropSelections, currentDrop, setCurrentDrop, placement, selectPlacement, isMobile, boardJSON] =
    gameStore(s => [s.previousRenderedState, s.renderedState, s.boardSelections, s.move, s.position, s.setZoomable, s.zoomElement, s.dragElement, s.setDragElement, s.dragOffset, s.dropSelections, s.currentDrop, s.setCurrentDrop, s.placement, s.selectPlacement, s.isMobile, s.boardJSON]);

  const [dragging, setDragging] = useState(false); // currently dragging
  const wrapper = useRef<HTMLDivElement>(null);
  const domElement = useRef<HTMLDivElement>(null);
  const branch = useMemo(() => element.branch(), [element, boardJSON]);
  const selections = boardSelections[branch];
  const isSelected = selected.includes(element) || Object.values(move?.args || {}).some(a => a === element || a instanceof Array && a.includes(element));
  const baseClass = element instanceof Piece ? 'Piece' : 'Space';
  const appearance = element._ui.appearance.render || (element.board._ui.disabledDefaultAppearance ? () => null : defaultAppearance);
  const clickable = !dragElement && selections?.clickMoves.length;
  const selectable = !dragElement && selections?.clickMoves.filter(m => m.name.slice(0, 4) !== '_god').length;
  const draggable = !!selections?.dragMoves?.length; // ???
  const droppable = dropSelections.some(move => move.selections[0].boardChoices?.includes(element));
  const placing = useMemo(() => element === placement?.piece, [element, placement])
  const isVisible = useMemo(() => element.isVisible(), [element, boardJSON])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const relativeTransform = useMemo(() => element.relativeTransformToBoard(), [element, element._ui.computedStyle]);
  const absoluteTransform = useMemo(() => element.absoluteTransform(relativeTransform), [element, relativeTransform]);

  const doneMoving = useCallback((style: Box) => {
    element._t.was = branch;
    if (!renderedState[branch]) return;
    renderedState[branch].style = style;
  }, [element, renderedState, branch]);

  const moveTransform = useMemo(() => {
    if (!element._ui.computedStyle || !element._t.was || element.hasSameParent()) return;
    const previous = previousRenderedState.elements[element._t.was];
    if (!previous?.style || previous?.movedTo === branch) {
      //console.log('already moved', element._t.was, previous?.movedTo, branch);
      return; // already processed
    }
    const newPosition = relativeTransform;
    return {
      scaleX: previous.style.width / newPosition.width,
      scaleY: previous.style.height / newPosition.height,
      translateX: (previous.style.left - newPosition.left) / newPosition.width * 100,
      translateY: (previous.style.top - newPosition.top) / newPosition.height * 100,
    };
  }, [element, relativeTransform, branch, previousRenderedState]);

  const onClick = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.stopPropagation();
    if (placing) {
      onSelectPlacement({column: element.column!, row: element.row!});
    } else {
      onSelectElement(selections.clickMoves, element);
    }
  }, [element, onSelectElement, selections, placing, onSelectPlacement]);

  const handleDragStart = useCallback((e: DraggableEvent, data: DraggableData) => {
    e.stopPropagation();
    if (wrapper.current) {
      wrapper.current.setAttribute('data-lastx', String(data.lastX));
      wrapper.current.setAttribute('data-lasty', String(data.lastY))
    }
  }, [wrapper]);

  useEffect(() => {
    if (dragging && dragElement !== branch) setDragging(false);
  }, [dragging, dragElement, branch]);

  const handleDrag = useCallback((e: DraggableEvent, data: DraggableData) => {
    e.stopPropagation();
    if (branch !== dragElement) setDragElement(branch);
    setDragging(true);
    if (wrapper.current && element._ui.computedStyle) {
      wrapper.current.style.top = `calc(${element._ui.computedStyle.top}% - ${parseInt(wrapper.current.getAttribute('data-lasty') || '') - data.y}px)`;
      wrapper.current.style.left = `calc(${element._ui.computedStyle.left}% - ${parseInt(wrapper.current.getAttribute('data-lastx') || '') - data.x}px)`;
    }
  }, [element._ui.computedStyle, wrapper, branch, dragElement, setDragElement]);

  const handleDragStop = useCallback((e: DraggableEvent, data: DraggableData) => {
    e.stopPropagation();
    if (dragging) {
      if (currentDrop) {
        if (wrapper.current) {
          dragOffset.element = branch
          dragOffset.x = data.x - parseInt(wrapper.current.getAttribute('data-lastx') || '');
          dragOffset.y = data.y - parseInt(wrapper.current.getAttribute('data-lasty') || '');
        }
        const move = dropSelections.find(move => move.selections[0].boardChoices?.includes(currentDrop));
        if (move) {
          onSelectElement([move], currentDrop);
          return;
        } else if (wrapper.current && element._ui.computedStyle) {
          wrapper.current.style.top = element._ui.computedStyle.top + '%';
          wrapper.current.style.left = element._ui.computedStyle.left + '%';
        }
      }
      setDragging(false);
      setCurrentDrop(undefined);
      setDragElement(undefined);
    }
  }, [dragging, wrapper, element, currentDrop, dropSelections, onSelectElement, setDragElement, setCurrentDrop, dragOffset, branch]);

  const handleMouseEnter = useCallback(() => {
    if (droppable) setCurrentDrop(element);
    if (element._ui.appearance.zoomable) setZoomable(element)
  }, [droppable, element, setCurrentDrop, setZoomable]);

  const handleMouseLeave = useCallback(() => {
    if (droppable) {
      setCurrentDrop(undefined);
      if (onMouseLeave) onMouseLeave();
    }
    if (element._ui.appearance.zoomable) setZoomable(undefined);
  }, [droppable, element, setCurrentDrop, setZoomable, onMouseLeave]);

  useEffect(() => {
    if (!moveTransform) {
      //console.log(`no move for ${branch}`);
      doneMoving(relativeTransform);
    } else if (wrapper.current) {
      let transformToNew = `translate(${moveTransform.translateX}%, ${moveTransform.translateY}%) scaleX(${moveTransform.scaleX}) scaleY(${moveTransform.scaleY})`;
      previousRenderedState.elements[element._t.was!]!.movedTo = branch;

      //console.log(`moving ${branch} from ${element._t.was}`, moveTransform, transformToNew, element.board._ui.previousStyles[element._t.was || ''], element.relativeTransformToBoard(), element._ui.computedStyle);
      if (dragOffset.element && dragOffset.element === element._t.was) {
        transformToNew = `translate(${dragOffset.x}px, ${dragOffset.y}px) ` + transformToNew;
        dragOffset.element = undefined;
        dragOffset.x = undefined;
        dragOffset.y = undefined;
      }
      const transform = wrapper.current;
      if (transform) {
        // move to 'old' position without animating
        transform.style.transition = 'none';
        transform.style.transform = transformToNew;
        transform.classList.add('animating');
        setTimeout(() => {
          // move to 'new' by removing transform and animate
          transform.style.removeProperty('transition');
          transform.style.removeProperty('transform');
        }, 10);

        const cancel = (e: TransitionEvent) => {
          if (e.propertyName === 'transform' && e.target === wrapper.current) {
            doneMoving(relativeTransform);
            transform.classList.remove('animating');
            transform.removeEventListener('transitionend', cancel);
          }
        };
        transform.addEventListener('transitionend', cancel);
      }
    }
  }, [element, branch, wrapper, relativeTransform, previousRenderedState, moveTransform, doneMoving, dragElement, dragOffset]);

  const handlePlacement = useCallback((event: React.MouseEvent) => {
    const rect = wrapper.current?.getBoundingClientRect();
    if (!rect || !placement) return;
    const layout = placement.layout;
    if (!layout) return;
    const {area, grid} = layout;
    if (!grid || !area) return;
    const pointer = {
      column: Math.max(
        grid.origin.column,
        Math.min(
          grid.origin.column + grid.columns - 1,
          Math.ceil(((event.clientX - rect.x) / rect.width * 100 - grid.anchor.x - area.left) / grid.offsetColumn.x)
        )
      ),
      row: Math.max(
        grid.origin.row,
        Math.min(
          grid.origin.row + grid.rows - 1,
          Math.ceil(((event.clientY - rect.y) / rect.height * 100 - grid.anchor.y - area.top) / grid.offsetRow.y)
        )
      )
    };

    if (placement.piece.row!== pointer.row || placement.piece.column !== pointer.column) {
      selectPlacement(pointer);
    }

  }, [placement, selectPlacement])

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
      wrapper.current.style.zIndex = '';
      wrapper.current.style.transform = 'transform .6s, top .6s, left .6s, width .6s, height .6s';
    }
    if (zoomElement === element && wrapper.current && !wrapper.current?.style.transform) {
      // this is zoomed, calculate zoom transform
      const scale = Math.max(1, Math.min(80 / relativeTransform.height, 80 / relativeTransform.width));
      const left = (50 - scale * relativeTransform.width / 2 - relativeTransform.left) * 100 / relativeTransform.width;
      const top = (50 - scale * relativeTransform.height / 2 - relativeTransform.top) * 100 / relativeTransform.height;
      wrapper.current.style.transition = `none`;
      wrapper.current.style.transform = `translate(${left}%, ${top}%) scale(${scale}) `;
      wrapper.current.style.zIndex = '300';
      wrapper.current.setAttribute('data-zoomed', '1');
    }
  }, [element, zoomElement, relativeTransform]);

  useEffect(() => {
    if (element._ui.appearance.effects) {
      if (!domElement.current) return;
      const callback: MutationCallback = mutations => {
        for (const {attributes, className} of element._ui.appearance.effects as {attributes: Record<string, any>, className: string}[]) {
          if (mutations.some(m => {
            const attr = Object.keys(attributes).find(a => `data-${a.toLowerCase()}` === m.attributeName);
            return attr &&
              m.oldValue !== String(attributes[attr]) &&
              Object.entries(attributes).every(([k, v]) => (m.target as HTMLElement).getAttribute(`data-${k.toLowerCase()}`) === String(v));
          })) {
            domElement.current?.classList.add(className);
          }
        }
      };

      const observer = new MutationObserver(callback);
      observer.observe(domElement.current, {
        attributeFilter: element._ui.appearance.effects.map(e => Object.keys(e.attributes)).flat().map(a => `data-${a.toLowerCase()}`),
        attributeOldValue: true
      });
      return () => observer.disconnect();
    }
  }, [element]);

  if ((element._t.children.length || 0) !== (json.children?.length || 0)) {
    console.error('JSON does not match board. This can be caused by client rendering while server is updating and should fix itself as the final render is triggered.', element, json);
    //throw Error('JSON does not match board');
    return null;
  }

  let contents: React.JSX.Element[] | React.JSX.Element = [];
  for (let l = 0; l !== (element._ui.computedLayouts?.length ?? 0); l++) {
    const layout = element._ui.computedLayouts![l]
    const layoutContents: React.JSX.Element[] = [];
    for (const child of layout.children) {
      if (!child._ui.computedStyle || child._ui.appearance.render === false) continue;
      const childJSON = json.children?.[element._t.children.indexOf(child)];
      if (childJSON) {
        const childBranch = child.branch();
        const key = 'isSpace' in child ? childBranch : (
          renderedState[childBranch]?.key ?? (child._t.was && previousRenderedState.elements[child._t.was]?.key) ?? uuid()
        );
        renderedState[childBranch] ??= { key };

        layoutContents.push(
          <Element
            key={key}
            element={child}
            json={childJSON}
            selected={selected}
            onMouseLeave={droppable ? () => setCurrentDrop(element) : undefined}
            onSelectElement={onSelectElement}
            onSelectPlacement={onSelectPlacement}
          />
        );
      }
    }
    if (layout.drawer) {
      const drawer = layout.drawer!;
      const openContent = typeof drawer.tab === 'function' ? drawer.tab(element) : drawer.tab
      const closedContent = typeof drawer.closedTab === 'function' ? drawer.closedTab(element) : drawer.closedTab ?? openContent;

      contents.push(
        <Drawer
          key={l}
          area={layout.area}
          absoluteAspectRatio={absoluteTransform.width / absoluteTransform.height}
          closeDirection={drawer.closeDirection}
          openIf={drawer.openIf}
          closeIf={drawer.closeIf}
        >
          <Drawer.Open>
            {openContent}
          </Drawer.Open>
          <Drawer.Closed>
            {closedContent}
          </Drawer.Closed>
          {layoutContents}
        </Drawer>
      );
    } else {
      if (layoutContents.length) contents.push(<div key={l} className="layout-wrapper">{layoutContents}</div>);
    }
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

  const attrs = Object.assign({'data-player': element.player?.position}, Object.fromEntries(Object.entries(element).filter(([key, val]) => (
    !['_t', '_ctx', '_ui', '_visible', 'game', 'pile', 'board', '_eventHandlers', 'className'].includes(key) &&
      typeof val !== 'function' && typeof val !== 'object' &&
      (isVisible || (element.constructor as typeof GameElement).visibleAttributes?.includes(key)) // should this be scrubbed during json hydration?
  )).map(([key, val]) => (
    [`data-${key.toLowerCase()}`, serialize(val)]
  ))));

  if (element.player?.position === position) attrs.mine = 'true';

  let boundingBoxes: React.JSX.Element[] = [];
  if (element._ui.computedLayouts) {
    boundingBoxes = element._ui.computedLayouts.filter(layout => layout.showBoundingBox).map((layout, k) => (
      <div key={k + (layout.showBoundingBox || '')} className="bz-show-grid" style={{
        left: layout.area.left + '%',
        top: layout.area.top + '%',
        width: layout.area.width + '%',
        height: layout.area.height + '%',
        // backgroundSize: `${(layout.grid?.offsetColumn.x ?? 100) / layout.area.width * 100}% ${(layout.grid?.offsetRow.y ?? 100) / layout.area.height * 100}%`,
        // backgroundPosition: `calc(${(layout.grid?.anchor.x ?? 0) / layout.area.width * 10000}% - 1px) calc(${(layout.grid?.anchor.y ?? 0) / layout.area.height * 10000}% - 1px)`
      }}>
        <span>{layout.showBoundingBox}</span>
      </div>
    ));
  }

  // "base" semantic GameElement dom element
  contents = (
    <div
      id={element.name}
      ref={domElement}
      className={classNames(
        baseClass,
        element._ui.appearance.className,
        {
          [element.constructor.name]: baseClass !== element.constructor.name,
          selected: isSelected,
          clickable, selectable, droppable,
        }
      )}
      onClick={clickable || placing ? onClick : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={placement?.into === element ? handlePlacement : undefined}
      {...attrs}
    >
      {boundingBoxes}
      {appearance(element)}
      {contents}
    </div>
  );

  // wrapper dom element for transforms and animations
  contents = (
    <div
      ref={wrapper}
      className={classNames("transform-wrapper", { dragging, placing })}
      style={{ ...style }}
      data-tooltip-id={branch}
      data-tooltip-delay-show={500}
    >
      {contents}
    </div>
  );

  if (!isMobile && element instanceof Piece) {
    contents = (
      <DraggableCore
        disabled={!draggable}
        onStart={handleDragStart}
        onDrag={handleDrag}
        onStop={handleDragStop}
      >
        {contents}
      </DraggableCore>
    );
  }

  if (element._ui.appearance.tooltip) {
    const tooltip = element._ui.appearance.tooltip(element);
    if (tooltip) contents = (
      <>
        {contents}
        <Tooltip id={branch} className='tooltip' disableStyleInjection={true}>
          {tooltip}
        </Tooltip>
      </>
    );
  }

  //if (!element._t.parent) console.log('GAMEELEMENTS render');

  return contents;
};
// would like to memo but not yet clear how well this work - dont optimize yet
// memo(... (el1, el2) => (
//   JSON.stringify(el1.clickable) === JSON.stringify(el2.clickable) &&
//     JSON.stringify(el1.json) === JSON.stringify(el2.json)

export default Element;
