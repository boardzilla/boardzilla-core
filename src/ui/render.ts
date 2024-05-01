import GameElement from '../board/element.js';
import ElementCollection from '../board/element-collection.js';
import random from 'random-seed';
import { serialize } from '../action/utils.js'
import uuid from 'uuid-random';

import type { Game, Box, Vector } from "../board/index.js";
import type { ElementClass, ElementUI } from "../board/element.js";

export type UIRender = {
  element: GameElement,
  key?: string;
  mutated?: boolean;
  attributes?: Record<string, any>;
  dataAttributes?: Record<string, any>;
  previousAttributes?: Record<string, any>;
  previousDataAttributes?: Record<string, any>;
  relPos?: Box & { rotation?: number }; // raw pos data relative to parent
  pos?: Box & { rotation?: number }; // raw pos data relative to board
  oldPos?: Box & { rotation?: number }; // old pos for transform relative to board
  styles?: React.CSSProperties; // CSS, includes pos and transform from move
  baseStyles?: React.CSSProperties;
  classes?: string;
  effectClasses?: string;
  layouts: {
    area: Box,
    grid?: {
      anchor: Vector,
      origin: { column: number, row: number },
      columns: number,
      rows: number,
      offsetColumn: Vector,
      offsetRow: Vector,
    },
    showBoundingBox?: string | boolean,
    children: UIRender[],
    drawer: ElementUI<GameElement>['layouts'][number]['attributes']['drawer']
  }[],
  parentRef?: number,
  crossParent?: boolean,
  proxy?: number // unrendered elements outside the limit are proxied to the closest element for animations
};

export type UI = {
  all: Record<string, UIRender>;
  frame: Vector;
  game: UIRender;
  pile: number[];
};


/**
 * Viewport relative to a square perfectly containing the playing area. The
 * `left` and `top` values are from 0-100. The x and y values in el method
 * are on the same scale.
 * @category UI
 * @internal
 */
export function absPositionSquare(el: GameElement, ui: UI): Box {
  const pos = ui.all[String(el._t.ref)].pos!;
  return {
    left: pos.left,
    top: pos.top,
    width: pos.width * ui.frame.x / 100,
    height: pos.height * ui.frame.y / 100
  };
}

/**
 * recalc all elements UI, base styles, wrapper styles, classes, attrs,
 * data-attrs, assign UUID DOM keys
 * @category UI
 * @internal
 */
export function applyLayouts(game: Game, base?: (b: Game) => void): UI {
  game.resetUI();
  if (game._ui.setupLayout) {
    game._ui.setupLayout(game, game._ctx.player!, game._ui.boardSize.name);
  }
  base?.(game);
  const aspectRatio = game._ui.boardSize.aspectRatio;
  const frame = {
    x: aspectRatio < 1 ? aspectRatio * 100 : 100,
    y: aspectRatio > 1 ? 100 / aspectRatio : 100
  };

  const ui: UI = {
    all: {},
    frame,
    game: {
      element: game,
      pos: { left: 0, top: 0, width: 100, height: 100 },
      relPos: { left: 0, top: 0, width: 100, height: 100 },
      styles: {
        width: '100%',
        height: '100%',
        left: '0',
        top: '0',
        fontSize: (frame?.y ?? 100) * 0.04 + 'rem'
      },
      classes: `Space ${game._ui.appearance.className ?? ''} ${game.constructor.name}`,
      layouts: []
    },
    pile: game.pile._t.children.map(e => e._t.ref)
  };

  ui.all[String(game._t.ref)] = ui.game;
  ui.game.layouts = calcLayouts(game, ui)

  return ui;
}

// compares render to oldRender and applies DOM keys only
export function applyDOMKeys(render: UIRender, ui: UI, oldUI: UI) {

  const el = render.element;

  const oldRender = oldUI.all[String(el._t.wasRef ?? el._t.ref)];

  for (const layout of render.layouts) {
    for (const child of layout.children) {
      applyDOMKeys(child, ui, oldUI);
    }
  }

  if (!('isSpace' in el) && el._t.parent?._t.ref === oldRender.parentRef) {
    render.key = oldRender?.key ?? render.key;
  }
}

// compares render to oldRender and applies transforms, effect classes, DOM key, old attrs
export function applyDiff(render: UIRender, ui: UI, oldUI: UI): boolean {

  const proxy = render.proxy !== undefined ? ui.all[render.proxy] : undefined;
  const el = render.element;

  if ('pile' in el) {
    // find offscreen moves
    for (const off of (el as Game).pile._t.children) {
      if (ui.all[off._t.ref]) continue;
      const previous = oldUI.all[off._t.ref];
      if (previous?.pos) {
        const offRender = {
          pos: {
            left: 200,
            top: 0,
            width: previous.pos.width,
            height: previous.pos.height,
          },
          relPos: {
            left: 200,
            top: 0,
            width: previous.pos.width,
            height: previous.pos.height,
          },
          element: off,
          layouts: [],
          key: previous.key,
        };
        applyBaseStyles(offRender, off, ui);

        render.layouts[0].children.push(offRender);
        ui.all[off._t.ref] = offRender;
      }
    }
  }

  let oldRenderByWas = oldUI.all[String(el._t.wasRef ?? el._t.ref)];
  let oldRender = oldRenderByWas.proxy === undefined ? oldRenderByWas : oldUI.all[oldRenderByWas.proxy];
  if (!oldRender?.pos || !oldRender?.relPos || (oldRender?.proxy && proxy)) { // do not animate from one proxy to another
    if (oldUI.pile.includes(el._t.ref)) {
      oldRender = {
        pos: {
          left: 200,
          top: 0,
          width: render.pos!.width,
          height: render.pos!.height,
        },
        relPos: {
          left: 200,
          top: 0,
          width: render.pos!.width,
          height: render.pos!.height,
        },
        element: el,
        layouts: [],
      };
    } else {
      delete render.previousAttributes;
      delete render.previousDataAttributes;
      return true;
    }
  }
  render.crossParent = el._t.parent?._t.ref !== oldRender.parentRef;

  // depth first, bubble up mutations
  let mutated = false

  for (const layout of render.layouts) {
    for (const child of layout.children) {
      mutated = applyDiff(child, ui, oldUI) || mutated;
    }
  }

  if (!('isSpace' in el) && !render.crossParent) {
    render.key = oldRender?.key ?? render.key;
  }

  const actual = proxy ?? render;
  const relPos = actual.relPos;
  if (
    relPos && (
      render.crossParent ||
      oldRender.relPos!.left !== relPos.left ||
      oldRender.relPos!.top !== relPos.top ||
      oldRender.relPos!.width !== relPos.width ||
      oldRender.relPos!.height !== relPos.height ||
      (oldRender.relPos!.rotation ?? 0) !== (relPos.rotation ?? 0)
    )
  ) {
    mutated = true;
    const oldPos = render.crossParent ? oldRender.pos! : oldRender.relPos!;
    const newPos = render.crossParent ? actual.pos! : actual.relPos!;
    if (proxy !== undefined) {
      render.classes = proxy.classes;
      render.pos = proxy.pos;
      render.relPos = proxy.relPos;
      render.styles = {...proxy.styles};
      render.baseStyles = {...proxy.baseStyles};
    }

    render.styles!.transform = `translate(${(oldPos.left + oldPos.width / 2 - newPos.left - newPos.width / 2) / newPos.width * 100}%, ` +
      `${(oldPos.top + oldPos.height / 2 - newPos.top - newPos.height / 2) / newPos.height * 100}%) ` +
      `scaleX(${oldPos.width / newPos.width}) ` +
      `scaleY(${oldPos.height / newPos.height}) ` +
      `rotate(${(oldPos.rotation ?? 0) - (newPos.rotation ?? 0)}deg)`;
  } else if (proxy !== undefined) return false;

  const changedAttrs = JSON.stringify(actual.dataAttributes) !== JSON.stringify(oldRender.dataAttributes);
  mutated ||= changedAttrs;

  if (changedAttrs) {
    if (proxy !== undefined) {
      render.attributes = proxy.attributes;
      render.dataAttributes = proxy.dataAttributes;
    }
    render.previousAttributes = oldRender.attributes;
    render.previousDataAttributes = oldRender.dataAttributes;

    if (el._ui.appearance.effects) {
      render.effectClasses = '';
      for (const effect of el._ui.appearance.effects) {
        if (effect.trigger(el, oldRender.attributes!)) render.effectClasses += ' ' + effect.name;
      }
    }
  }

  if (render.styles && (changedAttrs || render.styles.transform)) {
    Object.assign(render.styles, {
      // uuid so react re-applies if multiple
      '--transformed-to-old': String(uuid()),
      // supress normal transition style and re-add later. necessary to prevent
      // transfrom transition from completing immediately
      transition: 'none'
    });
  }

  render.mutated = mutated;
  return mutated;
}

/**
 * recalc one elements UI
 * @category UI
 * @internal
 */
export function calcLayouts(el: GameElement, ui: UI): UIRender['layouts'] {
  if (el._ui.appearance.render === false) return [];

  const layoutItems = getLayoutItems(el);
  const absoluteTransform = absPositionSquare(el, ui)
  const layouts: UIRender['layouts'] = [];

  for (let l = el._ui.layouts.length - 1; l >= 0; l--) {
    const { attributes } = el._ui.layouts[l];
    const allChildren = layoutItems[l];
    let children = allChildren && attributes.limit !== undefined && allChildren.length > attributes.limit ?
      el._t.order === 'stacking' ? allChildren?.slice(allChildren.length - attributes.limit) : allChildren?.slice(0, attributes.limit) :
      allChildren;

    const { slots, direction, gap, alignment, maxOverlap } = attributes;
    let { size, scaling, aspectRatio, haphazardly } = attributes;
    if (!size && !scaling) scaling = 'fit';

    const area = getArea(el, ui, attributes);

    let cellBoxes = slots || [];
    let sizes: number[] = []; // relative sizes of children so they retain scaling against each other
    let maxSize: number = 0;

    layouts[l] = {
      area,
      children: [],
      showBoundingBox: attributes.showBoundingBox ?? el.game._ui.boundingBoxes,
      drawer: attributes.drawer
    };

    let minColumns = typeof attributes.columns === 'number' ? attributes.columns : attributes.columns?.min || 1;
    let minRows = typeof attributes.rows === 'number' ? attributes.rows : attributes.rows?.min || 1;

    if (!children?.length && minRows === 1 && minColumns === 1) continue;
    children ??= [];

    if (!slots) {
      const cells: [number?, number?][] = [];
      const min: {column?: number, row?: number} = {};
      const max: {column?: number, row?: number} = {};

      // find bounding box for any set positions
      for (let c = 0; c != children.length; c++) {
        const child = children[c];
        const gridSize = el._sizeNeededFor(child);
        if (child.column !== undefined && child.row !== undefined && !child._ui.ghost) {
          cells[c] = [child.column, child.row];
          if (min.column === undefined || child.column < min.column) min.column = child.column;
          if (min.row === undefined || child.row < min.row) min.row = child.row;
          if (max.column === undefined || child.column + gridSize.width - 1 > max.column) max.column = child.column + gridSize.width - 1;
          if (max.row === undefined || child.row + gridSize.height - 1 > max.row) max.row = child.row + gridSize.height - 1;
        }
      }
      min.column ??= 1;
      min.row ??= 1;
      max.column ??= 1;
      max.row ??= 1;

      // calculate # of rows/cols
      minColumns = Math.max(minColumns, max.column - min.column + 1);
      minRows = Math.max(minRows, max.row - min.row + 1);
      let maxColumns = typeof attributes.columns === 'number' ? attributes.columns : attributes.columns?.max || Infinity;
      let maxRows = typeof attributes.rows === 'number' ? attributes.rows : attributes.rows?.max || Infinity;

      let columns = minColumns;
      let rows = minRows;
      let origin = {column: 1, row: 1};
      const alignOffset = {
        left: alignment.includes('left') ? 0 : (alignment.includes('right') ? 1 : 0.5),
        top: alignment.includes('top') ? 0 : (alignment.includes('bottom') ? 1 : 0.5),
      };

      const ghostPiecesIgnoredForLayout = ('extendableGrid' in el && el.extendableGrid) ? children.filter(c => c._ui.ghost) : [];
      const elements = children.length - ghostPiecesIgnoredForLayout.length;

      // expand grid as needed for children in direction specified
      if (children.length) {
        if (direction === 'square') {
          columns = Math.max(minColumns,
            Math.min(
              maxColumns,
              Math.ceil(elements / minRows),
              Math.max(Math.ceil(elements / maxRows), Math.ceil(Math.sqrt(elements)))
            )
          );
          rows = Math.max(minRows,
            Math.min(maxRows,
              Math.ceil(elements / minColumns),
              Math.ceil(elements / columns)
            )
          );
        } else {
          if (rows * columns < elements) {
            if (['ltr', 'ltr-btt', 'rtl', 'rtl-btt'].includes(direction)) {
              columns = Math.max(columns, Math.min(maxColumns, Math.ceil(elements / rows)));
              rows = Math.max(rows, Math.min(maxRows, Math.ceil(elements / columns)));
            }
            if (['ttb', 'btt', 'ttb-rtl', 'btt-rtl'].includes(direction)) {
              rows = Math.max(rows, Math.min(maxRows, Math.ceil(elements / columns)));
              columns = Math.max(columns, Math.min(maxColumns, Math.ceil(elements / rows)));
            }
          }
        }

        // set origin if viewport should shift
        origin = {
          column: Math.min(min.column, max.column, Math.max(1, max.column - columns + 1)),
          row: Math.min(min.row, max.row, Math.max(1, max.row - rows + 1))
        }

        if (ghostPiecesIgnoredForLayout.length) {
          const extension = Math.max(...ghostPiecesIgnoredForLayout.map(p => Math.max(p._size?.width ?? 1, p._size?.height ?? 1)));
          if (extension > 0) {
            if (children.length === ghostPiecesIgnoredForLayout.length) {
              columns = Math.max(columns, extension);
              rows = Math.max(rows, extension);
            } else {
              if (min.column - extension < origin.column) {
                columns += extension - min.column + origin.column;
                origin.column = min.column - extension;
              }
              if (max.column + extension >= origin.column + columns) {
                columns = max.column + extension - origin.column + 1;
              }
              if (min.row - extension < origin.row) {
                rows += extension - min.row + origin.row;
                origin.row = min.row - extension;
              }
              if (max.row + extension >= origin.row + rows) {
                rows = max.row + extension - origin.row + 1;
              }
            }
          }
        }

        let available: Vector;
        let advance: Vector;
        let carriageReturn: Vector;
        let fillDirection = direction;
        if (fillDirection === 'square') {
          if (['left', 'top left', 'top', 'center'].includes(alignment)) {
            fillDirection = 'ltr';
          } else if (['right', 'top right'].includes(alignment)) {
            fillDirection = 'rtl';
          } else if (['bottom','bottom left'].includes(alignment)) {
            fillDirection = 'ltr-btt';
          } else {
            fillDirection = 'rtl-btt';
          }
        }
        switch (fillDirection) {
          case 'ltr':
            available = {x: 1, y: 1};
            advance = {x: 1, y: 0};
            carriageReturn = {x: -columns, y: 1};
            break;
          case 'rtl':
            available = {x: columns, y: 1};
            advance = {x: -1, y: 0};
            carriageReturn = {x: columns, y: 1};
            break;
          case 'ttb':
            available = {x: 1, y: 1};
            advance = {x: 0, y: 1};
            carriageReturn = {x: 1, y: -rows};
            break;
          case 'btt':
            available = {x: 1, y: rows};
            advance = {x: 0, y: -1};
            carriageReturn = {x: 1, y: rows};
            break;
          case 'ltr-btt':
            available = {x: 1, y: rows};
            advance = {x: 1, y: 0};
            carriageReturn = {x: -columns, y: -1};
            break;
          case 'rtl-btt':
            available = {x: columns, y: rows};
            advance = {x: -1, y: 0};
            carriageReturn = {x: columns, y: -1};
            break;
          case 'ttb-rtl':
            available = {x: columns, y: 1};
            advance = {x: 0, y: 1};
            carriageReturn = {x: -1, y: -rows};
            break;
          case 'btt-rtl':
            available = {x: columns, y: rows};
            advance = {x: 0, y: -1};
            carriageReturn = {x: -1, y: rows};
            break;
        }

        if (ghostPiecesIgnoredForLayout) {
          for (let c = 0; c != children.length; c++) {
            const child = children[c];
            if (child.column !== undefined && child.row !== undefined && child._ui.ghost) cells[c] = [child.column, child.row];
          }
        }

        // place unpositioned elements
        let c = 0;
        while (c != children.length) {
          const child = children[c];
          if (cells[c]) {
            c++;
            continue;
          }
          const cell: [number, number] = [available.x + origin.column! - 1, available.y + origin.row! - 1];
          if (cells.every(([x, y]) => x !== cell[0] || y !== cell[1])) {
            cells[c] = cell;
            if (attributes.sticky) {
              child.column = cell[0];
              child.row = cell[1];
            }
            c++;
          }
          available.x += advance.x;
          available.y += advance.y;
          if (available.x > columns || available.x <= 0 || available.y > rows || available.y <= 0) {
            available.x += carriageReturn.x;
            available.y += carriageReturn.y;
          }
          if (available.x > columns || available.x <= 0 || available.y > rows || available.y <= 0) break;
        }
      }

      // calculate offset or gap
      let cellGap: Vector | undefined = undefined;
      let offsetRow: Vector | undefined = undefined;
      let offsetColumn: Vector | undefined = undefined;
      let effecitveRowsWithOffsets = '_gridPositions' in el && 'rows' in el ? el.rows as number : rows;
      let effecitveColumnsWithOffsets = '_gridPositions' in el && 'columns' in el ? el.columns as number : columns;
      let rhomboid = !('_gridPositions' in el) || !('shape' in el) || el.shape === 'rhomboid';

      if (attributes.offsetColumn || attributes.offsetRow) {
        offsetColumn = typeof attributes.offsetColumn === 'number' ? {x: attributes.offsetColumn, y: 0} : attributes.offsetColumn;
        offsetRow = typeof attributes.offsetRow === 'number' ? {x: 0, y: attributes.offsetRow} : attributes.offsetRow;
        if (!offsetRow) offsetRow = { x: -offsetColumn!.y, y: offsetColumn!.x };
        if (!offsetColumn) offsetColumn = { x: offsetRow!.y, y: -offsetRow!.x };
      } else {
        // gaps are absolute and convert by ratio
        cellGap = {
          x: (gap && (typeof gap === 'number' ? gap : gap.x) || 0) / absoluteTransform.width * 100,
          y: (gap && (typeof gap === 'number' ? gap : gap.y) || 0) / absoluteTransform.height * 100,
        };
      }

      if (!size) {
        // start with largest size needed to accommodate
        size = cellSizeForArea(
          effecitveRowsWithOffsets, effecitveColumnsWithOffsets,
          area, cellGap, offsetColumn, offsetRow, rhomboid
        );

        // find all aspect ratios and sizes of child elements and choose best fit
        if (!aspectRatio) {
          let minRatio = Infinity;
          let maxRatio = 0;
          for (const c of children) {
            const r = c._ui.appearance.aspectRatio;
            if (r !== undefined) {
              if (r < minRatio) minRatio = r;
              if (r > maxRatio) maxRatio = r;
            }
            const largestDimension = c._size ? Math.max(c._size.width, c._size.height) : 1;
            sizes.push(largestDimension);
            if (largestDimension > maxSize) maxSize = largestDimension;
          }
          if (minRatio < Infinity || maxRatio > 0) {
            if (maxRatio > 1 && minRatio < 1) aspectRatio = 1;
              else if (minRatio > 1) aspectRatio = minRatio;
              else aspectRatio = maxRatio;
          }
        }

        if (aspectRatio) {
          aspectRatio *= absoluteTransform.height / absoluteTransform.width;
          if (aspectRatio > size.width / size.height) {
            size.height = size.width / aspectRatio;
          } else {
            size.width = aspectRatio * size.height;
          }
        }
      }

      if (!children.length) {
        layouts[l].grid = {
          anchor: { x: 0, y: 0 },
          origin,
          rows,
          columns,
          offsetColumn: offsetColumn ?? { x: size.width + cellGap!.x, y: 0 },
          offsetRow: offsetRow ?? { x: 0, y: size.height + cellGap!.y }
        }
        continue;
      }

      if (haphazardly) {
        haphazardly *= .2 + Math.max(0, cellGap ?
          cellGap.x / size.width + cellGap.y / size.height :
          (Math.abs(offsetColumn!.x) + Math.abs(offsetColumn!.y) + Math.abs(offsetRow!.y) + Math.abs(offsetColumn!.y) - 200) / 100);
      } else {
        haphazardly = 0;
      }
      //console.log('haphazardly', haphazardly);

      const startingOffset = {x: 0, y: 0};

      const corners = '_cornerPositions' in el ? (el._cornerPositions as () => [number, number][])() : [
        [1, 1],
        [columns, 1],
        [1, rows],
        [columns, rows],
      ] as [number, number][];

      let totalAreaNeeded = getTotalArea(corners, area, size, columns, rows, startingOffset, cellGap, offsetColumn, offsetRow);

      let scale: Vector = {x: 1, y: 1};

      if (scaling) {
        if (scaling === 'fill') {
          // match the dimension furthest, spilling one dimesion out of bounds
          const s = Math.max(area.width / totalAreaNeeded.width, area.height / totalAreaNeeded.height);
          scale = {x: s, y: s};
        } else if (scaling === 'fit' && attributes.size) { // if size was not given, size was already calculated as 'fit'
          // match the closest dimension, pushing one dimesion inside
          const s = Math.min(area.width / totalAreaNeeded.width, area.height / totalAreaNeeded.height);
          scale = {x: s, y: s};
        }

        // reduce scale if necessary to keep size below amount needed for min rows/cols
        const largestCellSize = cellSizeForArea(
          Math.min(minRows, effecitveRowsWithOffsets), Math.min(minColumns, effecitveColumnsWithOffsets),
          area, cellGap, offsetColumn, offsetRow, rhomboid
        );
        if (maxOverlap !== undefined) {
          const largestCellSize2 = cellSizeForArea(rows, columns, area, undefined,
            { x: Math.min(100 - maxOverlap, offsetColumn?.x ?? 100), y: Math.min(100 - maxOverlap, offsetColumn?.y ?? 0) },
            { x: Math.min(100 - maxOverlap, offsetRow?.x ?? 0), y: Math.min(100 - maxOverlap, offsetRow?.y ?? 100) }
          );
          largestCellSize.width = Math.min(largestCellSize.width, largestCellSize2.width);
          largestCellSize.height = Math.min(largestCellSize.height, largestCellSize2.height);
        }

        if (size.width * scale.x > largestCellSize.width) {
          const reduction = largestCellSize.width / size.width / scale.x;
          scale.x *= reduction;
          scale.y *= reduction;
        }
        if (size.height * scale.y > largestCellSize.height) {
          const reduction = largestCellSize.height / size.height / scale.y;
          scale.x *= reduction;
          scale.y *= reduction;
        }

        //console.log('pre-scale', largestCellSize, area, size, totalAreaNeeded, alignOffset, scale);

        size.width *= scale.x;
        size.height *= scale.y;
      }

      if (!cellGap) { // non-othogonal grid
        if (scaling !== 'fit') {
          // reduce offset along dimension needed to squish
          if (area.width * scale.x / totalAreaNeeded.width > area.height * scale.y / totalAreaNeeded.height) {
            const offsetScale = (area.height - size.height) / (totalAreaNeeded.height * scale.y - size.height);
            if (offsetScale < 1) {
              scale.y = scale.x = area.height / totalAreaNeeded.height;
              offsetColumn!.y *= offsetScale;
              offsetRow!.y *= offsetScale;
            }
          } else {
            const offsetScale = (area.width - size.width) / (totalAreaNeeded.width * scale.x - size.width);
            if (offsetScale < 1) {
              scale.y = scale.x = area.width / totalAreaNeeded.width;
              offsetColumn!.x *= offsetScale;
              offsetRow!.x *= offsetScale;
            }
          }

          totalAreaNeeded = getTotalArea(corners, area, size, columns, rows, startingOffset, cellGap, offsetColumn, offsetRow);
        }
        // align in reduced area
        startingOffset.x += area.left - totalAreaNeeded.left * scale.x + alignOffset.left * (area.width - totalAreaNeeded.width * scale.x);
        startingOffset.y += area.top - totalAreaNeeded.top * scale.y + alignOffset.top * (area.height - totalAreaNeeded.height * scale.y);
        //console.log('align', area, size, totalAreaNeeded, alignOffset, startingOffset, scale);

      } else { // orthogonal

        if (scaling === 'fill') {
          // reduce gap to squish it to fit, creating overlap
          if (rows > 1) cellGap.y = Math.min(cellGap.y || 0, (area.height - rows * size.height) / (rows - 1));
          if (columns > 1) cellGap.x = Math.min(cellGap.x || 0, (area.width - columns * size.width) / (columns - 1));
        }

        // align in reduced area
        const newWidth = columns * (size.width + cellGap.x!) - cellGap.x!;
        startingOffset.x += alignOffset.left * (area.width - newWidth);
        const newHeight = rows * (size.height + cellGap.y!) - cellGap.y!;
        startingOffset.y += alignOffset.top * (area.height - newHeight);
      }

      //console.log('size, area after fit/fill adj', size, area, scale, cellGap)
      for (let c = 0; c < children.length && c < cells.length; c++) {
        let [column, row] = cells[c];
        if (column !== undefined && row !== undefined) {
          column -= origin.column - 1;
          row -= origin.row - 1;
          const box = cellBoxRC(column, row, area, size!, columns, rows, startingOffset, cellGap, offsetColumn, offsetRow);
          if (box) cellBoxes[c] = box;
        }
      }

      layouts[l].grid = {
        anchor: startingOffset,
        origin,
        rows,
        columns,
        offsetColumn: offsetColumn ?? { x: size.width + cellGap!.x, y: 0 },
        offsetRow: offsetRow ?? { x: 0, y: size.height + cellGap!.y }
      }
    }

    // apply the final box to each child
    const prandom = random.create('ge' + el.name).random;
    for (let i = 0; i !== children.length; i++) {
      const box = cellBoxes[i];
      if (!box) continue;
      const child = children[i];
      const render: UIRender = ui.all[String(child._t.ref)] = {
        element: child,
        key: 'isSpace' in child ? String(child._t.ref) : uuid(),
        styles: {},
        layouts: [],
        parentRef: el._t.ref
      };
      let { width, height, left, top } = box;
      let transformOrigin: string | undefined = undefined;
      const gridSize = el._sizeNeededFor(child);
      if (gridSize.width !== 1 || gridSize.height !== 1) {
        height *= (child._size!.height ?? 1);
        width *= (child._size!.width ?? 1);
        if (child.rotation === 90) {
          transformOrigin = `${50 * child._size!.height / child._size!.width}% 50%`;
        }
        if (child.rotation === 270) {
          transformOrigin = `50% ${50 * child._size!.width / child._size!.height}%`;
        }
      } else {
        if (child._ui.appearance.aspectRatio || child._size) {
          const aspectRatio = (child._ui.appearance.aspectRatio ?? 1) * (child._size?.width ?? 1) / (child._size?.height ?? 1) * absoluteTransform.height / absoluteTransform.width;

          if (aspectRatio && aspectRatio !== width / height) {
            if (aspectRatio > width / height) {
              height = width / aspectRatio;
            } else {
              width = aspectRatio * height;
            }
          }
          left = box.left + (box.width - width) / 2;
          top = box.top + (box.height - height) / 2;
        }
        if (maxSize && maxSize > 0 && sizes[i] && sizes[i] !== maxSize) {
          const scale = sizes[i]! / maxSize;
          left += width * 0.5 * (1 - scale);
          top += height * 0.5 * (1 - scale);
          height *= scale;
          width *= scale;
        }
      }

      if (haphazardly) {
        let wiggle = {x: 0, y: 0};
        let overlap = Infinity;
        for (let tries = 0; tries < 10; tries ++) {
          const rx = prandom();
          const ry = prandom();
          const w = {
            x: haphazardly ? Math.min(
              area.left + area.width - left - width,
              Math.max(area.left - left, (rx - ((left - area.left) / (area.width - width) - .5) / 2 - .5) * haphazardly * (size!.width + size!.height))
            ): 0,
            y: haphazardly ? Math.min(
              area.top + area.height - top - height,
              Math.max(area.top - top, (ry - ((top - area.top) / (area.height - height) - .5) / 2 - .5) * haphazardly * (size!.width + size!.height))
            ): 0
          }
          let worstOverlapElTry = Infinity;
          if (children.every(c => {
            const render = ui.all[String(c._t.ref)]
            if (!render.relPos) return true;
            const cbox = render.relPos;
            const childOverlap = Math.min(
              Math.max(0, cbox.left + cbox.width - left - w.x),
              Math.max(0, cbox.top + cbox.height - top - w.y),
              Math.max(0, left + width + w.x - cbox.left),
              Math.max(0, top + height + w.y - cbox.top)
            );
            if (childOverlap === 0) return true;
            worstOverlapElTry = Math.min(childOverlap, worstOverlapElTry);
          })) {
            wiggle = w;
            break;
          }
          if (worstOverlapElTry < overlap) {
            overlap = worstOverlapElTry;
            wiggle = w;
          }
        }
        left += wiggle.x
        top += wiggle.y
      }

      render.relPos = { width, height, left, top };
      render.pos = translate(render.relPos, ui.all[String(el._t.ref)].pos!);
      if (child._rotation !== undefined) render.relPos.rotation = render.pos.rotation = child._rotation;

      applyBaseStyles(render, child, ui);
      if (transformOrigin) render.baseStyles!.transformOrigin = transformOrigin;

      render.layouts = calcLayouts(child, ui);
      layouts[l].children.push(render);
    }

    if (allChildren && allChildren.length > children.length) {
      const unrendered = el._t.order === 'stacking' ? allChildren.slice(0, allChildren.length - children.length) : allChildren.slice(children.length);
      // items beyond the layout limit inherit the appearance of the last item
      for (const child of unrendered) {
        const render = {element: child, layouts: [], proxy: children[el._t.order === 'stacking' ? 0 : children.length - 1]._t.ref, key: uuid()};
        ui.all[child._t.ref] = render;
        layouts[l].children.unshift(render);
      }
    }
  }
  return layouts;
}

function applyBaseStyles(render: UIRender, element: GameElement, ui: UI) {
  render.styles = {
    width: render.relPos!.width + '%',
    height: render.relPos!.height + '%',
    left: render.relPos!.left + '%',
    top: render.relPos!.top + '%',
    fontSize: render.pos!.height * (ui.frame?.y ?? 100) * 0.0004 + 'rem'
  }

  render.attributes = element.attributeList();
  render.attributes.mine = element.mine;
  render.dataAttributes = Object.assign(
    {
      'data-player': element.player?.position
    },
    Object.fromEntries(Object.entries(render.attributes).filter(([key, val]) => (
      typeof val !== 'object' && (element.isVisible() || (element.constructor as typeof GameElement).visibleAttributes?.includes(key))
    )).map(([key, val]) => (
      [`data-${key.toLowerCase()}`, serialize(val)]
    )))
  );

  const baseClass = 'isSpace' in element ? 'Space' : 'Piece';

  render.classes = `${baseClass} ${element._ui.appearance.className ?? ''} ${baseClass !== element.constructor.name ? element.constructor.name : ''}`;

  render.baseStyles = {};
  if (element._rotation !== undefined) render.baseStyles.transform = `rotate(${element._rotation}deg)`;
  if (element.player) Object.assign(render.baseStyles, {'--player-color': element.player.color});
}

function getLayoutItems(el: GameElement) {
  const layoutItems: (GameElement[] | undefined)[] = [];

  const layouts = [...el._ui.layouts].sort((a, b) => {
    let aVal = 0, bVal = 0;
    if (a.applyTo instanceof GameElement) aVal = 3
    if (b.applyTo instanceof GameElement) bVal = 3
    if (typeof a.applyTo === 'string') aVal = 2
    if (typeof b.applyTo === 'string') bVal = 2
    if (a.applyTo instanceof Array) aVal = 1
    if (b.applyTo instanceof Array) bVal = 1
    if (aVal !== 0 || bVal !== 0) return aVal - bVal;
    const ac = a.applyTo as ElementClass;
    const bc = b.applyTo as ElementClass;
    return ac.prototype instanceof bc ? 1 : (bc.prototype instanceof ac ? -1 : 0);
  }).reverse();

  for (const child of el._t.children) {
    if (child._ui.appearance.render === false) continue;
    for (const layout of layouts) {
      const { applyTo } = layout;
      const l = el._ui.layouts.indexOf(layout);

      if ((typeof applyTo === 'function' && child instanceof applyTo) ||
        (typeof applyTo === 'string' && child.name === applyTo) ||
        child === applyTo ||
        (applyTo instanceof ElementCollection && applyTo.includes(child))
      ) {
        layoutItems[l] ??= [];
        if (el._t.order === 'stacking') {
          layoutItems[l]!.unshift(child);
        } else {
          layoutItems[l]!.push(child);
        }
        break;
      }
    }
  }
  return layoutItems;
}

/**
 * calculate working area
 * @internal
 */
function getArea(el: GameElement, ui: UI, attributes: { margin?: number | { top: number, bottom: number, left: number, right: number }, area?: Box }): Box {
  let { area, margin } = attributes;
  if (area) return area;
  if (!margin) return { left: 0, top: 0, width: 100, height: 100 };

  // margins are absolute, so translate
  const absoluteTransform = absPositionSquare(el, ui);
  const transform: Vector = {
    x: absoluteTransform.width / 100,
    y: absoluteTransform.height / 100
  }

  margin = (typeof margin === 'number') ? { left: margin, right: margin, top: margin, bottom: margin } : {...margin};
  margin.left /= transform.x;
  margin.right /= transform.x;
  margin.top /= transform.y;
  margin.bottom /= transform.y;

  return {
    left: margin.left,
    top: margin.top,
    width: 100 - margin.left - margin.right,
    height: 100 - margin.top - margin.bottom
  };
}

export function translate(original: Box, transform: Box): Box {
  return {
    left: original.left * transform.width / 100 + transform.left,
    top: original.top * transform.height / 100 + transform.top,
    width: original.width * transform.width / 100,
    height: original.height * transform.height / 100,
  };
}

export function cellBoxRC(
  column: number,
  row: number,
  area: Box,
  size: {width: number, height: number},
  columns: number,
  rows: number,
  startingOffset: Vector,
  cellGap?: Vector,
  offsetColumn?: Vector,
  offsetRow?: Vector,
): Box | undefined {
  if (column > columns || row > rows) return;
  column -= 1;
  row -= 1;

  return {
    left: area!.left + startingOffset.x + (
      cellGap ?
        column * (size.width + cellGap!.x) :
        (size!.width * (column * offsetColumn!.x + row * offsetRow!.x)) / 100
    ),
    top: area!.top + startingOffset.y + (
      cellGap ?
        row * (size.height + cellGap!.y) :
        (size!.height * (row * offsetRow!.y + column * offsetColumn!.y)) / 100
    ),
    width: size.width,
    height: size.height,
  }
}

export function cellSizeForArea(
  rows: number,
  columns: number,
  area: { width: number, height: number },
  gap?: Vector,
  offsetColumn?: Vector,
  offsetRow?: Vector,
  rhomboid?: boolean
) {
  let width: number;
  let height: number;

  if (offsetColumn === undefined) {
    width = (area.width - (gap!.x || 0) * (columns - 1)) / columns;
    height = (area.height - (gap!.y || 0) * (rows - 1)) / rows;
  } else {
    width = area.width / (
      (rhomboid ? (rows - 1) * Math.abs(offsetRow!.x / 100) : 0) +
        1 + (columns - 1) * Math.abs(offsetColumn.x / 100)
    )
    height = area.height / (
      (rhomboid ? (columns - 1) * Math.abs(offsetColumn.y / 100) : 0) +
        1 + (rows - 1) * Math.abs(offsetRow!.y / 100)
    )
  }

  return { width, height };
}

// find the edge boxes and calculate the total size needed
// @internal
export function getTotalArea(
  corners: [number, number][],
  area: Box,
  size: {width: number, height: number},
  columns: number,
  rows: number,
  startingOffset: Vector,
  cellGap?: Vector,
  offsetColumn?: Vector,
  offsetRow?: Vector,
): Box {
  const boxes = corners.map(corner => (
    cellBoxRC(corner[0], corner[1], area, size, columns, rows, startingOffset, cellGap, offsetColumn, offsetRow)
  ));

  const cellArea = {
    top: Math.min(...boxes.map(b => b!.top)),
    bottom: Math.max(...boxes.map(b => b!.top + b!.height)),
    left: Math.min(...boxes.map(b => b!.left)),
    right: Math.max(...boxes.map(b => b!.left + b!.width)),
  };

  return {
    width: cellArea.right - cellArea.left,
    height: cellArea.bottom - cellArea.top,
    left: cellArea.left,
    top: cellArea.top
  }
}
