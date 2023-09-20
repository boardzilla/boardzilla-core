import { Action, Selection, MoveAction } from './action/';
import {
  Board,
  Space,
  Piece,
  GameElement
} from './board/';
import { PlayerAction } from './flow/';
import type { Flow } from './flow/';

import { GameState, PlayerState } from './types';
import { ElementClass } from './board/types';
import { Player, PlayerCollection } from './player/';
import type {
  Move,
  IncompleteMove,
  ResolvedSelection,
  MoveResponse
} from './action/types';
import type { PlayerAttributes } from './player/types';

export default class Game<P extends Player, B extends Board> {
  flow: Flow;
  flowDefinition: (game: typeof this, board: B) => Flow;
  players: PlayerCollection<P> = new PlayerCollection<P>;
  board: B;
  settings: Record<string, any>;
  actions: (game: Game<P, B>, board: B) => Record<string, (p: P) => Action>;
  phase: 'define' | 'new' | 'started'
  minPlayers = 1;
  maxPlayers: number;
  godMode = false;

  constructor() {
    this.phase = 'define';
  }

  /**
   * configuration functions
   */
  defineFlow(flowDefinition: typeof this.flowDefinition) {
    if (this.phase !== 'define') throw Error('cannot call defineFlow once started');
    this.flowDefinition = flowDefinition;
  }

  action(name: string, player: P) {
    if (this.godMode) {
      const action = this.godModeActions()[name];
      if (action) return action;
    }
    return this.inContextOfPlayer(player, () => {
      const action = this.actions(this, this.board)[name];
      if (!action) throw Error(`No such action ${name}`);
      return action(player);
    });
  }

  defineActions(actions: (game: Game<P, B>, board: B) => Record<string, (p: P) => Action>) {
    if (this.phase !== 'define') throw Error('cannot call defineActions once started');
    this.actions = actions;
  }

  defineBoard(
    className: {
      new(...classes: ElementClass<GameElement>[]): B;
      isGameElement: boolean;
    },
    classRegistry: ElementClass<GameElement>[]
  ): B {
    if (this.phase !== 'define') throw Error('cannot call defineActions once started');
    this.board = new className(GameElement, Space, Piece, ...classRegistry)
    this.board._ctx.game = this as unknown as Game<Player, Board>;
    return this.board;
  }

  definePlayers(
    className: {new(...a: any[]): P},
  ): PlayerCollection<P> {
    if (this.phase !== 'define') throw Error('cannot call definePlayer once started');
    this.players = new PlayerCollection<P>();
    this.players.className = className;
    return this.players as PlayerCollection<P>;
  }

  setSettings(settings: Record<string, any>) {
    this.settings = settings;
  }

  godModeActions(): Record<string, Action> {
    if (this.phase !== 'started') throw Error('cannot call god mode actions until started');
    return {
      _godMove: new MoveAction({
        prompt: "Move anything",
        promptTo: "To anywhere",
        piece: {
          chooseFrom: this.board.all(Piece)
        },
        to: {
          chooseFrom: this.board.all(GameElement)
        },
      }),
      _godEdit: new Action({
        prompt: "Change anything",
        selections: [{
          prompt: "Select element",
          selectOnBoard: {
            chooseFrom: this.board.all(GameElement)
          }
        }, {
          prompt: "Change what?",
          selectFromChoices: {
            choices: (el: GameElement) => Object.keys(el).filter(a => !['_t', '_ctx', '_eventHandlers', 'mine', 'board'].includes(a))
          }
        }, {
          prompt: "Change to",
          enterText: {
            default: (el: GameElement, attr: keyof GameElement) => String(el[attr])
          }
        }],
        move: (el: GameElement, attr: keyof GameElement, value: any) => {
          if (value === 'true') {
            value = true;
          } else if (value === 'false') {
            value = false;
          } else if (parseInt(value).toString() === value) {
            value = parseInt(value);
          }
          // @ts-ignore
          el[attr] = value
        }
      })
    };
  }

  start() {
    if (this.phase === 'started') throw Error('cannot call start once started');
    if (!this.players.length) {
      throw Error("No players");
    }
    this.phase = 'started';
    this.buildFlow();
    this.flow.start();
  }

  buildFlow() {
    this.flow = this.flowDefinition(this, this.board);
    this.flow.ctx.game = this as unknown as Game<Player, Board>;
  }

  setState(state: GameState<P>) {
    this.players.fromJSON(state.players);
    this.players.currentPosition = state.currentPlayerPosition;
    this.setSettings(state.settings);
    this.board.fromJSON(state.board);
    this.buildFlow();
    this.phase = 'started';
    this.flow.setBranchFromJSON(state.position);
  }

  getState(): GameState<P> {
    return {
      players: this.players.map(p => p.toJSON() as PlayerAttributes<P>),
      currentPlayerPosition: this.players.currentPosition,
      settings: this.settings,
      position: this.flow.branchJSON(false),
      board: this.board.allJSON(),
    };
  }

  getPlayerStates(): PlayerState<P>[] {
    return this.players.map(p => ({
      position: p.position,
      state: {
        players: this.players.map(p => p.toJSON() as PlayerAttributes<P>), // TODO scrub
        currentPlayerPosition: this.players.currentPosition,
        settings: this.settings,
        position: this.flow.branchJSON(true),
        board: this.board.allJSON(p.position)
      }
    }));
  }

  /**
   * action functions
   */
  play() {
    if (this.phase !== 'started') throw Error('cannot call play until started');
    return this.flow.play();
  }

  // Returns selection for a player, providing any forced args if there's a single action available
  // If only one action and no selection even needed, just returns a confirmation request
  currentSelection(player: P): MoveResponse<P> {
    let move: IncompleteMove<P> = { player, args: [] };
    return this.inContextOfPlayer(player, () => {
      const actions = this.allowedActions(player);

      if (!actions || actions.length === 0) return {move}
      if (actions.length === 1) { // only one action to choose, so choose it
        const action = this.action(actions[0], player);
        let [selection, forcedArgs, error] = action.forceArgs();
        if (error) throw Error(`${error} at currentSelection which should not be allowed. allowedActions should not have provided this action`)
        // if no selection needed, provide a confirmation prompt (TODO get the final prompt)
        if (!selection) selection = new Selection({ prompt: `Please confirm: ${action.prompt}`, click: true }) as ResolvedSelection;
        return {
          move: {
            action: actions[0],
            args: forcedArgs || [],
            player
          },
          selection
        };
      } else {
        const step = this.flow.currentStep();
        if (step instanceof PlayerAction) {
          return {
            selection: new Selection({ // selection is between multiple actions, return action choices
              prompt: step.prompt || 'Choose action',
              selectFromChoices: {
                choices: Object.fromEntries(actions.map(a => [a, this.action(a, player).prompt]))
              }
            }) as ResolvedSelection,
            move,
          };
        }
        return {move};
      }
    });
  }

  // given a player's move (minimum a selected action), attempts to process
  // it. if not, returns next selection for that player, plus any implied partial
  // moves
  processMove({ player, action, args }: Move<P>): MoveResponse<P> {
    let resolvedSelection, truncatedArgs, error;
    return this.inContextOfPlayer(player, () => {
      if (this.godMode && this.godModeActions()[action]) {
        const godModeAction = this.godModeActions()[action];
        [resolvedSelection, truncatedArgs, error] = godModeAction.process(...args);
      } else {
        [resolvedSelection, truncatedArgs, error] = this.flow.processMove({
          action,
          player: player.position,
          args
        });
      }
      if (resolvedSelection) return {
        selection: resolvedSelection,
        move: {action, player, args: truncatedArgs || []},
        error
      };
      // successful move
      return {
        move: {action, player, args},
      };
    });
  }

  allowedActions(player: P): string[] {
    const allowedActions = this.godMode ? Object.keys(this.godModeActions()) : [];
    if (this.players.currentPosition && player !== this.players.current()) return allowedActions;
    return this.inContextOfPlayer(player, () => {
      let actions = this.flow.actionNeeded();
      if (!actions) return allowedActions;
      return allowedActions.concat(actions.filter(a => this.action(a, player).isPossible()));
    });
  }

  inContextOfPlayer<T>(player: P, fn: () => T): T {
    const prev = this.board._ctx.player;
    this.board._ctx.player = player;
    const results = fn();
    this.board._ctx.player = prev;
    return results;
  }
}
