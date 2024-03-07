import {
  Game,
  Space,
  Piece,
  Die,
  GameElement
} from './board/index.js';
import { Action, Selection } from './action/index.js';
import { Player, PlayerCollection } from './player/index.js';
import Flow from './flow/flow.js';

import random from 'random-seed';

import type { ElementClass } from './board/element.js';
import type { PlayerState, GameUpdate, GameState } from './interface.js';
import type { SerializedArg } from './action/utils.js';
import type { Argument, ActionStub } from './action/action.js';
import type { ResolvedSelection } from './action/selection.js';

// find all non-method non-internal attr's
export type PlayerAttributes<T extends Player> = {
  [
    K in keyof InstanceType<{new(...args: any[]): T}>
      as InstanceType<{new(...args: any[]): T}>[K] extends (...args: unknown[]) => unknown ? never : (K extends '_players' | 'game' | 'gameManager' ? never : K)
  ]: InstanceType<{new(...args: any[]): T}>[K]
}

// a Move is a request from a particular Player to perform a certain Action with supplied args
export type Move<P extends Player> = {
  player: P,
  name: string,
  args: Record<string, Argument<P>>
};

export type PendingMove<P extends Player> = {
  name: string,
  prompt?: string,
  args: Record<string, Argument<P>>,
  selections: ResolvedSelection<P>[],
};

export type SerializedMove = {
  name: string,
  args: Record<string, SerializedArg>
}

export type Message = {
  position?: number
  body: string
}

/**
 * Game manager is used to coordinate other classes, the {@link Game}, the
 * {@link Player}'s, the {@link Action}'s and the {@link Flow}.
 * @category Core
 */
export default class GameManager<P extends Player<P, B> = any, B extends Game<P, B> = any> {
  flow: Flow<P>;
  /**
   * The players in this game. See {@link Player}
   */
  players: PlayerCollection<P> = new PlayerCollection<P>;
  /**
   * The game. See {@link Game}
   */
  game: B;
  settings: Record<string, any>;
  actions: Record<string, (player: P) => Action<P, Record<string, Argument<P>>>>;
  sequence: number = 0;
  /**
   * Current game phase
   */
  phase: 'new' | 'started' | 'finished' = 'new';
  rseed: string;
  random: () => number;
  messages: Message[] = [];
  announcements: string[] = [];
  intermediateUpdates: GameState<P>[][] = [];
  /**
   * If true, allows any piece to be moved or modified in any way. Used only
   * during development.
   */
  godMode = false;
  winner: P[] = [];
  followups: ActionStub<P>[] = [];

  constructor(playerClass: {new(...a: any[]): P}, gameClass: ElementClass<B>, elementClasses: ElementClass[] = []) {
    this.players = new PlayerCollection<P>();
    this.game = new gameClass({ gameManager: this, classRegistry: [GameElement, Space, Piece, Die, ...elementClasses]})
    this.players.className = playerClass;
    this.players.game = this.game;
  }

  /**
   * configuration functions
   */

  setSettings(settings: Record<string, any>) {
    this.settings = settings;
  }

  setRandomSeed(rseed: string) {
    this.rseed = rseed;
    this.random = random.create(rseed).random;
    if (this.game.random) this.game.random = this.random;
  }

  /**
   * flow functions
   * @internal
   */

  start() {
    if (this.phase === 'started') throw Error('cannot call start once started');
    if (!this.players.length) {
      throw Error("No players");
    }
    this.phase = 'started';
    this.flow.reset();
  }

  /**
   * state functions
   * @internal
   */

  getState(player?: P): GameState<P> {
    return {
      players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub for player
      settings: this.settings,
      position: this.flow.branchJSON(!!player),
      board: this.game.allJSON(player?.position),
      sequence: this.sequence,
      messages: this.messages.filter(m => player && (!m.position || m.position === player?.position)),
      announcements: [...this.announcements],
      rseed: player ? '' : this.rseed,
    }
  }

  getPlayerStates(): PlayerState<P>[] {
    return this.players.map((p, i) => ({
      position: p.position,
      state: this.intermediateUpdates.length ?
        this.intermediateUpdates.map(state => state[i]).concat([this.getState(p)]) :
        this.getState(p)
    }));
  }

  getUpdate(): GameUpdate<P> {
    this.sequence += 1;
    if (this.phase === 'started') {
      return {
        game: {
          state: this.getState(),
          currentPlayers: this.players.currentPosition,
          phase: this.phase
        },
        players: this.getPlayerStates(),
        messages: this.messages,
      }
    }
    if (this.phase === 'finished') {
      return {
        game: {
          state: this.getState(),
          winners: this.winner.map(p => p.position),
          phase: this.phase
        },
        players: this.getPlayerStates(),
        messages: this.messages,
      }
    }
    throw Error('unable to initialize game');
  }

  contextualizeBoardToPlayer(player?: P) {
    const prev = this.game._ctx.player;
    this.game._ctx.player = player;
    return prev;
  }

  inContextOfPlayer<T>(player: P, fn: () => T): T {
    const prev = this.contextualizeBoardToPlayer(player);
    const results = fn();
    this.contextualizeBoardToPlayer(prev);
    return results;
  }

  trackMovement(track=true) {
    if (this.game._ctx.trackMovement !== track) {
      this.game._ctx.trackMovement = track;
      if (track) this.intermediateUpdates = [];
    }
  }

  /**
   * action functions
   */

  getAction(name: string, player: P) {
    if (this.godMode) {
      const godModeAction = this.godModeActions()[name];
      if (godModeAction) {
        godModeAction.name = name;
        return godModeAction as Action<P, any> & {name: string};
      }
    }

    if (!this.actions[name]) throw Error(`No action found: "${name}". All actions must be specified in defineActions()`);

    return this.inContextOfPlayer(player, () => {
      const action = this.actions[name](player);
      action.gameManager = this;
      action.name = name;
      return action as Action<P, any> & {name: string};
    });
  }

  godModeActions(): Record<string, Action<P, any>> {
    if (this.phase !== 'started') throw Error('cannot call god mode actions until started');
    return {
      _godMove: this.game.action({
        prompt: "Move",
      }).chooseOnBoard(
        'piece', this.game.all(Piece<P, B>),
      ).chooseOnBoard(
        'into', this.game.all(GameElement<P, B>)
      ).move(
        'piece', 'into'
      ),
      _godEdit: this.game.action({
        prompt: "Change",
      })
        .chooseOnBoard('element', this.game.all(GameElement<P, B>))
        .chooseFrom<'property', string>(
          'property',
          ({ element }) => Object.keys(element).filter(a => !GameElement.unserializableAttributes.concat(['_visible', 'mine', 'owner']).includes(a)),
          { prompt: "Change property" }
        ).enterText('value', {
          prompt: ({ property }) => `Change ${property}`,
          initial: ({ element, property }) => String(element[property as keyof GameElement<P>])
        }).do(({ element, property, value }) => {
          let v: any = value
          if (value === 'true') {
            v = true;
          } else if (value === 'false') {
            v = false;
          } else if (parseInt(value).toString() === value) {
            v = parseInt(value);
          }
          // @ts-ignore
          element[property] = v;
      })
    };
  }

  play() {
    if (this.phase === 'finished') return;
    if (this.phase !== 'started') throw Error('cannot call play until started');
    this.flow.play();
  }

  // given a player's move (minimum a selected action), attempts to process
  // it. if not, returns next selection for that player, plus any implied partial
  // moves
  processMove({ player, name, args }: Move<P>): string | undefined {
    if (this.phase === 'finished') return 'Game is finished';
    let error: string | undefined;
    return this.inContextOfPlayer(player, () => {
      if (this.godMode && this.godModeActions()[name]) {
        const godModeAction = this.godModeActions()[name];
        error = godModeAction._process(player, args);
      } else {
        error = this.flow.processMove({
          name,
          player: player.position,
          args
        });
      }
      console.debug(`Received move from player #${player.position} ${name}({${Object.entries(args).map(([k, v]) => `${k}: ${v}`).join(', ')}}) ${error ? '❌ ' + error : ( this.followups ? this.followups.map(f => `⮕ ${f.name}({${Object.entries(f.args || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}})`) : '✅')}`);
      return error;
    });
  }

  allowedActions(player: P): {step?: string, prompt?: string, description?: string, skipIf: 'always' | 'never' | 'only-one', actions: ActionStub<P>[]} {
    const actions: ActionStub<P>[] = this.godMode ? Object.keys(this.godModeActions()).map(name => ({ name })) : [];
    if (!player.isCurrent()) return {
      actions,
      skipIf: 'always',
    };

    const actionStep = this.flow.actionNeeded(player);
    if (actionStep?.actions) {
      for (const allowedAction of actionStep.actions) {
        if (allowedAction.name === '__pass__') {
          actions.push(allowedAction);
        } else {
          const gameAction = this.getAction(allowedAction.name, player);
          if (gameAction.isPossible(allowedAction.args)) {
            // step action config take priority over action config
            actions.push({ ...gameAction, ...allowedAction, player });
          }
        }
      }
      return {
        ...actionStep,
        actions
      }
    }

    // check any other current players, if no action possible, warn and skip somehow ???
    return {
      skipIf: 'always',
      actions: []
    };
  }

  getPendingMoves(player: P, name?: string, args?: Record<string, Argument<P>>): {step?: string, prompt?: string, moves: PendingMove<P>[]} | undefined {
    if (this.phase === 'finished') return;
    const allowedActions = this.allowedActions(player);
    if (!allowedActions.actions.length) return;
    const { step, prompt, actions, skipIf } = allowedActions;

    if (!name) {
      let possibleActions: string[] = [];
      let pendingMoves: PendingMove<P>[] = [];
      for (const action of actions) {
        if (action.name === '__pass__') {
          possibleActions.push('__pass__');
          pendingMoves.push({
            name: '__pass__',
            args: {},
            selections: [
              new Selection<P>('__action__', { prompt: action.prompt, value: '__pass__' }).resolve({})
            ]
          });
        } else {
          const playerAction = this.getAction(action.name, player)
          const args = action.args || {}
          let submoves = playerAction._getPendingMoves(args);
          if (submoves !== undefined) {
            possibleActions.push(action.name);
            // no sub-selections to show so just create a prompt selection of this action
            // if an explcit confirm is required, this would be where to add the logic for it, e.g. playerAction.explicit? => selection[0].confirm
            if (submoves.length === 0 || skipIf === 'never' || (skipIf === 'only-one' && actions.length > 1)) {
              submoves = [{
                name: action.name,
                prompt,
                args,
                selections: [
                  new Selection<P>('__action__', {
                    prompt: action.prompt ?? playerAction.prompt,
                    value: action.name,
                    skipIf
                  }).resolve({})
                ]
              }];
            }
            pendingMoves = pendingMoves.concat(submoves);
          } else {
            console.debug(`Action ${action.name} not allowed because no valid selections exist`);
          }
        }
      }

      if (!possibleActions.length) return undefined;
      return { step, prompt, moves: pendingMoves};

    } else {
      if (name === '__pass__') return { step, prompt, moves: [] };
      const moves = this.getAction(name, player)?._getPendingMoves(args || {});
      if (moves) return { step, prompt, moves };
    }
  }
}
