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
 * @param options.boardSizes - A function that determines what board size to use
 * based on the player's device and viewport. The function will take the
 * following arguments:
 * <ul>
 * <li>screenX: The player's view port width
 * <li>screenY: The player's view port height
 * <li>mobile: true if using a mobile device
 * </ul>
 * The function should return a string indicating the layout to use, this will
 * be cached and sent to the `layout` function.
 *
 * @param options.layout - A function for declaring all UI customization in the
 * game. Typically this will include calls to {@link GameElement#layout}, {@link
 * GameElement#appearance}, {@link Game#layoutStep} and {@link
 * Game#layoutAction}.
 *
 * @param options.announcements - A list of announcements. Each is a function
 * that accepts the {@link Game} object and returns the JSX of the
 * announcement. These can be called from {@link game#announce} or {@link
 * game.finish}.
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
      const bss = boardSizes.map(bs => ({
        ...bs,
        aspectRatio: typeof bs.aspectRatio === 'number' ? bs.aspectRatio : { min: Math.min(bs.aspectRatio.min, bs.aspectRatio.max), max: Math.max(bs.aspectRatio.min, bs.aspectRatio.max) }
      }))
      gameManager.game._ui.boardSizes = (screenX, screenY, mobile) => {
        let aspectRatio = screenX / screenY;
        let flipped: boolean | undefined = undefined;
        let portrait: number, landscape: number;
        if (aspectRatio < 1) {
          portrait = aspectRatio;
          landscape = 1 / aspectRatio;
        } else {
          portrait = 1 / aspectRatio;
          landscape = aspectRatio;
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
