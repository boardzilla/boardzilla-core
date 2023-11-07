/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */

import chai from 'chai';
import spies from 'chai-spies';

import Game from '../game/game'

import {
  Player,
  boardClasses
} from '../game';

import {
  playerActions,
  whileLoop,
  eachPlayer,
  everyPlayer
} from '../game/flow';

chai.use(spies);
const { expect } = chai;

describe('Game', () => {
  const players = [
    { name: 'Joe', color: 'red', position: 1, tokens: 0 },
    { name: 'Jane', color: 'green', position: 2, tokens: 0 },
    { name: 'Jag', color: 'yellow', position: 3, tokens: 0 },
    { name: 'Jin', color: 'purple', position: 4, tokens: 0 },
  ];

  class TestPlayer extends Player {
    tokens: number = 0;
  }

  const {
    Board,
    Space,
    Piece,
  } = boardClasses(TestPlayer);

  class TestBoard extends Board {
    tokens: number = 0;
  }

  class Card extends Piece {
    suit: string;
    value: number;
    flipped: boolean;
  }

  let game: Game<TestPlayer, TestBoard>;
  let board: TestBoard;
  const spendSpy = chai.spy();

  beforeEach(() => {
    game = new Game();
    board = game.defineBoard(TestBoard, [ Card ]);
    game.defineFlow(board => [
      () => {
        board.tokens = 4;
        game.message('Starting game with {{1}} tokens', board.tokens);
      },
      whileLoop({ while: () => board.tokens < 8, do: (
        playerActions({ actions: {
          addSome: null,
          spend: null
        }})
      )}),
      whileLoop({ while: () => board.tokens > 0, do: (
        eachPlayer({ name: 'player', startingPlayer: players[0], do: [
          playerActions({ actions: {
            takeOne: null,
          }}),
          () => {
            if (board.tokens <= 0) game.finish(game.players.withHighest('tokens'))
          },
        ]})
      )}),
    ]);

    game.defineActions((board, action, player) => ({
      addSome: action({
        prompt: 'add some counters',
      }).chooseNumber({
        prompt: 'how many?',
        min: 1,
        max: 3,
      }).do(
        n => board.tokens += n
      ).message('{{player}} added {{1}}'),

      takeOne: action({
        prompt: 'take one counter',
      }).do(() => {
        board.tokens --;
        player.tokens ++;
      }),

      spend: action({
        prompt: 'Spend resource',
      }).chooseFrom({
        prompt: 'which resource',
        choices: ['gold', 'silver'],
      }).chooseNumber({
        prompt: 'How much?',
        min: 1,
        max: 3,
      }).do(spendSpy),
    }));

    game.definePlayers(TestPlayer);
    game.players.fromJSON(players);

    game.start();
    game.setState({
      players,
      rseed: '',
      settings: {},
      board: [ { className: 'TestBoard', tokens: 0 } ],
      position: [ { type: 'sequence', position: null, sequence: 0 } ],
      currentPlayerPosition: [1,2,3,4],
    });
  });

  it('plays', () => {
    game.play();
    expect(game.flow.branchJSON()).to.deep.equals([
      { type: 'sequence', position: null, sequence: 1 },
      { type: "loop", position: { index: 0 } },
      { type: "action", position: null }
    ]);
    const step = game.flow.actionNeeded();
    expect(step?.actions).to.deep.equal(['addSome', 'spend']);;
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

  it('finishes', () => {
    game.setState({
      players,
      rseed: '',
      settings: {},
      position: [
        { type: 'sequence', position: null, sequence: 2 },
        { type: 'loop', position: { index: 0 } },
        { type: 'loop', name: 'player', position: { index: 1, value: '$p[2]' } },
        { type: 'action', position: null }
      ],
      board: [ { className: 'TestBoard', tokens: 9 } ],
      currentPlayerPosition: [2]
    });
    do {
      game.processMove({ action: 'takeOne', args: [], player: game.players.current()[0] });
      game.play();
    } while (game.phase === 'started');
    expect(game.winner.length).to.equal(1);
    expect(game.winner[0]).to.equal(game.players[1]);
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
        rseed: '',
        settings: {},
        position: [
          { type: 'sequence', position: null, sequence: 2 },
          { type: 'loop', position: { index: 0 } },
          { type: 'loop', name: 'player', position: { index: 1, value: '$p[2]' } },
          { type: 'action', position: null }
        ],
        board: [ { className: 'TestBoard', tokens: 9 } ],
        currentPlayerPosition: [2]
      });
      expect(game.players.currentPosition).to.deep.equal([2]);
      game.play();
      game.processMove({ action: 'takeOne', args: [], player: game.players[1] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([3]);
      game.processMove({ action: 'takeOne', args: [], player: game.players[2] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([4]);
      expect(game.flow.branchJSON()[1].position.index).to.equal(0)
      game.processMove({ action: 'takeOne', args: [], player: game.players[3] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1]);
      expect(game.flow.branchJSON()[1].position.index).to.equal(1)
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
      game.play();
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
      expect(game.flow.branchJSON()).to.deep.equals([
        { type: 'sequence', position: null, sequence: 1 },
        { type: 'loop', position: { index: 0 } },
        { type: 'action', position: { action: "spend", args: [ "gold", 2 ], player: 1 }}
      ]);
      game.play();
      expect(game.flow.branchJSON()).to.deep.equals([
        { type: 'sequence', position: null, sequence: 1 },
        { type: 'loop', position: { index: 1 } },
        { type: "action", position: null }
      ]);
    });
    it('changes state', async () => {
      game.play();
      expect(board.tokens).to.equal(4);
      game.processMove({ action: 'addSome', args: [2], player: game.players[0] });
      expect(game.flow.branchJSON()).to.deep.equals([
        { type: 'sequence', position: null, sequence: 1 },
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

  describe('action for multiple players', () => {
    beforeEach(() => {
      game = new Game();
      board = game.defineBoard(TestBoard, [ Card ]);

      game.defineActions((board, action, player) => ({
        takeOne: action({
          prompt: 'take one counter',
        }).do(() => {
          board.tokens --;
          player.tokens ++;
        }),
        declare: action({
          prompt: 'declare',
        }).enterText({
          prompt: 'declaration'
        }),
        pass: action({
          prompt: 'pass'
        }),
      }));

      game.definePlayers(TestPlayer);
      game.players.fromJSON(players);
    });

    it('accepts move from any', () => {
      game.defineFlow(board => [
        () => { board.tokens = 4 },
        playerActions({
          players: board.players,
          actions: { takeOne: null }
        }),
      ]);
      game.start();
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      game.processMove({ action: 'takeOne', args: [], player: game.players[3] });
      game.play();
      expect(game.phase).to.equal('finished');
    });

    it('action for every player', () => {
      game.defineFlow(board => [
        () => { board.tokens = 4 },
        everyPlayer({
          do: playerActions({
            actions: { takeOne: null }
          })
        })
      ]);

      game.start();
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      game.processMove({ action: 'takeOne', args: [], player: game.players[2] });
      game.play();
      expect(game.phase).to.equal('started');
      expect(game.players.currentPosition).to.deep.equal([1, 2, 4])
      game.processMove({ action: 'takeOne', args: [], player: game.players[1] });
      game.play();
      expect(game.phase).to.equal('started');
      expect(game.players.currentPosition).to.deep.equal([1, 4])
      game.processMove({ action: 'takeOne', args: [], player: game.players[0] });
      game.play();
      expect(game.phase).to.equal('started');
      expect(game.players.currentPosition).to.deep.equal([4])
      game.processMove({ action: 'takeOne', args: [], player: game.players[3] });
      game.play();
      expect(game.phase).to.equal('finished');
    });

    it('action for every player with followups', () => {
      game.defineFlow(board => [
        () => { board.tokens = 4 },
        everyPlayer({
          do: playerActions({
            name: 'take-1',
            actions: {
              takeOne: playerActions({
                name: 'declare',
                actions: {
                  declare: null
                },
              }),
              pass: null
            }
          })
        })
      ]);

      game.start();
      game.play();
      expect(game.getResolvedSelections(game.players[0])?.step).to.equal('take-1');
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])

      game.processMove({ action: 'takeOne', args: [], player: game.players[2] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      expect(game.getResolvedSelections(game.players[0])?.step).to.equal('take-1');
      expect(game.getResolvedSelections(game.players[2])?.step).to.equal('declare');

      game.processMove({ action: 'declare', args: ['well i never'], player: game.players[2] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 4])
      expect(game.getResolvedSelections(game.players[0])?.step).to.equal('take-1');
      expect(game.getResolvedSelections(game.players[2])).to.equal(undefined);

      game.processMove({ action: 'takeOne', args: [], player: game.players[1] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 4])
      expect(game.getResolvedSelections(game.players[0])?.step).to.equal('take-1');
      expect(game.getResolvedSelections(game.players[1])?.step).to.equal('declare');
      expect(game.getResolvedSelections(game.players[2])).to.equal(undefined);

      game.processMove({ action: 'declare', args: ['i do'], player: game.players[1] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 4])
      expect(game.getResolvedSelections(game.players[0])?.step).to.equal('take-1');
      expect(game.getResolvedSelections(game.players[1])).to.equal(undefined);
      expect(game.getResolvedSelections(game.players[2])).to.equal(undefined);
      expect(game.getResolvedSelections(game.players[3])?.step).to.equal('take-1');
    });

    it('survives ser/deser', () => {
      game.defineFlow(board => [
        () => { board.tokens = 4 },
        everyPlayer({
          do: playerActions({
            name: 'take-1',
            actions: {
              takeOne: playerActions({
                name: 'declare',
                actions: {
                  declare: null
                },
              }),
              pass: null
            }
          })
        })
      ]);

      game.start();

      game.setState(game.getState());
      game.play();

      expect(game.getResolvedSelections(game.players[0])?.step).to.equal('take-1');
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      game.processMove({ action: 'takeOne', args: [], player: game.players[2] });

      game.setState(game.getState());
      game.play();

      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      expect(game.getResolvedSelections(game.players[0])?.step).to.equal('take-1');
      expect(game.getResolvedSelections(game.players[2])?.step).to.equal('declare');
    });
  });
});
