import React, { ReactNode, useContext, useEffect, useMemo } from 'react';
import { gameStore } from '../../store.js';

import type { Argument } from '../../../action/action.js';
import { ContainerContext } from '../../lib.js';

const Popout = ({ openIf, closeIf, children }: {
  openIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
  closeIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
  children: ReactNode
}) => {
  const [pendingMoves, setPopupLayout] = gameStore(s => [s.pendingMoves, s.setPopupLayout]);
  const {layout} = useContext(ContainerContext);
  const area = useMemo(() => layout?.area ?? {top: 0, left: 0, width: 100, height: 100}, [layout])

  useEffect(() => {
    const actions = pendingMoves?.map(m => ({ name: m.name, args: m.args })) ?? [];

    if (openIf?.(actions)) setPopupLayout(layout);
    if (closeIf?.(actions)) setPopupLayout(undefined);
  }, [openIf, closeIf, pendingMoves, setPopupLayout, layout]);

  let closedContent: React.ReactNode = null;
  let content: React.ReactNode[] = [];

  const style = useMemo(() => {
    return {
      top: area.top + '%',
      left: area.left + '%',
      height: area.height + '%',
      width: area.width + '%',
    }
  }, [area]);

  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    if (child.type === Popout.Closed) {
      closedContent = child;
    } else {
      content.push(child);
    }
  });

  return (
    <div className="popout-closed" onClick={() => setPopupLayout(layout)} style={style}>
      {closedContent}
    </div>
  );
}

const Closed = ({ children }: { children: React.ReactNode }) =>  children;
Popout.Closed = Closed;

export default Popout;
