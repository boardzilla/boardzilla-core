import React, { useCallback, useEffect, useMemo } from 'react';
import { gameStore } from '../../store.js';

import FlowDebug from './FlowDebug.js';
import Element from './Element.js';
import DebugChoices from './DebugChoices.js';
import { ResolvedSelection } from '../../../action/selection.js';
import DebugArgument from './DebugArgument.js';

const Debug = () => {
  const [position, gameManager, actionDebug, pendingMoves, infoElement, setInfoElement, selected, disambiguateElement] = gameStore(s => [s.position, s.gameManager, s.actionDebug, s.pendingMoves, s.infoElement, s.setInfoElement, s.selected, s.disambiguateElement]);
  const player = gameManager.players.atPosition(position!)!;

  useEffect(() => setInfoElement(), [setInfoElement]);

  const getAction = useCallback((name: string) => pendingMoves?.find(m => m.name === name), [pendingMoves]);
  const getSelection = useCallback((name: string, selection: string) => getAction(name)?.selections.find(s => s.name === selection), [getAction]);

  let elementStyle: React.CSSProperties | undefined = useMemo(() => {
    if (!infoElement?.element) return {};
    const scale = {...infoElement.element.absoluteTransform()};
    let fontSize = 24 * 0.04;
    const aspectRatio = scale.width / scale.height;

    if (aspectRatio > 1) {
      scale.width = 100;
      fontSize /= aspectRatio;
    } else {
      scale.width *= 100 / scale.height;
    }
    return {
      width: scale.width + '%',
      aspectRatio,
      fontSize: fontSize + 'rem',
    };
  }, [infoElement?.element]);

  if (!gameManager || !actionDebug) return null;

  return (
    <div id="debug-overlay" className="full-page-cover" onClick={() => setInfoElement()}>
      <div id="flow-debug">
        {Object.entries(gameManager.flows).map(([name, flow]) => (
          <React.Fragment key={name}>
            {name !== '__main__' && <div className="subflow">subflow "{name.replace(/__/g, '')}"</div>}
            <FlowDebug flow={flow.visualize(flow)} nest={0} current={true} />
          </React.Fragment>
        ))}
      </div>
      <div id="action-debug">
        <div id="action-breakdown">
          <b>Available Actions for {player.name}</b>
          <ul>
            {Object.entries(actionDebug).map(([action, { impossible, args }]) => (
              <li className={`action-block ${impossible || Object.values(args).some(a => a === 'imp') ? 'impossible' : ''}`} key={action}>
                <div>
                  <span className="name">{action === '__pass__' ? 'Implied pass' : action}</span>
                  {impossible && <span> (Impossible by <code>action.condition</code>)</span>}
                </div>
                {action !== '__pass__' && !impossible && (
                  <ul>
                    {gameManager.getAction(action, player).selections.map(
                      s => [s.name, s.type, getSelection(action, s.name)] as [string, string, ResolvedSelection?]
                    ).map(([name, type, sel]) => (
                      <li key={name} className={`selection-type-${args[name] ?? 'future'}`}>
                        <div className="function">
                          <code>{{number: 'chooseNumber', board: 'chooseOnBoard', 'choices': 'chooseFrom', text: 'enterText', button: 'confirm', place: 'placePiece'}[type]}</code>
                          &nbsp;<span className="name">"{name}"</span>
                        </div>

                        {['ask', 'imp', 'tree'].includes(args[name]) && (
                          <div>
                            <ul>
                              <DebugChoices
                                choices={sel?.boardChoices || sel?.choices}
                                heading="Choices"
                              />
                              <DebugChoices
                                choices={sel?.invalidOptions}
                                heading="Invalid"
                              />
                              {(sel?.min !== undefined || sel?.max !== undefined) && <><li>min: {sel.min ?? 1}</li><li>max: {sel.max ?? '∞'}</li></>}
                            </ul>
                          </div>
                        )}
                        {args[name] === 'imp' && ' (no valid choices)'}
                        {args[name] === 'tree' && ' (no valid continuation)'}
                        {['sel', 'skip', 'only-one', 'forced', 'always'].includes(args[name]) && (
                          <span>
                            <span className="argument">
                              <DebugArgument argument={getAction(action)?.args[name]}/>
                            </span>
                            {args[name] === 'sel' && ' (player-selected)'}
                            {args[name] === 'skip' && <span> (skipped by <code>skipIf</code> function)</span>}
                            {args[name] === 'only-one' && <span> (skipped by <code>"only-one"</code>)</span>}
                            {args[name] === 'forced' && <span> (will skip by <code>"only-one"</code>)</span>}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {selected?.length && (
            <div style={{marginBottom: '1em'}}>
              <hr/>
              <DebugChoices choices={selected} heading="selected"/>
              {disambiguateElement && <span>(ambiguous: valid moves are: "{disambiguateElement.moves.map(m => m.name).join('", "')}")</span>}
            </div>
          )}

        </div>
        {infoElement?.element && (
          <div className="element-zoom">
            <div style={elementStyle}>
              <Element
                element={infoElement!.element!}
                mode='zoom'
                onSelectElement={() => {}}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Debug;
