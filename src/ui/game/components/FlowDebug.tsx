import React from 'react';
import type { FlowVisualization } from '../../../flow/flow.js';

const colors = ['#900', '#060', '#009', '#606']

const FlowDebugBlock = ({ flow, nest, current }: { flow: FlowVisualization, nest: number, current: boolean }) => {
  return (
    <div
      className={`flow-debug-block ${current && !flow.current.block ? 'current' : ''}`}
      style={{['--color' as string]: colors[nest % 4], color: colors[nest % 4]}}
    >
      <div className="header">
        {flow.type}
        {(flow.name || flow.current.position !== undefined) && (
          <span className="name">{flow.name}{flow.name && flow.current.position !== undefined && ' = '}{flow.current.position !== undefined && String(flow.current.position)}</span>
        )}
      </div>
      {Object.entries(flow.blocks).map(([name, block]) => (
        <div key={name} className="do-block">
          <div className="name">{name}</div>
          {block?.map((step, seq) => {
            const nextCurrent = current && name === flow.current.block && seq === (flow.current.sequence ?? 0);
            return typeof step === 'string' ?
              <div key={seq} className={`function ${nextCurrent ? 'current' : ''}`} title={step}>{step.trim().slice(0, 200)}</div> :
              <FlowDebugBlock key={seq} flow={step} nest={nest + 1} current={nextCurrent}/>
          })}
        </div>
      ))}
    </div>
  );
}

export default FlowDebugBlock;
