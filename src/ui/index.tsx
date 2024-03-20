import React from 'react'
import { createRoot } from 'react-dom/client';
import { gameStore } from './store.js';
import Main from './Main.js'
import { Game } from '../board/index.js'

import type { User } from './Main.js'
import type { SetupFunction } from '../index.js'
import type { BoardSize } from '../board/game.js';

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
export const render = <B extends Game>(setup: SetupFunction<B>, options: {
  settings?: Record<string, (p: SetupComponentProps) => JSX.Element>
  boardSizes?: (screenX: number, screenY: number, mobile: boolean) => BoardSize,
  layout?: (game: B, player: NonNullable<B['player']>, boardSize: string) => void,
  announcements?: Record<string, (game: B) => JSX.Element>
  infoModals?: {title: string, modal: (game: B) => JSX.Element}[]
}): void => {
  const { settings, boardSizes, layout, announcements, infoModals } = options;
  const state = gameStore.getState();
  const setupGame: SetupFunction<B> = state => {
    const gameManager = setup(state);
    gameManager.game._ui.boardSizes = boardSizes;
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
