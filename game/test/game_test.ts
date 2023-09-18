/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */

import chai from 'chai';
import spies from 'chai-spies';

import {
  Game,
  Action,
  Board,
  Player
} from '../';

import {
  Sequence,
  PlayerAction,
  Step,
  Loop,
  EachPlayer,
} from '../flow';

chai.use(spies);
const { expect } = chai;
let spendSpy: ReturnType<typeof chai.spy>;

describe('Game', () => {
  const players = [
    { id: '101', name: 'Joe', color: 'red', position: 1 },
    { id: '102', name: 'Jane', color: 'green', position: 2 },
    { id: '103', name: 'Jag', color: 'yellow', position: 3 },
    { id: '104', name: 'Jin', color: 'purple', position: 4 },
  ];

  class TestBoard extends Board {
    tokens: number = 0;
  }

  let game: Game<Player, TestBoard>;
  let board: TestBoard;

  beforeEach(() => {
    spendSpy = chai.spy();
    game = new Game();
    board = game.defineBoard(TestBoard, [  ]);
    game.defineFlow(
      (game, board) => new Sequence({
        steps: [
          new Step({ command: () => board.tokens = 4 }),
          new Loop({ while: () => board.tokens < 8, do: (
            new PlayerAction({ actions: {
              addSome: null,
              spend: null
            }})
          )}),
          new Loop({ while: () => board.tokens > 0, do: (
            new EachPlayer({ do: (
              new PlayerAction({ actions: {
                takeOne: null,
              }})
            )})
          )})
        ]
      })
    );

    game.defineActions((game, board) => ({
      addSome: player => new Action({
        prompt: 'add some counters',
        selections: [{
          prompt: 'how many?',
          selectNumber: {
            min: 1,
            max: 3,
          }
        }],
        move: (n: number) => board.tokens += n
      }),
      takeOne: player => new Action({
        prompt: 'take one counter',
        move: () => board.tokens -= 1,
      }),
      spend: player => new Action({
        prompt: 'Spend resource',
        selections: [{
          prompt: 'which resource',
          selectFromChoices: {
            choices: ['gold', 'silver'],
          }
        }, {
          prompt: 'How much?',
          selectNumber: {
            min: 1,
            max: 3,
          }
        }],
        move: spendSpy,
      }),
    }));
    game.definePlayers(Player);
    game.players.fromJSON(players);

    game.start();
    game.setState({
      players,
      settings: {},
      board: [ { className: 'TestBoard', tokens: 0 } ],
      position: [],
    });
  });

  it('plays', () => {
    const actions = game.play();
    expect(game.flow.branch()).to.deep.equals([
      { type: 'sequence', position: 1 },
      { type: 'loop', position: { index: 0 } }
    ]);
    expect(actions).to.deep.equal(['addSome', 'spend']);;
  });

  describe('state', () => {
    it('is stateless', () => {
      game.play();
      game.processMove({ action: 'addSome', args: [3], player: game.players[0] });
      game.play();
      const state = game.getState();
      game.setState(state);
      expect(game.getState()).to.deep.equals(state);
      expect(board.tokens).to.equal(7);
    });

    it("does player turns", () => {
      game.setState({
        players,
        currentPlayerPosition: 2,
        settings: {},
        position: [
          { type: 'sequence', position: 2 },
          { type: 'loop', position: { index: 0 } },
          { type: 'each-player', position: { index: 1, value: game.players[1] } },
        ],
        board: [ { className: 'TestBoard', tokens: 9 } ],
      });
      debugger;
      expect(game.players.currentPosition).to.equal(2);
      game.play();
      game.processMove({ action: 'takeOne', args: [], player: game.players[1] });
      game.play();
      expect(game.players.currentPosition).to.equal(3);
      game.processMove({ action: 'takeOne', args: [], player: game.players[2] });
      game.play();
      expect(game.players.currentPosition).to.equal(4);
      expect(game.flow.branch()[1].position.index).to.equal(0)
      game.processMove({ action: 'takeOne', args: [], player: game.players[3] });
      game.play();
      expect(game.players.currentPosition).to.equal(1);
      expect(game.flow.branch()[1].position.index).to.equal(1)
    });
  });

  describe('processAction', () => {
    it('runs actions', async () => {
      game.play();
      game.processMove({ action: 'spend', args: ['gold', 2], player: game.players[0] });
      expect(spendSpy).to.have.been.called.with('gold', 2);
      expect(game.flow.branch()).to.deep.equals([
        { type: 'sequence', position: 1 },
        { type: 'loop', position: { index: 0 } },
        { type: 'action', position: { action: "spend", args: [ "gold", 2 ], player: 1 }}
      ]);
      game.play();
      expect(game.flow.branch()).to.deep.equals([
        { type: 'sequence', position: 1 },
        { type: 'loop', position: { index: 1 } },
      ]);
    });
    it('changes state', async () => {
      game.play();
      expect(board.tokens).to.equal(4);
      game.processMove({ action: 'addSome', args: [2], player: game.players[0] });
      expect(game.flow.branch()).to.deep.equals([
        { type: 'sequence', position: 1 },
        { type: 'loop', position: { index: 0 } },
        { type: 'action', position: { action: "addSome", args: [ 2 ], player: 1 }}
      ]);
      expect(board.tokens).to.equal(6);
    });
  });

  describe('players', () => {
    it('sortedBy', () => {
      expect(game.players.sortedBy('color')[0].color).to.equal('green')
      expect(game.players[0].color).to.equal('red')
    });

    it('sortBy', () => {
      game.players.sortBy('color');
      expect(game.players[0].color).to.equal('green')
    });

    it('withHighest', () => {
      expect(game.players.withHighest('color')).to.equal(game.players[1])
    });

    it('withLowest', () => {
      expect(game.players.withLowest('color')).to.equal(game.players[2])
    });

    it('min', () => {
      expect(game.players.min('color')).to.equal('green')
    });

    it('max', () => {
      expect(game.players.max('color')).to.equal('yellow')
    });
  });
});
