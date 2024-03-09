import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { DraggableCore } from 'react-draggable';
import { gameStore } from '../../index.js';
import uuid from 'uuid-random';
import Drawer from './Drawer.js';

import {
  Piece,
  GameElement,
} from '../../../board/index.js'
import { serialize } from '../../../action/utils.js'

import type { ElementJSON } from '../../../board/element.js';
import type { UIMove } from '../../lib.js';
import type { DraggableData, DraggableEvent } from 'react-draggable';

const defaultAppearance = (el: GameElement) => <div className="bz-default">{el.toString()}</div>;

const Element = ({element, json, mode, onSelectElement, onMouseLeave}: {
  element: GameElement,
  json: ElementJSON,
  mode: 'game' | 'info' | 'zoom'
  onSelectElement: (moves: UIMove[], ...elements: GameElement[]) => void,
  onMouseLeave?: () => void,
}) => {
  const [previousRenderedState, renderedState, boardSelections, move, selected, position, setInfoElement, setError, dragElement, setDragElement, dragOffset, dropSelections, currentDrop, setCurrentDrop, placement, setPlacement, selectPlacement, isMobile, boardJSON] =
    gameStore(s => [s.previousRenderedState, s.renderedState, s.boardSelections, s.move, s.selected, s.position, s.setInfoElement, s.setError, s.dragElement, s.setDragElement, s.dragOffset, s.dropSelections, s.currentDrop, s.setCurrentDrop, s.placement, s.setPlacement, s.selectPlacement, s.isMobile, s.boardJSON]);

  const [dragging, setDragging] = useState(false); // currently dragging
  const [positioning, setPositioning] = useState(false); // currently positioning within a placePiece
  const wrapper = useRef<HTMLDivElement | null>(null);
  const domElement = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const branch = useMemo(() => element.branch(), [element, boardJSON]);

  const isSelected = mode === 'game' && (selected?.includes(element) || Object.values(move?.args || {}).some(a => a === element || a instanceof Array && a.includes(element)));
  const baseClass = element instanceof Piece ? 'Piece' : 'Space';
  const appearance = element._ui.appearance.render || (element.game._ui.disabledDefaultAppearance ? () => null : defaultAppearance);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const isVisible = useMemo(() => element.isVisible(), [element, boardJSON])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const relativeTransform = useMemo(() => element.relativeTransformToBoard(), [element, element._ui.computedStyle]);
  const absoluteTransform = useMemo(() => element.absoluteTransform(relativeTransform), [element, relativeTransform]);

  const selections = boardSelections[branch];
  const invalidSelectionError = mode === 'game' && selections?.error;
  const clickable = mode === 'game' && !invalidSelectionError && !dragElement && selections?.clickMoves.length;
  const selectable = mode === 'game' && !invalidSelectionError && !dragElement && selections?.clickMoves.filter(m => m.name.slice(0, 4) !== '_god').length;
  const draggable = mode === 'game' && !invalidSelectionError && !!selections?.dragMoves?.length; // ???
  const droppable = mode === 'game' && dropSelections.some(move => move.selections[0].boardChoices?.includes(element));
  const placing = useMemo(() => element === placement?.piece && !placement?.selected, [element, placement])

  const previousRender = useMemo(() => {
    if (element.hasChangedParent()) {
      const previousRender = previousRenderedState.elements[element._t.was!];
      if (previousRender && previousRender.movedTo !== branch) return previousRender;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, branch, previousRenderedState, boardJSON]);

  const newAttrs = Object.assign({'data-player': element.player?.position}, Object.fromEntries(Object.entries(element).filter(([key, val]) => (
    !GameElement.unserializableAttributes.includes(key) &&
      typeof val !== 'function' && typeof val !== 'object' &&
      (isVisible || (element.constructor as typeof GameElement).visibleAttributes?.includes(key)) // should this be scrubbed during json hydration?
  )).map(([key, val]) => (
    [`data-${key.toLowerCase()}`, serialize(val)]
  ))));

  if (element.player?.position === position) newAttrs['data-mine'] = 'true';

  const attrs = previousRender?.attrs ?? newAttrs;

  const moveTransform = useMemo(() => {
    if (!previousRender?.style || positioning || mode === 'zoom') {
      //console.log('already moved', !!previousRender, previousRender?.movedTo, branch);
      return;
    }
    const newPosition = relativeTransform;
    return {
      scaleX: previousRender.style.width / newPosition.width,
      scaleY: previousRender.style.height / newPosition.height,
      translateX: (previousRender.style.left + previousRender.style.width / 2 - newPosition.left - newPosition.width / 2) / newPosition.width * 100,
      translateY: (previousRender.style.top + previousRender.style.height / 2 - newPosition.top - newPosition.height / 2) / newPosition.height * 100,
      rotate: (previousRender.style.rotation ?? 0) - (element._rotation ?? 0)
    };
  }, [relativeTransform, previousRender, mode, positioning, element]);

  useEffect(() => {
    if (placing && moveTransform) setPositioning(true);
  }, [placing, moveTransform]);

  useEffect(() => {
    const node = wrapper.current;
    if (node?.style.getPropertyValue('--transformed-to-old')) {
      node?.scrollTop; // force reflow
      // move to 'new' by removing transform and animate
      if (node.classList.contains('animating')) return;
      node.classList.add('animating');
      node.style.removeProperty('--transformed-to-old');
      node.style.removeProperty('transform');
      if (domElement.current) {
        for (const [k, v] of Object.entries(newAttrs)) domElement.current.setAttribute(k, v);
        for (const attr of domElement.current.getAttributeNames()) {
          if (attr.slice(0, 5) === 'data-' && newAttrs[attr] === undefined) {
            domElement.current.removeAttribute(attr);
          }
        }
      }
      const cancel = (e: TransitionEvent) => {
        if (e.propertyName === 'transform' && e.target === node) {
          node.classList.remove('animating');
          node.removeEventListener('transitionend', cancel);
        }
      };
      node.addEventListener('transitionend', cancel);
    }
  }, [element, newAttrs]);

  const handleClick = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.stopPropagation();
    if (placing) {
      selectPlacement({column: element.column!, row: element.row!, rotation: element._rotation});
    } else if (invalidSelectionError) {
      setError(invalidSelectionError)
    } else {
      onSelectElement(selections.clickMoves, element);
    }
  }, [element, onSelectElement, selections, placing, invalidSelectionError, setError, selectPlacement]);

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
  }, [droppable, element, setCurrentDrop]);

  const handleMouseLeave = useCallback(() => {
    if (droppable) {
      setCurrentDrop(undefined);
      if (onMouseLeave) onMouseLeave();
    }
  }, [droppable, setCurrentDrop, onMouseLeave]);

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
          Math.floor(((event.clientX - rect.x) / rect.width * 100 - grid.anchor.x - area.left) / grid.offsetColumn.x) + grid.origin.column
        )
      ),
      row: Math.max(
        grid.origin.row,
        Math.min(
          grid.origin.row + grid.rows - 1,
          Math.floor(((event.clientY - rect.y) / rect.height * 100 - grid.anchor.y - area.top) / grid.offsetRow.y) + grid.origin.row
        )
      ),
    };

    if (placement.piece.row !== pointer.row || placement.piece.column !== pointer.column) {
      setPlacement(pointer);
    }

  }, [placement, setPlacement])

  const handleRotate = useCallback((direction: number) => {
    const choices = placement?.rotationChoices;
    if (!choices) return;
    let rotation = choices[
      (choices.indexOf(element.rotation!) + direction + choices.length) % placement!.rotationChoices!.length
    ];
    rotation += Math.round(((element._rotation ?? 0) - rotation) / 360) * 360;

    setPlacement({
      row: element.row ?? 1,
      column: element.column ?? 1,
      rotation
    })
  }, [element, placement, setPlacement])

  let style = useMemo(() => {
    if (mode === 'zoom') return {
      left: 0,
      top: 0,
      width: '100%',
      height: '100%'
    }

    let styleBuilder: React.CSSProperties = {};
    const { computedStyle } = element._ui;

    if (computedStyle) {
      styleBuilder = Object.fromEntries(Object.entries(computedStyle).map(([key, val]) => ([key, `${val}%`])));
    }

    if (dragging) {
      delete styleBuilder.left;
      delete styleBuilder.top;
    }

    if (moveTransform) {
      let transformToNew = `translate(${moveTransform.translateX}%, ${moveTransform.translateY}%) scaleX(${moveTransform.scaleX}) scaleY(${moveTransform.scaleY}) rotate(${moveTransform.rotate}deg)`;

      if (previousRenderedState.elements[element._t.was!]) previousRenderedState.elements[element._t.was!].movedTo = branch;
      if (dragOffset.element && dragOffset.element === element._t.was) {
        transformToNew = `translate(${dragOffset.x}px, ${dragOffset.y}px) ` + transformToNew;
        dragOffset.element = undefined;
        dragOffset.x = undefined;
        dragOffset.y = undefined;
      }

      styleBuilder.transform = transformToNew;
      Object.assign(styleBuilder, {'--transformed-to-old': String(uuid())});
    }
    styleBuilder.fontSize = absoluteTransform.height * 0.04 + 'rem'

    if (element._rotation !== undefined) styleBuilder.transform = (styleBuilder.transform ?? '') + `rotate(${element._rotation}deg)`;

    return styleBuilder;
  }, [element, dragging, mode, moveTransform, branch, dragOffset, previousRenderedState, absoluteTransform]);

  useEffect(() => {
    if (element._ui.appearance.effects) {
      if (!domElement.current) return;
      const callback: MutationCallback = mutations => {
        for (const {attributes, name} of element._ui.appearance.effects as {attributes: Record<string, any>, name: string}[]) {
          if (mutations.some(m => {
            const attr = Object.keys(attributes).find(a => `data-${a.toLowerCase()}` === m.attributeName);
            return attr &&
              m.oldValue !== String(attributes[attr]) &&
              Object.entries(attributes).every(([k, v]) => (m.target as HTMLElement).getAttribute(`data-${k.toLowerCase()}`) === String(v));
          })) {
            domElement.current?.classList.add(name);
            domElement.current?.setAttribute('data-bz-effect', name);
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

  const info = useMemo(() => {
    if (mode === 'info') {
      return typeof element._ui.appearance.info === 'function' ? element._ui.appearance.info(element) : element._ui.appearance.info;
    }
  }, [mode, element]);

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
          renderedState[childBranch]?.key || (child._t.was && !child.hasChangedParent() && previousRenderedState.elements[child._t.was]?.key) || uuid()
        );
        renderedState[childBranch] ??= { key };

        layoutContents.push(
          <Element
            key={key}
            element={child}
            json={childJSON}
            mode={mode === 'zoom' ? 'game' : mode}
            onMouseLeave={droppable ? () => setCurrentDrop(element) : undefined}
            onSelectElement={onSelectElement}
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

  if (element._ui.appearance.connections && element._t.graph) {
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
      const source = args[4].space as GameElement;
      const target = args[5].space as GameElement;

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

  let boundingBoxes: React.JSX.Element[] = [];
  if (element._ui.computedLayouts) {
    boundingBoxes = element._ui.computedLayouts.filter(layout => layout.showBoundingBox).map((layout, k) => (
      <div key={k} className="bz-show-grid" style={{
        left: layout.area.left + '%',
        top: layout.area.top + '%',
        width: layout.area.width + '%',
        height: layout.area.height + '%',
        // backgroundSize: `${(layout.grid?.offsetColumn.x ?? 100) / layout.area.width * 100}% ${(layout.grid?.offsetRow.y ?? 100) / layout.area.height * 100}%`,
        // backgroundPosition: `calc(${(layout.grid?.anchor.x ?? 0) / layout.area.width * 10000}% - 1px) calc(${(layout.grid?.anchor.y ?? 0) / layout.area.height * 10000}% - 1px)`
      }}>
        {typeof layout.showBoundingBox === 'string' && <span>{layout.showBoundingBox}</span>}
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
          selected: isSelected && mode === 'game',
          clickable: clickable || invalidSelectionError,
          invalid: !!invalidSelectionError || (placing && placement?.invalid),
          selectable,
          droppable
        }
      )}
      style={element.player ? {['--player-color' as string]: element.player.color} : {}}
      onClick={clickable || placing || invalidSelectionError ? handleClick : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={placement?.into === element && !placement.selected ? handlePlacement : undefined}
      {...attrs}
    >
      {appearance(element)}
      {boundingBoxes}
      {contents}
    </div>
  );

  // wrapper dom element for transforms and animations
  contents = (
    <div
      ref={wrapper}
      className={classNames("transform-wrapper", { dragging, placing, 'has-info': !!info })}
      style={style}
    >
      {contents}
      {!!info && <div className="info-hotspot" onClick={() => setInfoElement({ info, element })}/>}
    </div>
  );
  if (placing && placement?.rotationChoices) {
    contents = (
      <>
        {contents}
        <div className="rotator" style={{...style, transform: undefined }}>
          <div className="left" onClick={() => handleRotate(-1)}>
            <svg
              viewBox="0 0 254.2486 281.95978"
              xmlns="http://www.w3.org/2000/svg">
              <g
                transform="translate(43.69768,-47.016626)">
                <path
                  d="m 135.24991,227.00186 -76.975589,76.97558 -76.97559,-76.97558 53.43953,0.48619 c 0,-102.89725 56.23959,-155.471424 150.812659,-155.471424 l -0.0693,38.606184 c -67.82216,0 -113.184769,38.35922 -113.184769,117.17431 z"
                />
              </g>
            </svg>
          </div>
          <div className="right" onClick={() => handleRotate(1)}>
            <svg
              viewBox="0 0 254.2486 281.95978"
              xmlns="http://www.w3.org/2000/svg">
              <g
                transform="translate(210,-47.016626) scale(-1 1)">
                <path
                  d="m 135.24991,227.00186 -76.975589,76.97558 -76.97559,-76.97558 53.43953,0.48619 c 0,-102.89725 56.23959,-155.471424 150.812659,-155.471424 l -0.0693,38.606184 c -67.82216,0 -113.184769,38.35922 -113.184769,117.17431 z"
                />
              </g>
            </svg>
          </div>
        </div>
      </>
    );
  }

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

  //console.log('GAMEELEMENTS render', element.name);

  element._t.was = branch;
  //console.log('doneMoving', branch);
  if (renderedState[branch]) {
    renderedState[branch].style = relativeTransform ?? {};
    renderedState[branch].style!.rotation = element._rotation;
    renderedState[branch].attrs = newAttrs;
  }

  return contents;
};
// would like to memo but not yet clear how well this work - dont optimize yet
// memo(... (el1, el2) => (
//   JSON.stringify(el1.clickable) === JSON.stringify(el2.clickable) &&
//     JSON.stringify(el1.json) === JSON.stringify(el2.json)

export default Element;
