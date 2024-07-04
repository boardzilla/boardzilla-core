import React, { useEffect, useMemo, useState } from 'react';
import { gameStore } from '../../store.js';

import type { Argument } from '../../../action/action.js';
import type { Box, LayoutAttributes } from '../../../board/element.js';

const Tabs = ({ layout, absolutePosition, children, attributes }: {
  layout: Partial<LayoutAttributes>,
  absolutePosition: Box,
  children: Record<string, JSX.Element[]>,
  attributes: {
    tabs: Record<string, React.ReactNode>
    tabDirection: 'up' | 'down' | 'left' | 'right',
    setTabTo?: (actions: { name: string, args: Record<string, Argument> }[]) => string,
  }
}) => {
  const [openTab, setOpenTab] = useState(Object.keys(children)[0]);
  const [pendingMoves] = gameStore(s => [s.pendingMoves]);
  const { tabs, tabDirection, setTabTo } = attributes;

  const area = useMemo(() => layout?.area ?? {top: 0, left: 0, width: 100, height: 100}, [layout])
  const aspectRatio = useMemo(() => absolutePosition ? absolutePosition.width / absolutePosition.height : 1, [absolutePosition])

  useEffect(() => {
    const actions = pendingMoves?.map(m => ({ name: m.name, args: m.args })) ?? [];

    const newTab = setTabTo?.(actions);
    if (newTab) setOpenTab(newTab);
  }, [setTabTo, setOpenTab, pendingMoves]);

  const style = useMemo(() => {
    return {
      top: area.top + '%',
      left: area.left + '%',
      height: area.height + '%',
      width: area.width + '%',
    }
  }, [area]);

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
    if (tabDirection === 'down') {
      return {
        top: `100%`,
        left: 0,
        width: `100%`,
      }
    }
    if (tabDirection === 'up') {
      return {
        bottom: `100%`,
        left: 0,
        width: `100%`,
      }
    }
    if (tabDirection === 'right') {
      return {
        left: `100%`,
        bottom: `100%`,
        width: `${100 / area.width * area.height / aspectRatio}%`,
        transform: `rotate(90deg)`,
        transformOrigin: 'bottom left',
      }
    }
    if (tabDirection === 'left') {
      return {
        right: `100%`,
        bottom: `100%`,
        width: `${100 / area.width * area.height / aspectRatio}%`,
        transform: `rotate(-90deg)`,
        transformOrigin: 'bottom right',
      }
    }
  }, [tabDirection, aspectRatio, area]);

  return (
    <div className={`drawer open-direction-${tabDirection}`} style={style}>
      <div
        className="drawer-tab multi"
        style={tabStyle}
      >
        {Object.entries(tabs).map(([key, tab]) => (
          <div key={key} className={`tabs-tab ${openTab === key ? 'active' : ''}`} onClick={() => {console.log(key);setOpenTab(key)}}>{tab}</div>
        ))}
      </div>
      <div className="drawer-content">
        <div className="drawer-container" style={containerStyle}>
          {openTab}
          {children[openTab]}
        </div>
      </div>
    </div>
  );
}

export default Tabs;
