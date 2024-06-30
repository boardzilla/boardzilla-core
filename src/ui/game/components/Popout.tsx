import React, { ReactNode, useEffect, useMemo, useState } from 'react';

import type { UIRender } from '../../render.js';

const Popout = ({ layout, children, attributes }: {
  layout: UIRender['layouts'][number],
  children: Record<string, JSX.Element[]>,
  attributes: {
    button: ReactNode,
    popoutMargin?: number | { top: number, bottom: number, left: number, right: number },
  }
}) => {
  const [open, setOpen] = useState(false);
  const area = useMemo(() => layout?.area ?? {top: 0, left: 0, width: 100, height: 100}, [layout])

  const style = useMemo(() => {
    return {
      top: area.top + '%',
      left: area.left + '%',
      height: area.height + '%',
      width: area.width + '%',
      fontSize: layout.area.height + '%',
    }
  }, [area, layout]);

  const popoutStyle = useMemo(() => {
    return { inset: attributes.popoutMargin === undefined ? '4vmax' : (typeof attributes.popoutMargin === 'number' ? `${attributes.popoutMargin}vmax` : `${attributes.popoutMargin.top}vmax ${attributes.popoutMargin.right}vmax ${attributes.popoutMargin.bottom}vmax ${attributes.popoutMargin.left}vmax`) };
  }, [attributes.popoutMargin]);

  useEffect(() => {
    const keydownHandler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', keydownHandler);
    return () => window.removeEventListener('keydown', keydownHandler);
  }, [setOpen]);

  return (
    <div className="popout-button" style={style}>
      <div onClick={() => open || setOpen(true)}>{attributes.button}</div>
      {open && (
        <div className="full-page-cover" onClick={() => setOpen(false)}>
          <div className="popout-modal" onClick={e => e.stopPropagation()} style={popoutStyle}>
            {children.main}
            <svg className="popout-close" onClick={() => setOpen(false)} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export default Popout;
