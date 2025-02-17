import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { DraggableCore } from 'react-draggable';
import { gameStore } from '../../store.js';

import {
  Piece,
  GameElement,
  type Game,
  type Box,
} from '../../../board/index.js'
import Drawer from './Drawer.js';
import Tabs from './Tabs.js';
import Popout from './Popout.js';

import type { UIMove } from '../../lib.js';
import type { DraggableData, DraggableEvent } from 'react-draggable';
import type { DirectedGraph } from 'graphology';
import type { UIRender } from '../../render.js';

const defaultAppearance = (el: GameElement) => <div className="bz-default">{el.toString()}</div>;

const Element = ({render, mode, onSelectElement, onMouseLeave}: {
  render: UIRender,
  mode: 'game' | 'info' | 'zoom'
  onSelectElement: (moves: UIMove[], ...elements: GameElement[]) => void,
  onMouseLeave?: () => void,
}) => {

  const [rendered, setInfoElement, setError, dragElement, setDragElement, dragOffset, dropSelections, currentDrop, setCurrentDrop, placement, setPlacement, selectPlacement, isMobile, dev] =
    gameStore(s => [s.rendered, s.setInfoElement, s.setError, s.dragElement, s.setDragElement, s.dragOffset, s.dropSelections, s.currentDrop, s.setCurrentDrop, s.placement, s.setPlacement, s.selectPlacement, s.isMobile, s.dev]);

  const [element, branch] = useMemo(() => [render.element, render.element.branch()], [render]);
  // TODO future style put all store derived values here and add memo()
  const [boardSelections, isSelected] = gameStore(s => [
    s.boardSelections[branch],
    mode === 'game' && (s.selected?.includes(element) || Object.values(s.move?.args || {}).some(a => a === element || a instanceof Array && a.includes(element)))
  ]);
  const absolutePosition = useMemo(() => rendered!.all[String(element._t.ref)].pos!, [element, rendered]);

  const [dragging, setDragging] = useState<{ deltaY: number, deltaX: number } | undefined>(); // currently dragging
  const [positioning, setPositioning] = useState(false); // currently positioning within a placePiece
  const wrapper = useRef<HTMLDivElement | null>(null);
  const domElement = useRef<HTMLDivElement>(null);

  const appearance = element._ui.appearance.render || (element.game._ui.disabledDefaultAppearance ? () => null : defaultAppearance);

  const invalidSelectionError = mode === 'game' && boardSelections?.error;
  const clickable = mode === 'game' && !invalidSelectionError && !dragElement && boardSelections?.clickMoves.length;
  const selectable = mode === 'game' && !invalidSelectionError && !dragElement && boardSelections?.clickMoves.filter(m => m.name.slice(0, 4) !== '_god').length;
  const draggable = mode === 'game' && !invalidSelectionError && !!boardSelections?.dragMoves?.length; // ???
  const droppable = mode === 'game' && dropSelections.some(move => move.selections[0].resolvedChoices?.find(c => c.choice === element));
  const placing = useMemo(() => element === placement?.piece && !placement?.selected, [element, placement])
  const gridSizeNeeded = useMemo(() => (
    placement?.into._sizeNeededFor(placement.piece) ?? {width: 1, height: 1}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [placement?.piece.rotation, placement?.piece.row, placement?.piece.column, placement?.into]);

  const attrs = render.previousDataAttributes || render.dataAttributes;

  // directly on the dom: remove the temporary transform-to-old position and set all new attr's
  useEffect(() => {
    const node = wrapper.current;
    if (node?.style.getPropertyValue('--transformed-to-old')) {
      //console.log('transform remove', element.branch(), node.style.getPropertyValue('transform'), render.previousDataAttributes);
      node.style.removeProperty('--transformed-to-old');
      if (domElement.current && render.previousDataAttributes) {
        for (const [k, v] of Object.entries(render.dataAttributes!)) domElement.current.setAttribute(k, v);
        for (const attr of domElement.current.getAttributeNames()) {
          if (attr.slice(0, 5) === 'data-' && render.dataAttributes![attr] === undefined) {
            domElement.current.removeAttribute(attr);
          }
        }
        if (render.effectClasses !== undefined) {
          domElement.current.setAttribute('class', domElement.current.getAttribute('class') + ' ' + render.effectClasses);
        }
        delete render.previousAttributes;
        delete render.previousDataAttributes;
      }
      if (node.style.getPropertyValue('transform')) {
        node?.scrollTop; // force reflow
        // move to 'new' by removing transform and animate
        node.classList.add('animating');
        if (render.crossParent) node.classList.add('cross-parent');
        node.style.removeProperty('transition');
        node.style.removeProperty('transform');
        const cancel = (e: TransitionEvent) => {
          if (e.propertyName === 'transform' && e.target === node) {
            node.classList.remove('animating', 'cross-parent');
            node.removeEventListener('transitionend', cancel);
            if (render.proxy && domElement.current) {
              domElement.current.style.transform = (domElement.current.style.transform ?? '') + ' scale(0)';
            }
          }
        };
        node.addEventListener('transitionend', cancel);
        if (render.styles?.transform) delete render.styles.transform;
      }
    }
    delete render.mutated;
  }, [element, render]);

  useEffect(() => {
    if (dragging && dragElement !== branch) setDragging(undefined);
  }, [dragging, dragElement, branch]);

  const handleClick = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.stopPropagation();
    if (placing) {
      selectPlacement({column: element.column!, row: element.row!, rotation: element._rotation});
    } else if (invalidSelectionError) {
      setError(invalidSelectionError)
    } else {
      onSelectElement(boardSelections.clickMoves, element);
    }
  }, [element, onSelectElement, boardSelections, placing, invalidSelectionError, setError, selectPlacement]);

  const handleDragStart = useCallback((e: DraggableEvent, data: DraggableData) => {
    e.stopPropagation();
    if (wrapper.current) {
      wrapper.current.setAttribute('data-lastx', String(data.lastX));
      wrapper.current.setAttribute('data-lasty', String(data.lastY))
    }
  }, [wrapper]);

  const handleDrag = useCallback((e: DraggableEvent, data: DraggableData) => {
    e.stopPropagation();
    if (wrapper.current) {
      const deltaY = parseInt(wrapper.current.getAttribute('data-lasty') || '') - data.y;
      const deltaX = parseInt(wrapper.current.getAttribute('data-lastx') || '') - data.x;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 5) {
        if (branch !== dragElement) setDragElement(branch);
        setDragging({deltaY, deltaX});
      }
    }
  }, [wrapper, branch, dragElement, setDragElement]);

  const handleDragStop = useCallback((e: DraggableEvent, data: DraggableData) => {
    e.stopPropagation();
    if (dragging) {
      if (currentDrop) {
        if (wrapper.current) {
          dragOffset.ref = element._t.ref;
          dragOffset.x = data.x - parseInt(wrapper.current.getAttribute('data-lastx') || '');
          dragOffset.y = data.y - parseInt(wrapper.current.getAttribute('data-lasty') || '');
        }
        const move = dropSelections.find(move => move.selections[0].resolvedChoices?.find(c => c.choice === currentDrop));
        if (move) {
          onSelectElement([move], currentDrop);
          return;
        } else if (wrapper.current && render.styles) {
          wrapper.current.style.top = render.styles.top as string;
          wrapper.current.style.left = render.styles.left as string;
        }
      }
      setDragging(undefined);
      setCurrentDrop(undefined);
      setDragElement(undefined);
    }
  }, [dragging, wrapper, render, currentDrop, dropSelections, onSelectElement, setDragElement, setCurrentDrop, dragOffset, element._t.ref]);

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
      column: ((event.clientX - rect.x) / rect.width * 100 - grid.anchor.x - area.left) / grid.offsetColumn.x + grid.origin.column,
      row: ((event.clientY - rect.y) / rect.height * 100 - grid.anchor.y - area.top) / grid.offsetRow.y + grid.origin.row
    };

    let newPlacement: {column: number, row: number};
    if (placement.piece.row === undefined || placement.piece.column === undefined) {
      newPlacement = {
        column: Math.round(pointer.column - gridSizeNeeded.width / 2),
        row: Math.round(pointer.row - gridSizeNeeded.height / 2),
      }
    } else {
      newPlacement = {column: placement.piece.column, row: placement.piece.row};
      if (pointer.column < placement.piece.column) {
        newPlacement.column = Math.max(grid.origin.column, Math.floor(pointer.column));
      } else if (pointer.column - gridSizeNeeded.width + 1 > placement.piece.column) {
        newPlacement.column = Math.min(
          grid.origin.column + grid.columns - gridSizeNeeded.width,
          Math.floor(pointer.column - gridSizeNeeded.width + 1)
        );
      }
      if (pointer.row < placement.piece.row) {
        newPlacement.row = Math.max(grid.origin.row, Math.floor(pointer.row));
      } else if (pointer.row - gridSizeNeeded.height + 1 > placement.piece.row) {
        newPlacement.row = Math.min(
          grid.origin.row + grid.rows - gridSizeNeeded.height,
          Math.floor(pointer.row - gridSizeNeeded.height + 1)
        );
      }
    }
    if (newPlacement.column !== undefined) {
      newPlacement.column = Math.max(grid.origin.column,
        Math.min(grid.origin.column + grid.columns - gridSizeNeeded.width,
          Math.floor(newPlacement.column)
        )
      );
    }
    if (newPlacement.row !== undefined) {
      newPlacement.row = Math.max(grid.origin.row,
        Math.min(grid.origin.row + grid.rows - gridSizeNeeded.height,
          Math.floor(newPlacement.row)
        )
      );
    }
    if (newPlacement.column !== placement.piece.column || newPlacement.row !== placement.piece.row) {
      setPlacement(newPlacement);
    }

  }, [placement, setPlacement, gridSizeNeeded])

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

  let styles = useMemo(() => {
    if (mode === 'zoom') return {
      left: 0,
      top: 0,
      width: '100%',
      height: '100%'
    }

    let styles = render.styles!;
    if (positioning) delete styles.transform;

    if (dragging && styles.transform) {
      styles = {
        ...styles,
        top: `calc(${styles.top} - ${dragging.deltaY}px)`,
        left: `calc(${styles.left} - ${dragging.deltaX}px)`,
      }
    }

    if (styles.transform && dragOffset.ref === element._t.ref) {
      // offset by the last drag position to prevent jump back to original position
      styles = {
        ...styles,
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) ` + styles.transform
      };
      dragOffset.ref = undefined;
      dragOffset.x = undefined;
      dragOffset.y = undefined;
    }

    return styles;
  }, [element, render, positioning, dragging, mode, dragOffset]);

  useEffect(() => {
    if (placing && styles.transform) setPositioning(true);
  }, [placing, styles.transform]);

  const info = useMemo(() => {
    if (mode === 'info') {
      return typeof element._ui.appearance.info === 'function' ? element._ui.appearance.info(element) : element._ui.appearance.info;
    }
  }, [mode, element]);

  let contents: React.JSX.Element[] | React.JSX.Element = [];
  const containerPendingContents: Record<string, React.JSX.Element[]> = {};
  for (let l = 0; l !== render.layouts.length; l++) {
    const layout = render.layouts[l]
    const layoutContents: React.JSX.Element[] = [];
    for (const render of layout.children) {
      if (render.proxy !== undefined && !render.mutated) continue;
      layoutContents.push(
        <Element
          key={render.key}
          render={render}
          mode={mode === 'zoom' ? 'game' : mode}
          onMouseLeave={droppable ? () => setCurrentDrop(element) : undefined}
          onSelectElement={onSelectElement}
        />
      );
    }
    if (layout.container) {
      if (layout.container.id) {
        containerPendingContents[layout?.container.key ?? 'main'] = layoutContents;
        if (render.layouts.find((layout2, l2) => l2 > l && layout2.container?.id === layout.container?.id)) continue;
      }
      const component: React.FC<{} & {
        game: Game,
        elements: GameElement[],
        children: Record<string, JSX.Element[]>,
        layout: UIRender['layouts'][number],
        absolutePosition: Box,
        attributes: any
      }> = {drawer: Drawer, popout: Popout, tabs: Tabs}[layout.container.type];

      const children = layout.container.id ? containerPendingContents : { main: layoutContents };

      contents.push(React.createElement(component, {
        key: l,
        game: element.game,
        elements: layout.children.map(c => c.element),
        children,
        absolutePosition,
        layout,
        attributes: layout.container.attributes,
      }));
    } else {
      if (layoutContents.length) contents.push(<div key={l} className="layout-wrapper">{layoutContents}</div>);
    }
  }

  if (element._ui.appearance.connections && '_graph' in element) {
    let { thickness, style, color, fill, label, labelScale } = element._ui.appearance.connections;
    if (!thickness) thickness = .1;
    if (!style) style = 'solid';
    if (!color) color = 'black';
    if (!fill) color = 'white';
    if (!labelScale) labelScale = 0.05;

    let i = 0;
    const lines: React.JSX.Element[] = [];
    const labels: React.JSX.Element[] = [];
    (element._graph as DirectedGraph).forEachEdge((...args) => {
      const source = rendered!.all[args[2]];
      const target = rendered!.all[args[3]];

      if (source && target) {
        const origin = {
          x: (source.relPos!.left + source.relPos!.width / 2) * absolutePosition.width / 100,
          y: (source.relPos!.top + source?.relPos!.height / 2) * absolutePosition.height / 100
        }
        const destination = {
          x: (target.relPos!.left + target.relPos!.width / 2) * absolutePosition.width / 100,
          y: (target.relPos!.top + target.relPos!.height / 2) * absolutePosition.height / 100
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
              transform={`translate(${(origin.x + destination.x) / 2 - labelScale! * absolutePosition.width * .5}
  ${(origin.y + destination.y) / 2 - labelScale! * absolutePosition.height * .5})
  scale(${labelScale})`}
            >{label({ distance: args[1].distance, to: args[4].space, from: args[5].space })}</g>);
        }
      }
    });
    contents.unshift(
      <svg key="svg-edges" style={{pointerEvents: 'none', position: 'absolute', width: '100%', height: '100%', left: 0, top: 0}} viewBox={`0 0 ${absolutePosition.width} ${absolutePosition.height}`}>{lines}</svg>
    );
    if (label) contents.push(
      <svg key="svg-edge-labels" style={{pointerEvents: 'none', position: 'absolute', width: '100%', height: '100%', left: 0, top: 0}} viewBox={`0 0 ${absolutePosition.width} ${absolutePosition.height}`}>{labels}</svg>
    );
  }

  const boundingBoxes = render.layouts?.filter(layout => layout.showBoundingBox).map((layout, k) => (
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

  let title: string | undefined = undefined;
  if (dev) {
    title = `${element.constructor.name} (#${element._t.ref} [${branch}] ${render.key})`;
    if (element instanceof Piece) {
      title += `
  visibility: ${element._visible?.default ?? true ? "visible" : "hidden"}${element._visible?.except ? ` (except positions ${element._visible?.except.join(', ')})` : ""}`;
    }
    title += `
${Object.entries(element.attributeList()).filter(([k, v]) => v !== undefined && !['_size', '_visible', 'was'].includes(k)).map(([k, v]) => `  ${k}: ${typeof v === 'object' && ('isGameElement' in v.constructor || 'isPlayer' in v.constructor) ? v.toString() : JSON.stringify(v)}`).join("\n")}`;
  }

  // console.log('RENDER attrs', attrs, styles['--transformed-to-old' as keyof typeof styles]);

  // "base" semantic GameElement dom element
  contents = (
    <div
      id={element.name}
      ref={domElement}
      title={title}
      className={classNames(
        render.classes,
        {
          selected: isSelected && mode === 'game',
          clickable: clickable || invalidSelectionError,
          invalid: !!invalidSelectionError || (placing && placement?.invalid),
          selectable,
          droppable
        }
      )}
      style={render.baseStyles}
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
      style={styles}
    >
      {contents}
      {!!info && <div className="info-hotspot" onClick={() => setInfoElement({ info, element })}/>}
    </div>
  );
  if (placing && placement?.rotationChoices) {
    const widthStretch = gridSizeNeeded.width / (element._size?.width ?? 1);
    const minSquare = Math.min(absolutePosition.width, absolutePosition.height);

    contents = (
      <>
        {contents}
        <div className="rotator" style={{...styles, width: (render.relPos!.width * widthStretch) + '%', fontSize: (0.08 * minSquare) + 'rem', transform: undefined}}>
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

  return contents;
}// , (prevProps, props) => {
//   const m = !props.render.mutated && prevProps.mode === props.mode;
//   console.log(m, props);
//   return true;
// })

export default Element;
