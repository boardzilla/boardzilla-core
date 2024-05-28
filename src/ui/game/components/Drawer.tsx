import React, { useEffect, useMemo, useState } from 'react';
import { gameStore } from '../../store.js';

import type { Argument } from '../../../action/action.js';
import type { Box, LayoutAttributes } from '../../../board/element.js';

const Drawer = ({ layout, absolutePosition, children, attributes }: {
  layout: Partial<LayoutAttributes>,
  absolutePosition: Box,
  children: JSX.Element[],
  attributes: {
    tab?: React.ReactNode
    closedTab?: React.ReactNode,
    closeDirection: 'up' | 'down' | 'left' | 'right',
    openIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
    closeIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
  }
}) => {
  const [open, setOpen] = useState(false);
  const [pendingMoves] = gameStore(s => [s.pendingMoves]);
  const { tab, closedTab, openIf, closeIf, closeDirection } = attributes;

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
      inset: 0,
      transform: `scaleX(${open || ['up', 'down'].includes(closeDirection) ? 1 : 0}) scaleY(${open || ['left', 'right'].includes(closeDirection) ? 1 : 0})`,
      transformOrigin: closeDirection === 'up' ? 'top' : (closeDirection === 'down' ? 'bottom' : closeDirection),
    }
  }, [closeDirection, open]);

  /** inverse size to provide a relative box that matches the parent that the content was calculated against */
  const containerStyle = useMemo(() => {
    return {
      top: `${-area.top / area.height * 100}%`,
      left: `${-area.left / area.width * 100}%`,
      height: `${10000 / area.height}%`,
      width: `${10000 / area.width}%`,
      // top: `${gap.y - (area.top / area.height * (100 - gap.y - gap.y))}%`,
      // left: `${gap.x - (area.left / area.width * (100 - gap.x - gap.x))}%`,
      // height: `${100 / area.height * (100 - gap.y - gap.y)}%`,
      // width: `${100 / area.width * (100 - gap.x - gap.x)}%`,
    }
  }, [area]);

  const tabStyle = useMemo(() => {
    if (closeDirection === 'up') {
      return {
        top: `${open ? 100 : 0}%`,
        left: 0,
        width: `100%`,
      }
    }
    if (closeDirection === 'down') {
      return {
        bottom: `${open ? 100 : 0}%`,
        left: 0,
        width: `100%`,
      }
    }
    if (closeDirection === 'left') {
      return {
        left: `${open ? 100 : 0}%`,
        bottom: `100%`,
        width: `${100 / area.width * area.height / aspectRatio}%`,
        transform: `rotate(90deg)`,
        transformOrigin: 'bottom left',
      }
    }
    if (closeDirection === 'right') {
      return {
        right: `${open ? 100 : 0}%`,
        bottom: `100%`,
        width: `${100 / area.width * area.height / aspectRatio}%`,
        transform: `rotate(-90deg)`,
        transformOrigin: 'bottom right',
      }
    }
  }, [closeDirection, aspectRatio, area, open]);

  return (
    <div className={`drawer close-direction-${closeDirection} ${open ? 'open' : 'closed'}`} style={style}>
      <div
        className="drawer-tab"
        style={tabStyle}
        onClick={() => setOpen(o => !o)}
      >
        {open ? tab : closedTab ?? tab}
      </div>
      <div className="drawer-content" style={sliderStyle}>
        <div className="drawer-background"/>
        <div className="drawer-container" style={containerStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Drawer;
