import React, { useEffect, useMemo, useState } from 'react';
import { gameStore } from '../../store.js';

import type { Argument } from '../../../action/action.js';
import type { Box, LayoutAttributes } from '../../../board/element.js';

const Drawer = ({ layout, absolutePosition, children, attributes }: {
  layout: Partial<LayoutAttributes>,
  absolutePosition: Box,
  children: Record<string, JSX.Element[]>,
  attributes: {
    tab?: React.ReactNode
    closedTab?: React.ReactNode,
    openDirection: 'up' | 'down' | 'left' | 'right',
    openIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
    closeIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
  }
}) => {
  const [open, setOpen] = useState(false);
  const [pendingMoves] = gameStore(s => [s.pendingMoves]);
  const { tab, closedTab, openIf, closeIf, openDirection } = attributes;

  const area = useMemo(() => layout?.area ?? {top: 0, left: 0, width: 100, height: 100}, [layout])
  const aspectRatio = useMemo(() => absolutePosition ? absolutePosition.width / absolutePosition.height : 1, [absolutePosition])

  useEffect(() => {
    const actions = pendingMoves?.map(m => ({ name: m.name, args: m.args })) ?? [];

    if (openIf?.(actions)) setOpen(true);
    if (closeIf?.(actions)) setOpen(false);
  }, [openIf, closeIf, pendingMoves]);

  const style = useMemo(() => {
    return {
      top: area.top + '%',
      left: area.left + '%',
      height: area.height + '%',
      width: area.width + '%',
    }
  }, [area]);

  const sliderStyle = useMemo(() => {
    return {
      transform: `scaleX(${open || ['up', 'down'].includes(openDirection) ? 1 : 0}) scaleY(${open || ['left', 'right'].includes(openDirection) ? 1 : 0})`,
      transformOrigin: openDirection === 'down' ? 'top' : (openDirection === 'up' ? 'bottom' : openDirection),
    }
  }, [openDirection, open]);

  /** inverse size to provide a relative box that matches the parent that the content was calculated against */
  const containerStyle = useMemo(() => {
    return {
      top: `${-area.top / area.height * 100}%`,
      left: `${-area.left / area.width * 100}%`,
      height: `${10000 / area.height}%`,
      width: `${10000 / area.width}%`,
    }
  }, [area]);

  const tabStyle = useMemo(() => {
    if (openDirection === 'down') {
      return {
        top: `${open ? 100 : 0}%`,
        left: 0,
        width: `100%`,
      }
    }
    if (openDirection === 'up') {
      return {
        bottom: `${open ? 100 : 0}%`,
        left: 0,
        width: `100%`,
      }
    }
    if (openDirection === 'right') {
      return {
        left: `${open ? 100 : 0}%`,
        bottom: `100%`,
        width: `${100 / area.width * area.height / aspectRatio}%`,
        transform: `rotate(90deg)`,
        transformOrigin: 'bottom left',
      }
    }
    if (openDirection === 'left') {
      return {
        right: `${open ? 100 : 0}%`,
        bottom: `100%`,
        width: `${100 / area.width * area.height / aspectRatio}%`,
        transform: `rotate(-90deg)`,
        transformOrigin: 'bottom right',
      }
    }
  }, [openDirection, aspectRatio, area, open]);

  return (
    <div className={`drawer open-direction-${openDirection} ${open ? 'open' : 'closed'}`} style={style}>
      <div
        className="drawer-tab"
        style={tabStyle}
        onClick={() => setOpen(o => !o)}
      >
        {open ? tab : closedTab ?? tab}
      </div>
      <div className="drawer-content" style={sliderStyle}>
        <div className="drawer-container" style={containerStyle}>
          {children.main}
        </div>
      </div>
    </div>
  );
}

export default Drawer;
