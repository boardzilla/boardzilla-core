/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */

import chai from 'chai';
import spies from 'chai-spies';

import {
  Game,
  Action,
  Board,
  Space,
  Piece,
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
    { name: 'Joe', color: 'red', position: 1 },
    { name: 'Jane', color: 'green', position: 2 },
    { name: 'Jag', color: 'yellow', position: 3 },
    { name: 'Jin', color: 'purple', position: 4 },
  ];

  class TestBoard extends Board<Player> {
    tokens: number = 0;
  }

  class Card extends Piece<Player> {
    suit: string;
    value: number;
    flipped: boolean;
  }

  let game: Game<Player, TestBoard>;
  let board: TestBoard;

  beforeEach(() => {
    spendSpy = chai.spy();
    game = new Game();
    board = game.defineBoard(TestBoard, [ Card ]);
    game.defineFlow(
      (game, board) => new Sequence({
        steps: [
          new Step({ command: () => {
            board.tokens = 4;
            game.message('Starting game with $1 tokens', board.tokens);
          }}),
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

    game.defineActions((_, board) => ({
      addSome: player => new Action({
        prompt: 'add some counters',
        selections: [{
          prompt: 'how many?',
          selectNumber: {
            min: 1,
            max: 3,
          }
        }],
        move: (n: number) => board.tokens += n,
        message: '$player added $1'
      }),
      takeOne: () => new Action({
        prompt: 'take one counter',
        move: () => board.tokens -= 1,
      }),
      spend: () => new Action({
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

  it('messages', () => {
    game.play();
    expect(game.messages).to.deep.equals([
      {
        "body": "Starting game with 4 tokens"
      }
    ]);
    game.processMove({ action: 'addSome', args: [3], player: game.players[0] });
    game.play();
    expect(game.messages).to.deep.equals([
      {
        "body": "[[$p[1]|Joe]] added 3"
      }
    ]);
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
          { type: 'each-player', position: { index: 1, value: '$p[2]' } },
        ],
        board: [ { className: 'TestBoard', tokens: 9 } ],
      });
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

  describe('godMode', () => {
    beforeEach(() => { game.phase = 'define'; });
    it("does god mode moves", () => {
      game.godMode = true;
      const space1 = game.board.create(Space, 'area1');
      const space2 = game.board.create(Space, 'area2');
      const piece = space1.create(Piece, 'piece');
      game.start();
      game.processMove({
        player: game.players[0],
        action: '_godMove',
        args: [ piece, space2 ]
      });
      expect(space2.first(Piece)).to.equal(piece);
    });

    it("does god mode edits", () => {
      game.godMode = true;
      const card = game.board.create(Card, 'area1', {suit: "H", value: 1, flipped: false});
      game.start();
      game.processMove({
        player: game.players[0],
        action: '_godEdit',
        args: [ card, 'suit', 'S' ]
      });
      expect(card.suit).to.equal('S');
    });

    it("restricts god mode moves", () => {
      const space1 = game.board.create(Space, 'area1');
      const space2 = game.board.create(Space, 'area2');
      const piece = space1.create(Piece, 'piece');
      game.start();
      expect(() => game.processMove({
        player: game.players[0],
        action: '_godMove',
        args: [ piece, space2 ]
      })).to.throw()
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
      expect(game.players.withHighest('color')).to.equal(game.players[2])
    });

    it('withLowest', () => {
      expect(game.players.withLowest('color')).to.equal(game.players[1])
    });

    it('min', () => {
      expect(game.players.min('color')).to.equal('green')
    });

    it('max', () => {
      expect(game.players.max('color')).to.equal('yellow')
    });
  });
});
