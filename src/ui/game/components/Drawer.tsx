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
  const style = useMemo(() => Object.fromEntries(Object.entries(area).map(([key, val]) => ([key, `${val}%`]))), [area]);

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
      <div className="drawer" style={style}>
        <div className={`drawer-tab close-direction-${closeDirection}`} onClick={() => setOpen(o => !o)}>
          {open ? openContent : closedContent}
        </div>
        {open && (
          /** inverse size to provide a relative box that matches the parent that the content was calculated against */
          <div className="drawer-content">
            <div className="drawer-container" style={{
              width: `${10000 / area.width}%`,
              height: `${10000 / area.height}%`,
              left: `${-area.left / area.width * 100}%`,
              top: `${-area.top / area.height * 100}%`
            }}>
              {content}
            </div>
          </div>
        )}
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
