import React, { createContext, useContext, useState } from 'react';
import { gameStore } from '../../index.js';

import type { Player } from '../../../player/index.js';
import type { Argument } from '../../../action/action.js';

const DrawerContext = createContext<{
  setOpen?: (open: boolean) => void
}>({});

const Drawer = ({ children }: { children: React.JSX.Element[] }) => {
  const [open, setOpen] = useState(false);

  let openContent: React.ReactNode = null;
  let closedContent: React.ReactNode = null;

  for (const child of children) {
    if (!React.isValidElement(child)) return;
    if (child.type === Drawer.Open) {
      openContent = child;
    } else if (child.type === Drawer.Closed) {
      closedContent = child;
    } else {
      console.error(child.type);
      throw Error('Drawer can only contain Open and Closed');
    }
  }

  return (
    <DrawerContext.Provider value={{ setOpen }}>
      {open ? openContent : closedContent}
    </DrawerContext.Provider>
  );
}

const Open = ({ children, condition }: {
  children: React.ReactNode,
  condition: (actions: { name: string, args: Record<string, Argument<Player>> }[]) => boolean
}) => {
  const context = useContext(DrawerContext);
  const [pendingMoves] = gameStore(s => [s.pendingMoves]);
  const actions = pendingMoves?.map(m => ({ name: m.name, args: m.args }));

  if (context.setOpen && actions && condition(actions)) context.setOpen(true)
  return children;
};

Drawer.Open = Open;

Drawer.Closed = ({ children }: { children: React.ReactNode }) => children;

export default Drawer

// <Drawer>
//   <Drawer.Open condition={action => action === ''}>
//     <stuff/>
//   </Drawer.Open>
// </Drawer>
