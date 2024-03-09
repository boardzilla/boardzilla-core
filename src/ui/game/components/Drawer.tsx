import React, { useEffect, useMemo, useState } from 'react';
import { gameStore } from '../../index.js';

import type { Argument } from '../../../action/action.js';
import type { Box } from '../../../board/element.js';

const Drawer = ({ area, absoluteAspectRatio, children, closeDirection, openIf, closeIf }: {
  area: Box,
  absoluteAspectRatio: number,
  children: React.ReactNode,
  closeDirection: 'up' | 'down' | 'left' | 'right',
  openIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
  closeIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
}) => {
  const [open, setOpen] = useState(false);
  const [pendingMoves] = gameStore(s => [s.pendingMoves]);

  useEffect(() => {
    const actions = pendingMoves?.map(m => ({ name: m.name, args: m.args })) ?? [];

    if (openIf?.(actions)) setOpen(true);
    if (closeIf?.(actions)) setOpen(false);
  }, [openIf, closeIf, pendingMoves]);

  const style = useMemo(() => {
    return {
      top: `${area.top + (open || closeDirection !== 'down' ? 0 : area.height)}%`,
      left: `${area.left + (open || closeDirection !== 'right' ? 0 : area.width)}%`,
      bottom: `${100 - area.top - area.height}%`,
      right: `${100 - area.left - area.width}%`,
      transform: `scaleX(${open || ['up', 'down'].includes(closeDirection) ? 1 : 0}) scaleY(${open || ['left', 'right'].includes(closeDirection) ? 1 : 0})`,
      transformOrigin: closeDirection === 'up' ? 'top' : (closeDirection === 'down' ? 'bottom' : closeDirection),
    }
  }, [area, open, closeDirection]);

  const tabStyle = useMemo(() => {
    if (closeDirection === 'up') {
      return {
        top: `${area.top + (open ? area.height : 0)}%`,
        left: `${area.left}%`,
        width: `${area.width}%`,
      }
    }
    if (closeDirection === 'down') {
      return {
        bottom: `${100 - area.top - (open ? 0 : area.height)}%`,
        left: `${area.left}%`,
        width: `${area.width}%`,
      }
    }
    if (closeDirection === 'left') {
      return {
        left: `${area.left + (open ? area.width : 0)}%`,
        bottom: `${100 - area.top}%`,
        width: `${area.height / absoluteAspectRatio}%`,
        transform: `rotate(90deg)`,
        transformOrigin: 'bottom left',
      }
    }
    if (closeDirection === 'right') {
      return {
        right: `${100 - area.left - (open ? 0 : area.width)}%`,
        bottom: `${100 - area.top}%`,
        width: `${area.height / absoluteAspectRatio}%`,
        transform: `rotate(-90deg)`,
        transformOrigin: 'bottom right',
      }
    }
  }, [area, closeDirection, absoluteAspectRatio, open]);

  /** inverse size to provide a relative box that matches the parent that the content was calculated against */
  const containerStyle = useMemo(() => {
    return {
      width: `${10000 / area.width}%`,
      height: `${10000 / area.height}%`,
      left: `${-area.left / area.width * 100}%`,
      top: `${-area.top / area.height * 100}%`,
    }
  }, [area]);

  let openContent: React.ReactNode = null;
  let closedContent: React.ReactNode = null;
  let content: React.ReactNode[] = [];


  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    if (child.type === Drawer.Open) {
      openContent = child;
    } else if (child.type === Drawer.Closed) {
      closedContent = child;
    } else {
      content.push(child);
    }
  });

  return (
    <div className={`drawer close-direction-${closeDirection} ${open ? 'open' : 'closed'}`}>
      <div
        className="drawer-tab"
        style={tabStyle}
        onClick={() => setOpen(o => !o)}
      >
        {open ? openContent : closedContent}
      </div>
      <div className="drawer-content" style={style}>
        <div className="drawer-background"/>
        <div className="drawer-container" style={containerStyle}>
          {content}
        </div>
      </div>
    </div>
  );
}

const Open = ({ children }: { children: React.ReactNode }) => children;
Drawer.Open = Open;

const Closed = ({ children }: { children: React.ReactNode }) =>  children;
Drawer.Closed = Closed;

export default Drawer;
