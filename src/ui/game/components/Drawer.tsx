import React, { ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { gameStore } from '../../store.js';

import type { Argument } from '../../../action/action.js';
import { ContainerContext } from '../../lib.js';

const Drawer = ({ closeDirection, openIf, closeIf, children }: {
  closeDirection: 'up' | 'down' | 'left' | 'right',
  openIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
  closeIf?: (actions: { name: string, args: Record<string, Argument> }[]) => boolean,
  children: ReactNode
}) => {
  const [open, setOpen] = useState(false);
  const [pendingMoves] = gameStore(s => [s.pendingMoves]);
  const {layout, absoluteTransform} = useContext(ContainerContext);

  const area = useMemo(() => layout?.area ?? {top: 0, left: 0, width: 100, height: 100}, [layout])
  const aspectRatio = useMemo(() => absoluteTransform ? absoluteTransform.width / absoluteTransform.height : 1, [absoluteTransform])

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
    <div className={`drawer close-direction-${closeDirection} ${open ? 'open' : 'closed'}`} style={style}>
      <div
        className="drawer-tab"
        style={tabStyle}
        onClick={() => setOpen(o => !o)}
      >
        {open ? openContent : closedContent}
      </div>
      <div className="drawer-content" style={sliderStyle}>
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
