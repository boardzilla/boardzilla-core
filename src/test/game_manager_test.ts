import chai from 'chai';
import spies from 'chai-spies';

import GameManager, { PlayerAttributes } from '../game-manager.js'

import {
  Player,
  Game,
  Piece,
  Space,
} from '../index.js';

chai.use(spies);
const { expect } = chai;

describe('GameManager', () => {
  const players = [
    { id: 'joe', name: 'Joe', color: 'red', position: 1, tokens: 0, avatar: '', host: true, },
    { id: 'jane', name: 'Jane', color: 'green', position: 2, tokens: 0, avatar: '', host: false, },
    { id: 'jag', name: 'Jag', color: 'yellow', position: 3, tokens: 0, avatar: '', host: false, },
    { id: 'jin', name: 'Jin', color: 'purple', position: 4, tokens: 0, avatar: '', host: false, },
  ];

  class TestPlayer extends Player<TestGame, TestPlayer> {
    tokens: number = 0;
    rival?: TestPlayer;
    general?: General;
  }

  class TestGame extends Game<TestGame, TestPlayer> {
    tokens: number = 0;
  }

  class Card extends Piece<TestGame> {
    suit: string;
    value: number;
    flipped: boolean;
  }

  class Country extends Space<TestGame> {
    general?: General;
  }

  class General extends Piece<TestGame> {
    country?: Country;
  }

  let gameManager: GameManager<TestGame, TestPlayer>;
  let game: TestGame;
  const spendSpy = chai.spy();

  beforeEach(() => {
    gameManager = new GameManager(TestPlayer, TestGame, [ Card, Country, General ]);
    game = gameManager.game;

    const {
      playerActions,
      whileLoop,
      eachPlayer,
    } = game.flowCommands

    game.defineFlow(
      () => {
        game.tokens = 4;
        game.message('Starting game with {{tokens}} tokens', {tokens: game.tokens});
      },
      whileLoop({ while: () => game.tokens < 8, do: (
        playerActions({ actions: ['addSome', 'spend']})
      )}),
      whileLoop({ while: () => game.tokens > 0, do: (
        eachPlayer({ name: 'player', startingPlayer: gameManager.players[0], do: [
          playerActions({ actions: ['takeOne']}),
          () => {
            if (game.tokens <= 0) game.finish(gameManager.players.withHighest('tokens'))
          },
        ]})
      )}),
    );

    game.defineActions({
      addSome: () => game.action({
        prompt: 'add some counters',
      }).chooseNumber('n', {
        prompt: 'how many?',
        min: 1,
        max: 3,
      }).do(
        ({ n }) => { game.tokens += n }
      ).message('{{player}} added {{n}}'),

      takeOne: player => game.action({
        prompt: 'take one counter',
      }).do(() => {
        game.tokens --;
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

    gameManager.players.fromJSON(players);
    gameManager.game.fromJSON([ { className: 'TestGame', tokens: 0 } ]);
    gameManager.players.assignAttributesFromJSON(players);
    gameManager.players.setCurrent([1,2,3,4]),
    gameManager.start();
    gameManager.flow.setBranchFromJSON([ { type: 'main', position: null, sequence: 0 } ]);
  });

  it('plays', () => {
    gameManager.play();
    expect(gameManager.flow.branchJSON()).to.deep.equals([
      { type: 'main', position: null, sequence: 1 },
      { type: "loop", position: { index: 0 } },
      { type: "action", position: {players: undefined} }
    ]);
    const step = gameManager.flow.actionNeeded();
    expect(step?.actions).to.deep.equal([{ name: 'addSome', args: undefined, prompt: undefined }, { name: 'spend', args: undefined, prompt: undefined }]);
  });

  it('messages', () => {
    gameManager.play();
    expect(gameManager.messages).to.deep.equals([
      {
        "body": "Starting game with 4 tokens"
      }
    ]);
    gameManager.processMove({ name: 'addSome', args: {n: 3}, player: gameManager.players[0] });
    gameManager.play();
    expect(gameManager.messages).to.deep.equals([
      {
        "body": "Starting game with 4 tokens"
      },
      {
        "body": "[[$p[1]|Joe]] added 3"
      }
    ]);
  });

  it('messages to players', () => {
    gameManager.actions.addSome = player => game!.action({
      prompt: 'add some counters',
    }).chooseNumber('n', {
      prompt: 'how many?',
      min: 1,
      max: 3,
    }).do(
      ({ n }) => { game.tokens += n }
    ).messageTo(
      player, '{{player}} added {{n}}'
    ).messageTo(
      player.others(), '{{player}} added some'
    );

    gameManager.play();
    expect(gameManager.messages).to.deep.equals([
      {
        "body": "Starting game with 4 tokens"
      }
    ]);
    gameManager.processMove({ name: 'addSome', args: {n: 3}, player: gameManager.players[0] });
    gameManager.play();
    expect(gameManager.messages).to.deep.equals([
      {
        "body": "Starting game with 4 tokens"
      },
      {
        "body": "[[$p[1]|Joe]] added 3",
        "position": 1
      },
      {
        "body": "[[$p[1]|Joe]] added some",
        "position": 2
      },
      {
        "body": "[[$p[1]|Joe]] added some",
        "position": 3
      },
      {
        "body": "[[$p[1]|Joe]] added some",
        "position": 4
      }
    ]);
  });

  it('finishes', () => {
    gameManager.flow.setBranchFromJSON([
      { type: 'main', position: null, sequence: 2 },
      { type: 'loop', position: { index: 0 } },
      { type: 'loop', name: 'player', position: { index: 1, value: '$p[2]' } },
      { type: 'action', position: null }
    ]);
    gameManager.game.fromJSON([ { className: 'TestGame', tokens: 9 } ]);
    gameManager.players.setCurrent(2);
    do {
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players.current()! });
      gameManager.play();
    } while (gameManager.phase === 'started');
    expect(gameManager.winner.length).to.equal(1);
    expect(gameManager.winner[0]).to.equal(gameManager.players[1]);
  });

  describe('state', () => {
    it('is stateless', () => {
      gameManager.play();
      gameManager.processMove({ name: 'addSome', args: {n: 3}, player: gameManager.players[0] });
      gameManager.play();
      const boardState = gameManager.game.allJSON();
      const flowState = gameManager.flow.branchJSON();
      gameManager.game.fromJSON(boardState);
      gameManager.flow.setBranchFromJSON(flowState);
      expect(gameManager.game.allJSON()).to.deep.equals(boardState);
      expect(gameManager.flow.branchJSON()).to.deep.equals(flowState);
      expect(game.tokens).to.equal(7);
    });

    it("does player turns", () => {
      gameManager.game.fromJSON([ { className: 'TestGame', tokens: 9 } ]);
      gameManager.flow.setBranchFromJSON([
        { type: 'main', position: null, sequence: 2 },
        { type: 'loop', position: { index: 0 } },
        { type: 'loop', name: 'player', position: { index: 1, value: '$p[2]' } },
        { type: 'action', position: null }
      ]);
      gameManager.players.setCurrent([2]);
      expect(gameManager.players.currentPosition).to.deep.equal([2]);
      gameManager.play();
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[1] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([3]);
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[2] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([4]);
      expect(gameManager.flow.branchJSON()[1].position.index).to.equal(0)
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[3] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([1]);
      expect(gameManager.flow.branchJSON()[1].position.index).to.equal(1)
    });
  });

  describe('godMode', () => {
    it("does god mode moves", () => {
      gameManager.godMode = true;
      gameManager.phase = 'new';
      const space1 = gameManager.game.create(Space, 'area1');
      const space2 = gameManager.game.create(Space, 'area2');
      const piece = space1.create(Piece, 'piece');
      gameManager.start();
      gameManager.play();
      gameManager.processMove({
        player: gameManager.players[0],
        name: '_godMove',
        args: { piece, into: space2 }
      });
      expect(space2.first(Piece)).to.equal(piece);
    });

    it("does god mode edits", () => {
      gameManager.godMode = true;
      gameManager.phase = 'new';
      const card = gameManager.game.create(Card, 'area1', {suit: "H", value: 1, flipped: false});
      gameManager.start();
      gameManager.processMove({
        player: gameManager.players[0],
        name: '_godEdit',
        args: { element: card, property: 'suit', value: 'S' }
      });
      expect(card.suit).to.equal('S');
    });

    it("restricts god mode moves", () => {
      gameManager.phase = 'new';
      const space1 = gameManager.game.create(Space, 'area1');
      const space2 = gameManager.game.create(Space, 'area2');
      const piece = space1.create(Piece, 'piece');
      gameManager.start();
      expect(() => gameManager.processMove({
        player: gameManager.players[0],
        name: '_godMove',
        args: { piece, into: space2 }
      })).to.throw()
    });
  });

  describe('processAction', () => {
    it('runs actions', async () => {
      gameManager.play();
      gameManager.processMove({ name: 'spend', args: {r: 'gold', n: 2}, player: gameManager.players[0] });
      expect(spendSpy).to.have.been.called.with({r: 'gold', n: 2});
      expect(gameManager.flow.branchJSON()).to.deep.equals([
        { type: 'main', position: null, sequence: 1 },
        { type: 'loop', position: { index: 0 } },
        { type: 'action', position: { name: "spend", args: {r: "gold", n: 2}, player: 1 }}
      ]);
      gameManager.play();
      expect(gameManager.flow.branchJSON()).to.deep.equals([
        { type: 'main', position: null, sequence: 1 },
        { type: 'loop', position: { index: 1 } },
        { type: "action", position: {players: undefined} }
      ]);
    });
    it('changes state', async () => {
      gameManager.play();
      expect(game.tokens).to.equal(4);
      gameManager.processMove({ name: 'addSome', args: {n: 2}, player: gameManager.players[0] });
      expect(gameManager.flow.branchJSON()).to.deep.equals([
        { type: 'main', position: null, sequence: 1 },
        { type: 'loop', position: { index: 0 } },
        { type: 'action', position: { name: "addSome", args: {n: 2}, player: 1 }}
      ]);
      expect(game.tokens).to.equal(6);
    });
  });

  describe('players', () => {
    it('sortedBy', () => {
      expect(gameManager.players.sortedBy('color')[0].color).to.equal('green')
      expect(gameManager.players.sortedBy('color', 'desc')[0].color).to.equal('yellow')
      expect(gameManager.players[0].color).to.equal('red')
    });

    it('sortBy', () => {
      gameManager.players.sortBy('color');
      expect(gameManager.players[0].color).to.equal('green')
    });

    it('withHighest', () => {
      expect(gameManager.players.withHighest('color')).to.equal(gameManager.players[2])
    });

    it('withLowest', () => {
      expect(gameManager.players.withLowest('color')).to.equal(gameManager.players[1])
    });

    it('min', () => {
      expect(gameManager.players.min('color')).to.equal('green')
    });

    it('max', () => {
      expect(gameManager.players.max('color')).to.equal('yellow')
    });

    it('shuffles', () => {
      const player = gameManager.players[0];
      gameManager.setRandomSeed('a');
      gameManager.players.shuffle();
      expect(gameManager.players[0]).to.not.equal(player);
    });

    it('preserves serializable attributes from json', () => {
      gameManager.players[0].rival = gameManager.players[1];

      const json = gameManager.players.map(p => p.toJSON() as PlayerAttributes<TestPlayer>);

      gameManager.players.fromJSON(json);
      gameManager.players.assignAttributesFromJSON(json);
      expect(gameManager.players.map(p => p.toJSON())).to.deep.equals(json);
      expect(gameManager.players[0].rival).to.equal(gameManager.players[1]);
    });

    it('handles serializable references from player to board', () => {
      gameManager.phase = 'new';
      const map = game.create(Space, 'map', {});
      const france = map.create(Country, 'france');
      const england = map.create(Country, 'england');
      const napolean = france.create(General, 'napolean', { country: france });
      gameManager.players[0].general = napolean;
      france.general = napolean;
      gameManager.start();

      const playerJSON = gameManager.players.map(p => p.toJSON() as PlayerAttributes<TestPlayer>);
      const boardJSON = game.allJSON(1);

      napolean.putInto(england);

      gameManager.players.fromJSON(playerJSON);
      game.fromJSON(JSON.parse(JSON.stringify(boardJSON)));
      gameManager.players.assignAttributesFromJSON(playerJSON);

      expect(game.allJSON(1)).to.deep.equals(boardJSON);
      expect(gameManager.players.map(p => p.toJSON())).to.deep.equals(playerJSON);

      expect(gameManager.players[0].general?.name).to.equal('napolean');
      expect(game.first(Country, 'france')).to.equal(france);
      expect(game.first(Country, 'france')!.general?.name).to.equal('napolean');
      expect(game.first(Country, 'france')!.general?.country).to.equal(france);
    });
  });

  describe('action for multiple players', () => {
    beforeEach(() => {
      gameManager = new GameManager(TestPlayer, TestGame, [ Card ]);
      game = gameManager.game;

      game.defineActions({
        takeOne: player => game.action({
          prompt: 'take one counter',
          condition: game.tokens > 0
        }).do(() => {
          game.tokens --;
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

      gameManager.players.fromJSON(players);
      gameManager.players.assignAttributesFromJSON(players);
    });

    it('accepts move from any', () => {
      const { playerActions } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 4 },
        playerActions({
          players: gameManager.players,
          actions: ['takeOne']
        }),
      );
      gameManager.start();
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[3] });
      gameManager.play();
      expect(gameManager.phase).to.equal('finished');
    });

    it('prompt in actionStep', () => {
      const {
        playerActions,
        eachPlayer,
      } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 1 },
        eachPlayer({
          name: 'player',
          do: playerActions({
            players: gameManager.players,
            actions: [{name: 'takeOne', prompt: 'take one!'}]
          })
        }),
      );
      gameManager.start();
      gameManager.play();
      expect(gameManager.getPendingMoves(gameManager.players[0])?.moves[0].selections[0].prompt).to.equal('take one!');
    });

    it('args in actionStep', () => {
      const {
        playerActions,
        eachPlayer,
      } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 1 },
        eachPlayer({
          name: 'player',
          do: playerActions({
            players: gameManager.players,
            actions: [{name: 'declare', args: {d: 'hi'}}]
          })
        }),
      );
      gameManager.start();
      gameManager.play();
      expect(gameManager.getPendingMoves(gameManager.players[0])?.moves[0].args).to.deep.equal({d: 'hi'});
    });

    it('functional args in actionStep', () => {
      const {
        playerActions,
        eachPlayer,
      } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 1 },
        eachPlayer({
          name: 'player',
          do: playerActions({
            players: gameManager.players,
            actions: [{name: 'declare', args: ({ player }) => ({d: player.name}) }]
          })
        }),
      );
      gameManager.start();
      gameManager.play();
      expect(gameManager.getPendingMoves(gameManager.players[0])?.moves[0].args).to.deep.equal({d: 'Joe'});
    });

    it('unskippable initial playerAction', () => {
      const { playerActions } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 1 },
        playerActions({
          player: gameManager.players[0],
          actions: ['declare'],
          skipIf: 'never'
        })
      );
      gameManager.start();
      gameManager.play();
      expect(gameManager.getPendingMoves(gameManager.players[0])?.moves[0].selections[0].type).to.equal('button');
    });

    it('skippable initial playerAction', () => {
      const { playerActions } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 1 },
        playerActions({
          player: gameManager.players[0],
          actions: ['declare'],
        })
      );
      gameManager.start();
      gameManager.play();
      expect(gameManager.getPendingMoves(gameManager.players[0])?.moves[0].selections[0].type).to.equal('text');
    });

    it('optional actions', () => {
      const {
        playerActions,
        eachPlayer,
      } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 1 },
        eachPlayer({
          name: 'player',
          do: playerActions({
            players: gameManager.players,
            optional: 'Pass',
            actions: ['takeOne']
          })
        }),
      );
      gameManager.start();
      gameManager.play();
      expect(gameManager.getPendingMoves(gameManager.players[0])?.moves.length).to.equal(2);
      const move1 = gameManager.processMove({ player: gameManager.players[0], name: '__pass__', args: {} });
      expect(move1).to.be.undefined;
      gameManager.play();

      expect(gameManager.players.currentPosition).to.deep.equal([2])
      const move2 = gameManager.processMove({ player: gameManager.players[1], name: 'takeOne', args: {} });
      expect(move2).to.be.undefined;
      gameManager.play();

      expect(gameManager.players.currentPosition).to.deep.equal([3]);
      expect(gameManager.getPendingMoves(gameManager.players[2])?.moves.length).to.equal(1);
      const move3 = gameManager.processMove({ player: gameManager.players[2], name: 'takeOne', args: {} });
      expect(move3).not.to.be.undefined;
    });

    it('action for every player', () => {
      const {
        playerActions,
        everyPlayer
      } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 4 },
        everyPlayer({
          do: playerActions({
            actions: ['takeOne']
          })
        })
      );

      gameManager.start();
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[2] });
      gameManager.play();
      expect(gameManager.phase).to.equal('started');
      expect(gameManager.players.currentPosition).to.deep.equal([1, 2, 4])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[1] });
      gameManager.play();
      expect(gameManager.phase).to.equal('started');
      expect(gameManager.players.currentPosition).to.deep.equal([1, 4])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[0] });
      gameManager.play();
      expect(gameManager.phase).to.equal('started');
      expect(gameManager.players.currentPosition).to.deep.equal([4])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[3] });
      gameManager.play();
      expect(gameManager.phase).to.equal('finished');
    });

    it('action for every player with followups', () => {
      const {
        playerActions,
        everyPlayer
      } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 4 },
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
      );

      gameManager.start();
      gameManager.play();
      expect(gameManager.getPendingMoves(gameManager.players[0])?.step).to.equal('take-1');
      expect(gameManager.players.currentPosition).to.deep.equal([1, 2, 3, 4])

      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[2] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      expect(gameManager.getPendingMoves(gameManager.players[0])?.step).to.equal('take-1');
      expect(gameManager.getPendingMoves(gameManager.players[2])?.step).to.equal('declare');

      gameManager.processMove({ name: 'declare', args: {d: 'well i never'}, player: gameManager.players[2] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([1, 2, 4])
      expect(gameManager.getPendingMoves(gameManager.players[0])?.step).to.equal('take-1');
      expect(gameManager.getPendingMoves(gameManager.players[2])).to.equal(undefined);

      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[1] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([1, 2, 4])
      expect(gameManager.getPendingMoves(gameManager.players[0])?.step).to.equal('take-1');
      expect(gameManager.getPendingMoves(gameManager.players[1])?.step).to.equal('declare');
      expect(gameManager.getPendingMoves(gameManager.players[2])).to.equal(undefined);

      gameManager.processMove({ name: 'declare', args: {d: 'i do'}, player: gameManager.players[1] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([1, 4])
      expect(gameManager.getPendingMoves(gameManager.players[0])?.step).to.equal('take-1');
      expect(gameManager.getPendingMoves(gameManager.players[1])).to.equal(undefined);
      expect(gameManager.getPendingMoves(gameManager.players[2])).to.equal(undefined);
      expect(gameManager.getPendingMoves(gameManager.players[3])?.step).to.equal('take-1');
    });

    it('survives ser/deser', () => {
      const {
        playerActions,
        everyPlayer
      } = game.flowCommands

      game.defineFlow(
        () => { game.tokens = 4 },
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
      );

      gameManager.start();
      gameManager.play();
      let boardState = gameManager.game.allJSON();
      let flowState = gameManager.flow.branchJSON();

      gameManager.phase = 'new';
      game.defineFlow(
        () => { game.tokens = 4 },
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
      );
      gameManager.start();
      gameManager.game.fromJSON(boardState);
      gameManager.flow.setBranchFromJSON(flowState);

      expect(gameManager.getPendingMoves(gameManager.players[0])?.step).to.equal('take-1');
      expect(gameManager.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[2] });

      boardState = gameManager.game.allJSON();
      flowState = gameManager.flow.branchJSON();
      gameManager.game.fromJSON(boardState);
      gameManager.flow.setBranchFromJSON(flowState);
      gameManager.play();

      expect(gameManager.players.currentPosition).to.deep.equal([1, 2, 3, 4])
      expect(gameManager.getPendingMoves(gameManager.players[0])?.step).to.equal('take-1');
      expect(gameManager.getPendingMoves(gameManager.players[2])?.step).to.equal('declare');
    });
  });

  describe('action followups', () => {
    const actionSpy = chai.spy();
    beforeEach(() => {
      gameManager = new GameManager(TestPlayer, TestGame, [ Card ]);
      game = gameManager.game;
      const {
        loop,
        eachPlayer,
        playerActions
      } = game.flowCommands

      game.defineActions({
        takeOne: player => game.action({
          prompt: 'take one counter',
        }).do(() => {
          game.tokens --;
          player.tokens ++;
          if (game.tokens < 10) game.followUp({
            player: gameManager.players[1],
            name: 'declare',
            prompt: 'follow',
          });
        }),
        declare: () => game.action({
          prompt: 'declare',
        }).enterText('d', {
          prompt: 'declaration'
        }),
      });

      gameManager.players.fromJSON(players);
      gameManager.players.assignAttributesFromJSON(players);

      game.defineFlow(loop(eachPlayer({
        name: 'player',
        do: playerActions({
          actions: [{name: 'takeOne', do: actionSpy}]
        }),
      })));
    });

    it('allows followup do', () => {
      gameManager.game.tokens = 11;
      gameManager.start();
      gameManager.play();

      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[0] });
      gameManager.play();
      expect(actionSpy).to.have.been.called.once
      expect(gameManager.allowedActions(gameManager.players[0]).actions.length).to.equal(0);
      expect(gameManager.allowedActions(gameManager.players[1]).actions.length).to.equal(1);

      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[1] });
      gameManager.play();
      expect(actionSpy).to.have.been.called.once
      expect(gameManager.allowedActions(gameManager.players[1]).actions.length).to.equal(1);
      expect(gameManager.allowedActions(gameManager.players[1]).actions[0].name).to.equal('declare');
      expect(gameManager.allowedActions(gameManager.players[1]).actions[0].player).to.equal(gameManager.players[1]);
      expect(gameManager.allowedActions(gameManager.players[0]).actions.length).to.equal(0);
      expect(gameManager.allowedActions(gameManager.players[1]).actions[0].prompt).to.equal('follow');

      gameManager.processMove({ name: 'declare', args: {d: 'follow'}, player: gameManager.players[1] });
      gameManager.play();
      expect(actionSpy).to.have.been.called.twice
    });

    it('allows followup for other player', () => {
      const {
        loop,
        eachPlayer,
        playerActions
      } = game.flowCommands
      gameManager.game.defineFlow(loop(eachPlayer({
        name: 'player',
        do: [
          playerActions({
            actions: [{name: 'takeOne', do: actionSpy}]
          }),
          playerActions({
            actions: ['declare']
          }),
        ]
      })));

      gameManager.game.tokens = 12;
      gameManager.start();
      gameManager.play();

      expect(gameManager.players.currentPosition).to.deep.equal([1]);
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[0] });
      gameManager.play();
      gameManager.processMove({ name: 'declare', args: {d: 'p1'}, player: gameManager.players[0] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([2]);
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[1] });
      gameManager.play();
      gameManager.processMove({ name: 'declare', args: {d: 'p1'}, player: gameManager.players[1] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([3]);
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[2] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([2]);
      expect(gameManager.allowedActions(gameManager.players[0]).actions.length).to.equal(0);
      expect(gameManager.allowedActions(gameManager.players[1]).actions.length).to.equal(1);
      expect(gameManager.allowedActions(gameManager.players[2]).actions.length).to.equal(0);

      gameManager.processMove({ name: 'declare', args: {d: 'follow'}, player: gameManager.players[1] });
      gameManager.play();
      expect(gameManager.players.currentPosition).to.deep.equal([3]);
    });

    it('multi followup', () => {
      gameManager = new GameManager(TestPlayer, TestGame, [ Card ]);
      game = gameManager.game;
      const {
        loop,
        eachPlayer,
        playerActions
      } = game.flowCommands

      game.defineActions({
        takeOne: player => game.action({
          prompt: 'take one counter',
        }).do(() => {
          game.tokens --;
          player.tokens ++;
          if (game.tokens < 15) game.followUp({ name: 'declare' });
          if (game.tokens < 10) game.followUp({ name: 'takeOne' });
        }),
        declare: () => game.action({
          prompt: 'declare',
        }).enterText('d', {
          prompt: 'declaration'
        }),
      });
      gameManager.players.fromJSON(players);
      gameManager.players.assignAttributesFromJSON(players);

      game.defineFlow(loop(eachPlayer({
        name: 'player',
        do: playerActions({
          actions: ['takeOne']
        }),
      })));

      gameManager.game.tokens = 10;
      gameManager.start();
      gameManager.play();

      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[0] });
      gameManager.play();
      gameManager.processMove({ name: 'declare', args: { d: 'first' }, player: gameManager.players[0] });
      gameManager.play();
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[0] });
      gameManager.play();
    });
  });


  describe('each player', () => {
    beforeEach(() => {
      gameManager = new GameManager(TestPlayer, TestGame, [ Card ]);
      game = gameManager.game;

      game.defineActions({
        takeOne: player => game.action({
          prompt: 'take one counter',
        }).do(() => {
          game.tokens --;
          player.tokens ++;
        }),
      });

      gameManager.players.fromJSON(players.slice(0, 2));
      gameManager.players.assignAttributesFromJSON(players.slice(0, 2));
    });

    it('continuous loop for each player', () => {
      const {
        whileLoop,
        playerActions,
        eachPlayer
      } = game.flowCommands

      game.defineFlow(whileLoop({
        while: () => true,
        do: eachPlayer({
          name: 'player',
          do: playerActions({
            actions: ['takeOne']
          }),
        })
      }));
      gameManager.game.tokens = 20;
      gameManager.start();
      gameManager.play();

      expect(gameManager.players.currentPosition).to.deep.equal([1])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[0] });
      gameManager.play();

      expect(gameManager.players.currentPosition).to.deep.equal([2])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[1] });
      gameManager.play();

      expect(gameManager.players.currentPosition).to.deep.equal([1])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[0] });
      gameManager.play();

      expect(gameManager.players.currentPosition).to.deep.equal([2])
      gameManager.processMove({ name: 'takeOne', args: {}, player: gameManager.players[1] });
      gameManager.play();
    });
  });
});
