import Flow from './flow.js';
import { FlowControl, LoopInterruptControl } from './enums.js';

import type { FlowDefinition, FlowBranchNode, FlowBranchJSON } from './flow.js';
import type { Player } from '../player/index.js';
import { Argument } from '../action/action.js';

export type EveryPlayerPosition = {positions: FlowBranchJSON[][], completed: (boolean | undefined)[]};

export default class EveryPlayer<P extends Player> extends Flow<P> {
  position: EveryPlayerPosition;
  players?: P[];
  value: number; // player temporarily looking at
  completed: (boolean | undefined)[] = [];
  block: FlowDefinition<P>;
  type: FlowBranchNode<P>['type'] = 'parallel';

  constructor({ players, do: block, name }: {
    players?: P[],
    do: FlowDefinition<P>,
    name?: string
  }) {
    super({ do: block, name });
    this.players = players;
  }

  reset() {
    this.value = -1;
    this.completed = [];
    this.setPosition({positions: [], completed: []});
  }

  // closure wrapper for super's methods that will setPosition temporarily to a
  // specific player and pretend to be a normal flow with just one subflow
  withPlayer<T>(value: number, fn: () => T, mutate=false): T {
    this.value = value;
    this.setPosition(this.position);
    const result = fn();
    if (mutate) {
      const currentPlayer = this.getPlayers()[this.value];
      // capture position from existing player before returning to all player mode
      if (currentPlayer && this.step instanceof Flow) this.position.positions[this.value] = this.step.branchJSON();
    }
    this.value = -1;
    this.setPosition(this.position);
    return result;
  }

  getPlayers(): P[] {
    return this.players || this.game.players
  }

  // reimpl ourselves to collect json from all players
  branchJSON(forPlayer=true): FlowBranchJSON[] {
    if (this.position === undefined && this.sequence === undefined) return []; // probably invalid
    let branch: FlowBranchJSON = {
      type: this.type,
      position: {positions: [], completed: this.completed}
    };
    if (this.name) branch.name = this.name;

    for (let i = 0; i !== this.getPlayers().length; i++) {
      this.withPlayer(i, () => {
        if (this.step instanceof Flow) branch.position.positions[i] = this.step.branchJSON(forPlayer);
      });
    }
    return [branch];
  }

  // add player management and hydration of flow for the correct player
  setPosition(positionJSON: any, sequence?: number) {
    const player = this.getPlayers()[this.value];
    this.completed = positionJSON.completed;
    if (player) {
      player.setCurrent();
      this.game.contextualizeBoardToPlayer(player);
    } else {
      // no longer looking at an individual player. set game state to accept all players
      const players: P[] = [];
      for (let i = 0; i !== this.getPlayers().length; i++) {
        if (this.completed[i] === false) players.push(this.getPlayers()[i]);
      }
      this.game.players.setCurrent(players);
    }
    super.setPosition(positionJSON, sequence);
    if (this.step instanceof Flow && this.position.positions[this.value]) {
      this.step.setBranchFromJSON(this.position.positions[this.value]);
    }
  }

  // intercept normal setPosition to stop the super chain here and carry it ourselves
  setPositionFromJSON(positionJSON: any, sequence?: number) {
    super.setPositionFromJSON(positionJSON, sequence);
    this.step = undefined; // prevent super trying to reach subflows
  }

  currentBlock() {
    // need to override this within flow methods by setting value. branch
    // set/get should not advance past here, but step function may
    return this.value >= 0 && this.value < this.getPlayers().length ? this.block : undefined;
  }

  actionNeeded(player?: Player) {
    if (player && this.getPlayers().includes(player as P)) {
      return this.withPlayer(this.getPlayers().indexOf(player as P), () => super.actionNeeded(player));
    }
  }

  processMove(move: {
    player: number,
    name: string,
    args: Record<string, Argument<P>>,
  }): string | undefined {
    const player = this.getPlayers().findIndex(p => p.position === move.player);
    if (player < 0) throw Error(`Cannot process action from ${move.player}`);
    return this.withPlayer(player, () => {
      this.completed[player] = undefined;
      return super.processMove(move);
    }, true);
  }

  // intercept super.playOneStep so a single branch doesn't signal complete
  // without us checking all branches
  playOneStep(): LoopInterruptControl | FlowControl | undefined {
    // step through each player over top of the normal super stepping
    const player = this.getPlayers().findIndex((_, p) => this.completed[p] === undefined);

    if (player !== -1) {
      // run for next player without a resolution
      return this.withPlayer(player, () => {
        let result = super.playOneStep();

        // capture the complete state ourselves, pretend everything is fine
        if (!result || result === FlowControl.complete) this.completed![player] = !!result;
        result = FlowControl.ok;
        return result;
      }, true);
    }

    // no more players to step through. return the all-complete
    return this.completed.every(r => r) ? FlowControl.complete : undefined;
  }

  toString(): string {
    return `every-player${this.name ? ":" + this.name : ""}`;
  }

  visualize() {
    return this.visualizeBlocks({
      type: 'everyPlayer',
      blocks: {
        do: this.block instanceof Array ? this.block : [this.block]
      },
      block: 'do',
    });
  }
}
