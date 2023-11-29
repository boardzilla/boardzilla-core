import chai from 'chai';
import spies from 'chai-spies';

import Game from '../game.js'

import {
  Player,
  playerActions,
  whileLoop,
  eachPlayer,
  everyPlayer,
  Board,
  createBoardClasses,
  loop
} from '../index.js';

chai.use(spies);
const { expect } = chai;

describe('Game', () => {
  const players = [
    { name: 'Joe', color: 'red', position: 1, tokens: 0, avatar: '', host: true, },
    { name: 'Jane', color: 'green', position: 2, tokens: 0, avatar: '', host: false, },
    { name: 'Jag', color: 'yellow', position: 3, tokens: 0, avatar: '', host: false, },
    { name: 'Jin', color: 'purple', position: 4, tokens: 0, avatar: '', host: false, },
  ];

  class TestPlayer extends Player<TestPlayer, TestBoard> {
    tokens: number = 0;
  }

  class TestBoard extends Board<TestPlayer, TestBoard> {
    tokens: number = 0;
  }

  const { Space, Piece } = createBoardClasses<TestPlayer, TestBoard>();

  class Card extends Piece {
    suit: string;
    value: number;
    flipped: boolean;
  }

  let game: Game<TestPlayer, TestBoard>;
  let board: TestBoard;
  const spendSpy = chai.spy();

  beforeEach(() => {
    game = new Game(TestPlayer, TestBoard, [ Card ]);
    board = game.board;
    game.defineFlow([
      () => {
        board.tokens = 4;
        game.message('Starting game with {{tokens}} tokens', {tokens: board.tokens});
      },
      whileLoop({ while: () => board.tokens < 8, do: (
        playerActions({ actions: ['addSome', 'spend']})
      )}),
      whileLoop({ while: () => board.tokens > 0, do: (
        eachPlayer({ name: 'player', startingPlayer: players[0], do: [
          playerActions({ actions: ['takeOne']}),
          () => {
            if (board.tokens <= 0) game.finish(game.players.withHighest('tokens'))
          },
        ]})
      )}),
    ]);

    game.defineActions({
      addSome: () => game.action({
        prompt: 'add some counters',
      }).chooseNumber('n', {
        prompt: 'how many?',
        min: 1,
        max: 3,
      }).do(
        ({ n }) => { board.tokens += n }
      ).message('{{player}} added {{n}}'),

      takeOne: player => game.action({
        prompt: 'take one counter',
      }).do(() => {
        board.tokens --;
        player.tokens ++;
      }),

      spend: () => game.action({
        prompt: 'Spend resource',
      }).chooseFrom('r', ['gold', 'silver'], {
        prompt: 'which resource',
      }).chooseNumber('n', {
        prompt: 'How much?',
        min: 1,
        max: 3,
      }).do(spendSpy),
    });

    game.players.fromJSON(players);
    game.board.fromJSON([ { className: 'TestBoard', tokens: 0 } ]);
    game.players.setCurrent([1,2,3,4]),
    game.start();
    game.flow.setBranchFromJSON([ { type: 'sequence', position: null, sequence: 0 } ]);
  });

  it('plays', () => {
    game.play();
    expect(game.flow.branchJSON()).to.deep.equals([
      { type: 'sequence', position: null, sequence: 1 },
      { type: "loop", position: { index: 0 } },
      { type: "action", position: {players: undefined} }
    ]);
    const step = game.flow.actionNeeded();
    expect(step?.actions).to.deep.equal([{ name: 'addSome' }, { name: 'spend' }]);
  });

  it('messages', () => {
    game.play();
    expect(game.messages).to.deep.equals([
      {
        "body": "Starting game with 4 tokens"
      }
    ]);
    game.processMove({ name: 'addSome', args: {n: 3}, player: game.players[0] });
    game.play();
    expect(game.messages).to.deep.equals([
      {
        "body": "Starting game with 4 tokens"
      },
      {
        "body": "[[$p[1]|Joe]] added 3"
      }
    ]);
  });

  it('finishes', () => {
    game.flow.setBranchFromJSON([
      { type: 'sequence', position: null, sequence: 2 },
      { type: 'loop', position: { index: 0 } },
      { type: 'loop', name: 'player', position: { index: 1, value: '$p[2]' } },
      { type: 'action', position: null }
    ]);
    game.board.fromJSON([ { className: 'TestBoard', tokens: 9 } ]);
    game.players.setCurrent([2]);
    do {
      game.processMove({ name: 'takeOne', args: {}, player: game.players.current()[0] });
      game.play();
    } while (game.phase === 'started');
    expect(game.winner.length).to.equal(1);
    expect(game.winner[0]).to.equal(game.players[1]);
  });

  describe('state', () => {
    it('is stateless', () => {
      game.play();
      game.processMove({ name: 'addSome', args: {n: 3}, player: game.players[0] });
      game.play();
      const boardState = game.board.allJSON();
      const flowState = game.flow.branchJSON();
      game.board.fromJSON(boardState);
      game.flow.setBranchFromJSON(flowState);
      expect(game.board.allJSON()).to.deep.equals(boardState);
      expect(game.flow.branchJSON()).to.deep.equals(flowState);
      expect(board.tokens).to.equal(7);
    });

    it("does player turns", () => {
      game.board.fromJSON([ { className: 'TestBoard', tokens: 9 } ]);
      game.flow.setBranchFromJSON([
        { type: 'sequence', position: null, sequence: 2 },
        { type: 'loop', position: { index: 0 } },
        { type: 'loop', name: 'player', position: { index: 1, value: '$p[2]' } },
        { type: 'action', position: null }
      ]);
      game.players.setCurrent([2]);
      expect(game.players.currentPosition).to.deep.equal([2]);
      game.play();
      game.processMove({ name: 'takeOne', args: {}, player: game.players[1] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([3]);
      game.processMove({ name: 'takeOne', args: {}, player: game.players[2] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([4]);
      expect(game.flow.branchJSON()[1].position.index).to.equal(0)
      game.processMove({ name: 'takeOne', args: {}, player: game.players[3] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1]);
      expect(game.flow.branchJSON()[1].position.index).to.equal(1)
    });
  });

  describe('godMode', () => {
    it("does god mode moves", () => {
      game.godMode = true;
      game.phase = 'new';
      const space1 = game.board.create(Space, 'area1');
      const space2 = game.board.create(Space, 'area2');
      const piece = space1.create(Piece, 'piece');
      game.start();
      game.play();
      game.processMove({
        player: game.players[0],
        name: '_godMove',
        args: { piece, into: space2 }
      });
      expect(space2.first(Piece)).to.equal(piece);
    });

    it("does god mode edits", () => {
      game.godMode = true;
      game.phase = 'new';
      const card = game.board.create(Card, 'area1', {suit: "H", value: 1, flipped: false});
      game.start();
      game.processMove({
        player: game.players[0],
        name: '_godEdit',
        args: { element: card, property: 'suit', value: 'S' }
      });
      expect(card.suit).to.equal('S');
    });

    it("restricts god mode moves", () => {
      game.phase = 'new';
      const space1 = game.board.create(Space, 'area1');
      const space2 = game.board.create(Space, 'area2');
      const piece = space1.create(Piece, 'piece');
      game.start();
      expect(() => game.processMove({
        player: game.players[0],
        name: '_godMove',
        args: { piece, into: space2 }
      })).to.throw()
    });
  });

  describe('processAction', () => {
    it('runs actions', async () => {
      game.play();
      game.processMove({ name: 'spend', args: {r: 'gold', n: 2}, player: game.players[0] });
      expect(spendSpy).to.have.been.called.with({r: 'gold', n: 2});
      expect(game.flow.branchJSON()).to.deep.equals([
        { type: 'sequence', position: null, sequence: 1 },
        { type: 'loop', position: { index: 0 } },
        { type: 'action', position: { name: "spend", args: {r: "gold", n: 2}, player: 1 }}
      ]);
      game.play();
      expect(game.flow.branchJSON()).to.deep.equals([
        { type: 'sequence', position: null, sequence: 1 },
        { type: 'loop', position: { index: 1 } },
        { type: "action", position: {players: undefined} }
      ]);
    });
    it('changes state', async () => {
      game.play();
      expect(board.tokens).to.equal(4);
      game.processMove({ name: 'addSome', args: {n: 2}, player: game.players[0] });
      expect(game.flow.branchJSON()).to.deep.equals([
        { type: 'sequence', position: null, sequence: 1 },
        { type: 'loop', position: { index: 0 } },
        { type: 'action', position: { name: "addSome", args: {n: 2}, player: 1 }}
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
      game = new Game(TestPlayer, TestBoard, [ Card ]);
      board = game.board;

      game.defineActions({
        takeOne: player => game.action({
          prompt: 'take one counter',
        }).do(() => {
          board.tokens --;
          player.tokens ++;
        }),
        declare: () => game.action({
          prompt: 'declare',
        }).enterText('d', {
          prompt: 'declaration'
        }),
        pass: () => game.action({
          prompt: 'pass'
        }),
      });

      game.players.fromJSON(players);
    });

    it('accepts move from any', () => {
      game.defineFlow([
        () => { board.tokens = 4 },
        playerActions({
          players: board.players,
          actions: ['takeOne']
        }),
      ]);
      game.start();
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[3] });
      game.play();
      expect(game.phase).to.equal('finished');
    });

    it('action for every player', () => {
      game.defineFlow([
        () => { board.tokens = 4 },
        everyPlayer({
          do: playerActions({
            actions: ['takeOne']
          })
        })
      ]);

      game.start();
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[2] });
      game.play();
      expect(game.phase).to.equal('started');
      expect(game.players.currentPosition).to.deep.equal([1, 2, 4])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[1] });
      game.play();
      expect(game.phase).to.equal('started');
      expect(game.players.currentPosition).to.deep.equal([1, 4])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[0] });
      game.play();
      expect(game.phase).to.equal('started');
      expect(game.players.currentPosition).to.deep.equal([4])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[3] });
      game.play();
      expect(game.phase).to.equal('finished');
    });

    it('action for every player with followups', () => {
      game.defineFlow([
        () => { board.tokens = 4 },
        everyPlayer({
          do: playerActions({
            name: 'take-1',
            actions: [
              {
                name: 'takeOne',
                do: playerActions({
                  name: 'declare',
                  actions: ['declare']
                }),
              },
              'pass'
            ]
          })
        })
      ]);

      game.start();
      game.play();
      expect(game.getPendingMoves(game.players[0])?.step).to.equal('take-1');
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])

      game.processMove({ name: 'takeOne', args: {}, player: game.players[2] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      expect(game.getPendingMoves(game.players[0])?.step).to.equal('take-1');
      expect(game.getPendingMoves(game.players[2])?.step).to.equal('declare');

      game.processMove({ name: 'declare', args: {d: 'well i never'}, player: game.players[2] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 4])
      expect(game.getPendingMoves(game.players[0])?.step).to.equal('take-1');
      expect(game.getPendingMoves(game.players[2])).to.equal(undefined);

      game.processMove({ name: 'takeOne', args: {}, player: game.players[1] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 2, 4])
      expect(game.getPendingMoves(game.players[0])?.step).to.equal('take-1');
      expect(game.getPendingMoves(game.players[1])?.step).to.equal('declare');
      expect(game.getPendingMoves(game.players[2])).to.equal(undefined);

      game.processMove({ name: 'declare', args: {d: 'i do'}, player: game.players[1] });
      game.play();
      expect(game.players.currentPosition).to.deep.equal([1, 4])
      expect(game.getPendingMoves(game.players[0])?.step).to.equal('take-1');
      expect(game.getPendingMoves(game.players[1])).to.equal(undefined);
      expect(game.getPendingMoves(game.players[2])).to.equal(undefined);
      expect(game.getPendingMoves(game.players[3])?.step).to.equal('take-1');
    });

    it('survives ser/deser', () => {
      game.defineFlow([
        () => { board.tokens = 4 },
        everyPlayer({
          do: playerActions({
            name: 'take-1',
            actions: [
              {
                name: 'takeOne',
                do: playerActions({
                  name: 'declare',
                  actions: ['declare']
                })
              },
              'pass'
            ]
          })
        })
      ]);

      game.start();
      let boardState = game.board.allJSON();
      let flowState = game.flow.branchJSON();
      game.board.fromJSON(boardState);
      game.flow.setBranchFromJSON(flowState);
      game.play();

      expect(game.getPendingMoves(game.players[0])?.step).to.equal('take-1');
      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[2] });

      boardState = game.board.allJSON();
      flowState = game.flow.branchJSON();
      game.board.fromJSON(boardState);
      game.flow.setBranchFromJSON(flowState);
      game.play();

      expect(game.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      expect(game.getPendingMoves(game.players[0])?.step).to.equal('take-1');
      expect(game.getPendingMoves(game.players[2])?.step).to.equal('declare');
    });
  });

  describe('action followups', () => {
    beforeEach(() => {
      game = new Game(TestPlayer, TestBoard, [ Card ]);
      board = game.board;

      game.defineActions({
        takeOne: player => game.action({
          prompt: 'take one counter',
        }).do(() => {
          board.tokens --;
          player.tokens ++;
          if (board.tokens < 10) return {
            name: 'declare'
          }
        }),
        declare: () => game.action({
          prompt: 'declare',
        }).enterText('d', {
          prompt: 'declaration'
        }),
      });

      game.players.fromJSON(players);

      game.defineFlow(loop(eachPlayer({
        name: 'player',
        do: playerActions({
          actions: ['takeOne']
        }),
      })));
    });

    it('allows followup', () => {
      game.board.tokens = 11;
      game.start();
      game.play();

      game.processMove({ name: 'takeOne', args: {}, player: game.players[0] });
      game.play();
      expect(game.allowedActions(game.players[0]).actions.length).to.equal(0);
      expect(game.allowedActions(game.players[1]).actions.length).to.equal(1);

      game.processMove({ name: 'takeOne', args: {}, player: game.players[1] });
      game.play();
      expect(game.allowedActions(game.players[1]).actions.length).to.equal(1);
      expect(game.allowedActions(game.players[1]).actions[0].name).to.equal('declare');
      expect(game.allowedActions(game.players[1]).actions[0].player).to.equal(game.players[1]);
      expect(game.allowedActions(game.players[0]).actions.length).to.equal(0);
    });
  });


  describe('each player', () => {
    beforeEach(() => {
      game = new Game(TestPlayer, TestBoard, [ Card ]);
      board = game.board;

      game.defineActions({
        takeOne: player => game.action({
          prompt: 'take one counter',
        }).do(() => {
          board.tokens --;
          player.tokens ++;
        }),
      });

      game.players.fromJSON(players.slice(0, 2));
    });

    it('continuous loop for each player', () => {
      game.defineFlow(whileLoop({
        while: () => true,
        do: eachPlayer({
          name: 'player',
          do: playerActions({
            actions: ['takeOne']
          }),
        })
      }));
      game.board.tokens = 20;
      game.start();
      game.play();

      expect(game.players.currentPosition).to.deep.equal([1])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[0] });
      game.play();

      expect(game.players.currentPosition).to.deep.equal([2])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[1] });
      game.play();

      expect(game.players.currentPosition).to.deep.equal([1])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[0] });
      game.play();

      expect(game.players.currentPosition).to.deep.equal([2])
      game.processMove({ name: 'takeOne', args: {}, player: game.players[1] });
      game.play();
    });
  });
});
