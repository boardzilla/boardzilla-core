import React, { createContext, useContext, useMemo, useState } from 'react';
import { gameStore } from '../../index.js';

import type { Player } from '../../../player/index.js';
import type { Argument } from '../../../action/action.js';
import type { Box } from '../../../board/element.js';

const DrawerContext = createContext<{
  setOpen?: (open: boolean) => void
}>({});

const Drawer = ({ area, children, closeDirection }: {
  area: Box,
  children: React.ReactNode,
  closeDirection: 'up' | 'down' | 'left' | 'right';
}) => {
  const [open, setOpen] = useState(false);

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
        height: '.75rem',
      }
    }
    if (closeDirection === 'down') {
      return {
        bottom: `${100 - area.top - (open ? 0 : area.height)}%`,
        left: `${area.left}%`,
        width: `${area.width}%`,
        height: '.75rem',
      }
    }
    if (closeDirection === 'left') {
      return {
        left: `${area.left + (open ? area.width : 0)}%`,
        top: `${area.top}%`,
        width: `${area.height}%`,
        height: '.75rem',
        transform: `rotate(90deg)`,
        transformOrigin: 'top left',
      }
    }
    if (closeDirection === 'right') {
      return {
        right: `${100 - area.left - (open ? 0 : area.width)}%`,
        top: `${area.top}%`,
        width: `${area.width}%`,
        height: '.75rem',
        transform: `rotate(-90deg)`,
        transformOrigin: 'top right',
      }
    }
  }, [area, closeDirection, open]);

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
    <DrawerContext.Provider value={{ setOpen }}>
      <div className="drawer">
        <div
          className={`drawer-tab close-direction-${closeDirection}`}
          style={tabStyle}
          onClick={() => setOpen(o => !o)}
        >
          {open ? openContent : closedContent}
        </div>
        <div className="drawer-content" style={style}>
          <div className="drawer-container" style={containerStyle}>
            {content}
          </div>
          <div className="drawer-background"/>
        </div>
      </div>
    </DrawerContext.Provider>
  );
}

const Open = ({ children, condition }: {
  children: React.ReactNode,
  condition?: (actions: { name: string, args: Record<string, Argument<Player>> }[]) => boolean
}) => {
  const context = useContext(DrawerContext);
  const [pendingMoves] = gameStore(s => [s.pendingMoves]);
  const actions = pendingMoves?.map(m => ({ name: m.name, args: m.args }));

  if (context.setOpen && actions && condition?.(actions)) context.setOpen(true)
  return children;
};

Drawer.Open = Open;

const Closed = ({ children, condition }: {
  children: React.ReactNode,
  condition?: (actions: { name: string, args: Record<string, Argument<Player>> }[]) => boolean
}) => {
  const context = useContext(DrawerContext);
  const [pendingMoves] = gameStore(s => [s.pendingMoves]);
  const actions = pendingMoves?.map(m => ({ name: m.name, args: m.args }));

  if (context.setOpen && actions && condition?.(actions)) context.setOpen(false)
  return children;
};

Drawer.Closed = Closed;

export default Drawer;

// <Drawer>
//   <Drawer.Open condition={action => action === ''}>
//     <stuff/>
//   </Drawer.Open>
// </Drawer>
