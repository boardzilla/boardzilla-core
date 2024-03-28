import React from 'react'
import { createRoot } from 'react-dom/client';
import { gameStore } from './store.js';
import Main from './Main.js'
import { Game } from '../board/index.js'

import type { User } from './Main.js'
import type { SetupFunction } from '../index.js'
import type { BoardSize, BoardSizeMatcher } from '../board/game.js';

export { ProfileBadge } from './game/components/ProfileBadge.js';
import {
  toggleSetting,
  numberSetting,
  textSetting,
  choiceSetting
} from './setup/components/settingComponents.js';
export {
  toggleSetting,
  numberSetting,
  textSetting,
  choiceSetting
};

export type SetupComponentProps = {
  name: string,
  settings: Record<string, any>,
  players: User[],
  updateKey: (key: string, value: any) => void,
}

/**
 * The core function called to customize the game's UI.
 *
 * @param {Object} options
 * @param options.settings - Define your game's settings that the host can
 * customize.  This is an object consisting of custom settings. The key is a
 * name for this setting that can be used in {@link Game#setting} to retrieve
 * the setting's value for this game. The object is the result of calling one of
 * the setting functions {@link toggleSetting}, {@link numberSetting}, {@link
 * textSetting} or {@link choiceSetting}.
 *
 * @param options.boardSizes - An array of possible boardsizes depending on the
 * device type and viewport of the player. Each item in the list is a possible
 * board size and must include at least a unique `name` and an
 * `aspectRatio`. When a player joins, or resizes their screen, a layout will be
 * chosen that meets the conditions given and is the closest fit.
 * <ul>

 * <li>`name`: A unique name used to identify this board size. The name of the
 * layout chosen for the player will be passed to the `layout` function below.
 * <li>`aspectRatio`: The aspect ratio for this board size. Either a number (width
 * / height), or an object with keys `min` and `max` with numbers that give a
 * a possible range of aspect ratios. If providing a range, any aspect ratio
 * within the range could be selected if it's a match for the player's
 * viewport. You must ensure your game layout looks correct for the entire range
 * provided.
 * <li>`mobile`: If true, this layout will only be used for mobile devices. If
 * false, this layout will not be used for mobile devices. If blank, it may be
 * used in any case.
 * <li>`desktop`: If true, this layout will only be used for desktop screens. If
 * false, this layout will not be used for desktop. If blank, it may be used in
 * any case.
 * <li>`orientation`: If supplied, the layout will match a mobile screen size if
 * either orientation matches the aspect ratio. if chosen as the best match
 * board size, the player's screen will be locked to the given orientation.
 * <li>`scaling`: Specifies how the screen should fit the board if it is not a
 * perfect fit for the aspect ratio. If 'fit' the board size will be fit within
 * the screen, with blank space on the sides or top and bottom. If 'scroll', the
 * board will be fit to maximize it's space and scroll vertically or
 * horizontally.
 * </ul>
 *
 * @param options.layout - A function for declaring all UI customization in the
 * game. The function will receives 3 arguments:
 * <ul>
 * <li>`game`: The {@link Game} instance.
 * <li>`player`: The {@link Player} who is viewing.
 * <li>`boardSize`: The name of the selected `boardSize` from above.
 * </ul>
 * Typically this will include calls to {@link GameElement#layout}, {@link
 * GameElement#appearance}, {@link Game#layoutStep} and {@link
 * Game#layoutAction}.
 *
 * @param options.announcements - A list of announcements. Each is a function
 * that accepts the {@link Game} object and returns the JSX of the
 * announcement. These can be called from {@link Game#announce} or {@link
 * Game#finish}.
 *
 * @param options.infoModals - A list of informational panels that appear in the
 * info sidebar. Each is an object with:
 * <ul>
 * <li>title: The title shown in the sidebar
 * <li>modal: a function that accepts the {@link Game} object and returns the JSX
 *   of the modal.
 * <li>condition: An optional condition function that accepts the {@link Game}
 *   object and returns as a boolean whether the modal should be currently
 *   available
 * </ul>
 *
 * @category UI
 */
export const render = <G extends Game>(setup: SetupFunction<G>, options: {
  settings?: Record<string, (p: SetupComponentProps) => JSX.Element>
  boardSizes?: ((screenX: number, screenY: number, mobile: boolean) => BoardSize) | BoardSizeMatcher[],
  layout?: (game: G, player: NonNullable<G['player']>, boardSize: string) => void,
  announcements?: Record<string, (game: G) => JSX.Element>
  infoModals?: {title: string, modal: (game: G) => JSX.Element}[]
}): void => {
  let { settings, boardSizes, layout, announcements, infoModals } = options;
  const state = gameStore.getState();
  const setupGame: SetupFunction<G> = state => {
    const gameManager = setup(state);
    if (boardSizes instanceof Array) {
      const bothOrientations = boardSizes.some(bs => bs.orientation === 'landscape') && boardSizes.some(bs => bs.orientation === 'portrait');
      const bss = boardSizes.map(bs => ({
        ...bs,
        aspectRatio: typeof bs.aspectRatio === 'number' ? bs.aspectRatio : { min: Math.min(bs.aspectRatio.min, bs.aspectRatio.max), max: Math.max(bs.aspectRatio.min, bs.aspectRatio.max) }
      }))
      gameManager.game._ui.boardSizes = (screenX, screenY, mobile) => {
        let aspectRatio = screenX / screenY;
        let flipped: boolean | undefined = undefined;
        let portrait = aspectRatio;
        let landscape = aspectRatio;
        if (mobile && !bothOrientations) {
          if (aspectRatio < 1) {
            landscape = 1 / aspectRatio;
          } else {
            portrait = 1 / aspectRatio;
          }
        }
        const boardSize = bss.filter(
          bs => (bs.mobile ?? mobile) === mobile && (bs.desktop ?? !mobile) === !mobile
        ).sort(
          (bs1, bs2) => {
            const d1 = Math.max(
              (typeof bs1.aspectRatio === 'number' ? bs1.aspectRatio : bs1.aspectRatio.min) - (bs1.orientation === 'landscape' ? landscape : (bs1.orientation === 'portrait' ? portrait : aspectRatio)),
              (bs1.orientation === 'landscape' ? landscape : (bs1.orientation === 'portrait' ? portrait : aspectRatio)) - (typeof bs1.aspectRatio === 'number' ? bs1.aspectRatio : bs1.aspectRatio.max)
            );
            const d2 = Math.max(
              (typeof bs2.aspectRatio === 'number' ? bs2.aspectRatio : bs2.aspectRatio.min) - (bs2.orientation === 'landscape' ? landscape : (bs2.orientation === 'portrait' ? portrait : aspectRatio)),
              (bs2.orientation === 'landscape' ? landscape : (bs2.orientation === 'portrait' ? portrait : aspectRatio)) - (typeof bs2.aspectRatio === 'number' ? bs2.aspectRatio : bs2.aspectRatio.max)
            );
            return d1 > d2 ? 1 : -1;
          }
        )[0];
        if (!boardSize) return undefined;
        if (boardSize.orientation === 'landscape' && aspectRatio < 1 || boardSize.orientation === 'portrait' && aspectRatio > 1) {
          aspectRatio = 1 / aspectRatio;
          flipped = true;
        }
        return {
          ...boardSize,
          aspectRatio: typeof boardSize.aspectRatio === 'number' ?
            boardSize.aspectRatio :
            Math.min(boardSize.aspectRatio.max, Math.max(boardSize.aspectRatio.min, aspectRatio)),
          flipped,
        };
      }
    } else {
      gameManager.game._ui.boardSizes = boardSizes;
    }
    gameManager.game._ui.setupLayout = layout;
    gameManager.game._ui.announcements = announcements ?? {};
    gameManager.game._ui.infoModals = infoModals ?? [];
    return gameManager;
  }
  // we can anonymize Player class internally
  state.setSetup(setupGame);

  const boostrap = JSON.parse(document.body.getAttribute('data-bootstrap-json') || '{}');
  const { host, userID, minPlayers, maxPlayers, defaultPlayers, dev }: {
    host: boolean,
    userID: string,
    minPlayers: number,
    maxPlayers: number,
    defaultPlayers: number,
    dev?: boolean
  } = boostrap;
  state.setHost(host);
  state.setDev(dev);
  state.setUserID(userID);

  const root = createRoot(document.getElementById('root')!)
  root.render(
    <Main
      minPlayers={minPlayers}
      maxPlayers={maxPlayers}
      defaultPlayers={defaultPlayers}
      setupComponents={settings || {}}
    />
  );
};
