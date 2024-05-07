import React from 'react';

import './assets/index.scss';

/**
 * A Piece with two sides: front and back. When the Piece is hidden, the back is
 * shown. When visible, the front is shown. When the visibility changes, the CSS
 * animates a 3d flip.
 *
 * @example
 * import { Flippable } from '@boardzilla/core/components';
 * ...
 *   Piece.appearance({
 *     render: piece => (
 *       <Flippable>
 *         <Flippable.Front>{piece.name}</Flippable.Front>
 *         <Flippable.Back></Flippable.Back>
 *       </Flippable>
 *     );
 *   });
 * // The DOM structure inside the Piece element will be:
 *   <div class="bz-flippable">
 *     <div class="front">{piece.name}</div>
 *     <div class="back"></div>
 *   </div>
 */
const Flippable = ({ children }: {
  children?: React.ReactNode,
}) => {
  let frontContent: React.ReactNode = null;
  let backContent: React.ReactNode = null;

  React.Children.forEach(children, child => {
    if (!React.isValidElement(child)) return;
    if (child.type === Flippable.Front) {
      frontContent = child;
    } else if (child.type === Flippable.Back) {
      backContent = child;
    } else {
      throw Error("Flippable must contain only <Front/> and <Back/>");
    }
  });

  return (
    <div className='bz-flippable'>
      <div className="front">
        {frontContent}
      </div>
      <div className="back">
        {backContent}
      </div>
    </div>
  );
}
export default Flippable;

const Front = ({ children }: { children: React.ReactNode }) => children;
Flippable.Front = Front;

const Back = ({ children }: { children: React.ReactNode }) =>  children;
Flippable.Back = Back;
