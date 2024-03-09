import chai from 'chai';
import spies from 'chai-spies';
import random from 'random-seed';

import {
  Game,
  Space,
  Piece,
  GameElement,
} from '../board/index.js';

import {
  Player,
  PlayerCollection,
} from '../player/index.js';

chai.use(spies);
const { expect } = chai;

describe('Game', () => {
  let game: Game;

  const players = new PlayerCollection;
  players.className = Player;
  players.addPlayer({
    id: 'joe',
    name: 'Joe',
    position: 1,
    color: 'red',
    avatar: '',
    host: true
  });
  players.addPlayer({
    id: 'jane',
    name: 'Jane',
    position: 2,
    color: 'green',
    avatar: '',
    host: false
  });

  beforeEach(() => {
    game = new Game({
      // @ts-ignore
      gameManager: { players, addDelay: () => {}, random: random.create('a').random },
      classRegistry: [Space, Piece, GameElement]
    });
    game._ctx.gameManager.game = game;
  });

  it('renders', () => {
    expect(game.allJSON()).to.deep.equals(
      [
        { className: 'Game', _id: 0 },
      ]
    );
  });

  it('creates new spaces', () => {
    game.create(Space, 'map', {});
    expect(game.allJSON()).to.deep.equals(
      [
        { className: 'Game', _id: 0, children: [
          { className: 'Space', name: 'map', _id: 2 }
        ]},
      ]
    );
  });

  it('creates new pieces', () => {
    game.create(Piece, 'token', { player: players[0] });
    expect(game.allJSON()).to.deep.equals(
      [
        { className: 'Game', _id: 0, children: [
          { className: 'Piece', name: 'token', _id: 2, player: '$p[1]' }
        ]},
      ]
    );
  });

  it('destroys pieces', () => {
    game.create(Piece, 'token', { player: players[1] });
    game.create(Piece, 'token', { player: players[0] });
    game.first(Piece)!.destroy();
    expect(game.allJSON()).to.deep.equals(
      [
        { className: 'Game', _id: 0, children: [
          { className: 'Piece', name: 'token', _id: 3, player: '$p[1]' }
        ]},
      ]
    );
  });

  it('removes pieces', () => {
    game.create(Piece, 'token', { player: players[1] });
    game.create(Piece, 'token', { player: players[0] });
    game.first(Piece)!.remove();
    expect(game.allJSON()).to.deep.equals(
      [
        { className: 'Game', _id: 0, children: [
          { className: 'Piece', name: 'token', _id: 3, player: '$p[1]' }
        ]},
        { className: 'Piece', name: 'token', _id: 2, player: '$p[2]' }
      ]
    );
  });

  it('removes all', () => {
    game.create(Piece, 'token', { player: players[1] });
    game.create(Piece, 'token', { player: players[0] });
    game.all(Piece).remove();
    expect(game.allJSON()).to.deep.equals(
      [
        { className: 'Game', _id: 0},
        { className: 'Piece', name: 'token', _id: 2, player: '$p[2]' },
        { className: 'Piece', name: 'token', _id: 3, player: '$p[1]' }
      ]
    );
  });

  it('builds from json', () => {
    const map = game.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const piece3 = map.create(Piece, 'token3');
    const england = map.create(Space, 'england', {});
    const play = game.create(Space, 'play', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = france.create(Piece, 'token2', { player: players[1] });
    const json = game.allJSON();
    game.fromJSON(JSON.parse(JSON.stringify(game.allJSON())));
    expect(game.allJSON()).to.deep.equals(json);
    expect(game.first(Piece, 'token1')!._t.id).to.equal(piece1._t.id);
    expect(game.first(Piece, 'token1')!.player).to.equal(players[0]);
    expect(game.first(Piece, 'token2')!._t.id).to.equal(piece2._t.id);
    expect(game.first(Piece, 'token2')!.player).to.equal(players[1]);
    expect(game.first(Space, 'france')).to.equal(france);
  });

  it('preserves serializable attributes from json', () => {
    class Country extends Space<Game> {
      rival: Country;
      general: Piece<Game>;
    }
    game._ctx.classRegistry = [Space, Piece, GameElement, Country];

    const map = game.create(Space, 'map', {});
    const napolean = map.create(Piece, 'napolean')
    const england = map.create(Country, 'england', {});
    const france = map.create(Country, 'france', { rival: england, general: napolean });
    const json = game.allJSON();
    game.fromJSON(JSON.parse(JSON.stringify(json)));
    expect(game.allJSON()).to.deep.equals(json);
    expect(game.first(Country, 'france')).to.equal(france);
    expect(game.first(Country, 'france')!.rival).to.equal(england);
    expect(game.first(Country, 'france')!.general).to.equal(napolean);
  });

  it('handles cyclical serializable attributes', () => {
    class Country extends Space<Game> {
      general?: General;
    }
    class General extends Piece<Game> {
      country?: Country;
    }
    game._ctx.classRegistry = [Space, Piece, GameElement, Country, General];

    const map = game.create(Space, 'map', {});
    const france = map.create(Country, 'france');
    const napolean = france.create(General, 'napolean', { country: france });
    france.general = napolean;
    const json = game.allJSON(1);
    game.fromJSON(JSON.parse(JSON.stringify(json)));
    expect(game.allJSON(1)).to.deep.equals(json);
    expect(game.first(Country, 'france')).to.equal(france);
    expect(game.first(Country, 'france')!.general?.name).to.equal('napolean');
    expect(game.first(Country, 'france')!.general?.country).to.equal(france);
  });

  it('understands branches', () => {
    const map = game.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const england = map.create(Space, 'england', {});
    const play = game.create(Space, 'play', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = france.create(Piece, 'token2', { player: players[1] });
    const piece3 = play.create(Piece, 'token3');
    expect(piece1.branch()).to.equal('0/0/0/0');
    expect(piece2.branch()).to.equal('0/0/0/1');
    expect(piece3.branch()).to.equal('0/1/0');
    expect(game.atBranch('0/0/0/0')).to.equal(piece1);
    expect(game.atBranch('0/0/0/1')).to.equal(piece2);
    expect(game.atBranch('0/1/0')).to.equal(piece3);
  });

  it('assigns and finds IDs', () => {
    const map = game.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const england = map.create(Space, 'england', {});
    const play = game.create(Space, 'play', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = france.create(Piece, 'token2', { player: players[1] });
    const piece3 = play.create(Piece, 'token3');
    expect(piece1._t.id).to.equal(6);
    expect(piece2._t.id).to.equal(7);
    expect(piece3._t.id).to.equal(8);
    expect(game.atID(6)).to.equal(piece1);
    expect(game.atID(7)).to.equal(piece2);
    expect(game.atID(8)).to.equal(piece3);
  });

  it('clones', () => {
    const map = game.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const england = map.create(Space, 'england', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = piece1.cloneInto(england);
    expect(piece1.player).to.equal(piece2.player);
    expect(piece1.name).to.equal(piece2.name);
    expect(england._t.children).to.include(piece2);
  });

  describe("Element subclasses", () => {
    class Card extends Piece<Game> {
      suit: string;
      pip: number = 1;
      flipped?: boolean = false;
      state?: string = 'initial';
    }

    beforeEach(() => {
      game._ctx.classRegistry.push(Card);
    });

    it('takes attrs', () => {
      game.create(Card, '2H', { suit: 'H', pip: 2 });
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 2 }
          ]},
        ]
      );
    });

    it('takes base attrs', () => {
      game.create(Card, '2H', { player: players[1], suit: 'H', pip: 2 });
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: '2H', player: '$p[2]', suit: 'H', pip: 2, _id: 2 }
          ]},
        ]
      );
    });

    it('searches', () => {
      game.create(Card, 'AH', { suit: 'H', pip: 1 });
      game.create(Card, '2H', { suit: 'H', pip: 2 });
      game.create(Card, '3H', { suit: 'H', pip: 3 });
      const card = game.first(Card, {pip: 2});
      expect(card!.name).equals('2H');
      const card2 = game.first(Card, {pip: 4});
      expect(card2).equals(undefined);
      const card3 = game.first(Card, {pip: 2, suit: 'D'});
      expect(card3).equals(undefined);
      const cards = game.all(Card, c => c.pip >= 2);
      expect(cards.length).equals(2);
      expect(cards[0].name).equals('2H');
      expect(cards[1].name).equals('3H');
      const card4 = game.first("2H");
      expect(card4!.name).equals('2H');
    });

    it('searches undefined', () => {
      game.create(Card, 'AH', { suit: 'H', pip: 1, player: players[0] });
      game.create(Card, '2H', { suit: 'H', pip: 2, player: players[1] });
      const h3 = game.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(game.first(Card, {player: undefined})).to.equal(h3);
    }),

    it('has', () => {
      game.create(Card, 'AH', { suit: 'H', pip: 1, player: players[0] });
      game.create(Card, '2H', { suit: 'H', pip: 2, player: players[1] });
      expect(game.has(Card, {pip: 2})).to.equal(true);
      expect(game.has(Card, {pip: 2, suit: 'C'})).to.equal(false);
    }),

    it('modifies', () => {
      game.create(Card, 'AH', { suit: 'H', pip: 1 });
      game.create(Card, '2H', { suit: 'H', pip: 2 });
      game.create(Card, '3H', { suit: 'H', pip: 3 });
      const card = game.first(Card, {pip: 2})!;
      card.suit = 'D';
      expect(card.suit).equals('D');
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 2 },
            { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'D', pip: 2, _id: 3 },
            { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 4 }
          ]},
        ]
      );
    });

    it('takes from pile', () => {
      game.create(Card, 'AH', { suit: 'H', pip: 1 });
      game.create(Card, '2H', { suit: 'H', pip: 2 });
      const pile = game._ctx.removed;
      const h3 = pile.create(Card, '3H', { suit: 'H', pip: 3 });

      expect(h3.branch()).to.equal('1/0');
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 2 },
            { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 3 },
          ]},
          { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 4 }
        ]
      );

      expect(game.all(Card).length).to.equal(2);
      expect(pile.all(Card).length).to.equal(1);
    });

    it('moves', () => {
      const deck = game.create(Space, 'deck');
      const discard = game.create(Space, 'discard');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]},
            { className: 'Space', name: 'discard', _id: 3}
          ]},
        ]
      );

      deck.lastN(2, Card).putInto(discard);
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 }
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]}
          ]},
        ]
      );
    });

    it('moves with stacking order', () => {
      const deck = game.create(Space, 'deck');
      const discard = game.create(Space, 'discard');
      deck.setOrder('stacking');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, order: 'stacking', children: [
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 }
            ]},
            { className: 'Space', name: 'discard', _id: 3}
          ]},
        ]
      );

      deck.lastN(2, Card).putInto(discard);
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, order: 'stacking', children: [
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 }
            ]}
          ]},
        ]
      );

      discard.all(Card).putInto(deck);
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, order: 'stacking', children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]},
            { className: 'Space', name: 'discard', _id: 3}
          ]},
        ]
      );
    });

    it('moves fromTop', () => {
      const deck = game.create(Space, 'deck');
      const discard = game.create(Space, 'discard');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]},
            { className: 'Space', name: 'discard', _id: 3}
          ]},
        ]
      );

      deck.lastN(2, Card).putInto(discard, {fromTop: 0});
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 }
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 },
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 }
            ]}
          ]},
        ]
      );
    });

    it('tracks movement', () => {
      const deck = game.create(Space, 'deck');
      const discard = game.create(Space, 'discard');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      const json = game.allJSON();
      game._ctx.trackMovement = true;
      game.fromJSON(json);

      deck.lastN(2, Card).putInto(discard);
      expect(game.allJSON()).to.deep.equals(
        [
          { className: 'Game', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4, was: '0/0/0' }
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5, was: '0/0/1' },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6, was: '0/0/2' }
            ]}
          ]},
        ]
      );
    });

    it("understands players", () => {
      const players1Mat = game.create(Space, 'mat', {player: players[0]});
      game.create(Space, 'mat', {player: players[1]});

      players1Mat.create(Card, 'player-1-card', { suit: 'H', pip: 1, player: players[0] });
      players1Mat.create(Card, 'player-2-card', { suit: 'H', pip: 1, player: players[1] });
      players1Mat.create(Card, 'neutral-card', { suit: 'H', pip: 2 });
      players[0].game = game;
      players[1].game = game;

      expect(() => game.all(Card, { mine: true })).to.throw;

      game._ctx.player = players[0];
      expect(game.all(Card, { mine: true }).length).to.equal(2);
      expect(game.all(Card, { mine: false }).length).to.equal(1);
      expect(game.all(Card, { owner: players[0] }).length).to.equal(2);
      expect(game.last(Card, { mine: true })!.name).to.equal('neutral-card');
      expect(game.first('neutral-card')!.owner).to.equal(players[0]);

      game._ctx.player = players[1];
      expect(game.all(Card, { mine: true }).length).to.equal(1);
      expect(game.all(Card, { owner: players[1] }).length).to.equal(1);
      expect(game.all(Card, { mine: false }).length).to.equal(2);

      expect(players[0].allMy(Card).length).to.equal(2);
      expect(players[1].allMy(Card).length).to.equal(1);
      expect(players[0].has(Card, {pip: 1})).to.equal(true);
      expect(players[0].has(Card, 'player-2-card')).to.equal(false);
      expect(players[0].has(Card, {pip: 2})).to.equal(true);
      expect(players[1].has(Card, {pip: 1})).to.equal(true);
      expect(players[1].has(Card, {pip: 2})).to.equal(false);
    });

    it("sorts", () => {
      const deck = game.create(Space, 'deck');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2C', { suit: 'C', pip: 2 });
      deck.create(Card, '3D', { suit: 'D', pip: 3 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });

      expect(game.all(Card).withHighest('pip')!.name).to.equal('3D');
      expect(game.all(Card).withHighest('suit')!.name).to.equal('AH');
      expect(game.all(Card).withHighest('suit', 'pip')!.name).to.equal('2H');
      expect(game.all(Card).withHighest(c => c.suit === 'D' ? 100 : 1)!.name).to.equal('3D');
      expect(game.all(Card).min('pip')).to.equal(1);
      expect(game.all(Card).max('pip')).to.equal(3);
      expect(game.all(Card).min('suit')).to.equal('C');
      expect(game.all(Card).max('suit')).to.equal('H');
    });

    it("shuffles", () => {
      const deck = game.create(Space, 'deck');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2C', { suit: 'C', pip: 2 });
      deck.create(Card, '3D', { suit: 'D', pip: 3 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.shuffle();
      expect(deck.first(Card)!.name).to.not.equal('AH');
    });

    it("isVisibleTo", () => {
      const card = game.create(Card, 'AH', { suit: 'H', pip: 1 });
      expect(card.isVisible()).to.equal(true);
      card.hideFromAll();
      expect(card.isVisible()).to.equal(false);
      expect(card.isVisibleTo(1)).to.equal(false);
      expect(card.isVisibleTo(2)).to.equal(false);
      card.showTo(1);
      expect(card.isVisibleTo(1)).to.equal(true);
      expect(card.isVisibleTo(2)).to.equal(false);
      card.hideFrom(1);
      expect(card.isVisibleTo(1)).to.equal(false);
      expect(card.isVisibleTo(2)).to.equal(false);
      card.showToAll();
      expect(card.isVisibleTo(1)).to.equal(true);
      expect(card.isVisibleTo(2)).to.equal(true);
      card.hideFrom(1);
      expect(card.isVisibleTo(1)).to.equal(false);
      expect(card.isVisibleTo(2)).to.equal(true);
      card.showTo(1);
      expect(card.isVisibleTo(1)).to.equal(true);
      expect(card.isVisibleTo(2)).to.equal(true);
    });

    it("hides", () => {
      Card.revealWhenHidden('pip', 'flipped', 'state');
      const card = game.create(Card, 'AH', { suit: 'H', pip: 1 });
      card.showOnlyTo(1);
      expect(card.toJSON(1)).to.deep.equal(
        { className: 'Card', _id: 2, flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _visible: { default: false, except: [1] } },
      );
      expect(card.toJSON(2)).to.deep.equal(
        { className: 'Card', flipped: false, state: 'initial', pip: 1, _visible: { default: false, except: [1] } },
      )
      game.fromJSON(JSON.parse(JSON.stringify(game.allJSON(2))));
      const card3 = game.first(Card)!;
      expect(card3.pip).to.equal(1);
      expect(card3.suit).to.equal(undefined);
    });

    it("hides spaces", () => {
      const hand = game.create(Space, 'hand', { player: players[0] });
      hand.create(Card, 'AH', { suit: 'H', pip: 1 });
      hand.showOnlyTo(1);

      expect(hand.toJSON(1)).to.deep.equal(
        { className: 'Space', name: "hand", player: "$p[1]", _id: 2, _visible: { default: false, except: [1] }, children: [
          {className: 'Card', _id: 3, flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1},
        ]}
      );

      expect(hand.toJSON(2)).to.deep.equal(
        { className: 'Space', _id: 2, _visible: { default: false, except: [1] } }
      );
    });

    it("listens to add events", () => {
      const eventSpy = chai.spy();
      game.onEnter(Card, eventSpy);
      const card = game.create(Card, "AH", {suit: "H", pip: 1});
      expect(eventSpy).to.have.been.called.with(card)
    });

    it("listens to add events from moves", () => {
      const eventSpy = chai.spy();
      const deck = game.create(Space, 'deck');
      game.create(Space, 'discard');
      deck.onEnter(Card, eventSpy);
      const card = game.create(Card, "AH", {suit: "H", pip: 1});
      card.putInto(deck);
      expect(eventSpy).to.have.been.called.with(card)
    });

    it("listens to exit events from moves", () => {
      const eventSpy = chai.spy();
      const deck = game.create(Space, 'deck');
      game.create(Space, 'discard');
      deck.onExit(Card, eventSpy);
      const card = game.create(Card, "AH", {suit: "H", pip: 1});
      card.putInto(deck);
      expect(eventSpy).not.to.have.been.called()
      card.remove();
      expect(eventSpy).to.have.been.called.with(card)
    });

    it("preserves events in JSON", () => {
      const eventSpy = chai.spy();
      game.onEnter(Card, eventSpy);
      game.fromJSON(JSON.parse(JSON.stringify(game.allJSON())));
      game.create(Card, "AH", {suit: "H", pip: 1});
      expect(eventSpy).to.have.been.called()
    });
  });

  describe("graph", () => {
    it("adjacency", () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      a.connectTo(b);
      expect(a.isAdjacentTo(b)).to.equal(true);
      expect(a.isAdjacentTo(c)).to.equal(false);
      expect(a.others({ adjacent: true }).includes(b)).to.equal(true);
      expect(a.others({ adjacent: true }).includes(c)).to.not.equal(true);
    })

    it("calculates distance", () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      expect(a.distanceTo(c)).to.equal(5);
    })

    it("calculates closest", () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      expect(a.closest()).to.equal(b);
    })

    it("finds adjacencies", () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      c.connectTo(d, 1);
      expect(a.adjacencies()).to.deep.equal([b, c]);
      expect(a.others({ adjacent: true })).to.deep.equal([b, c]);
      expect(c.adjacencies()).to.deep.equal([a, b, d]);
      expect(c.others({ adjacent: true })).to.deep.equal([a, b, d]);
    })

    it("searches by distance", () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      c.connectTo(d, 1);
      expect(a.withinDistance(5).all(Space)).to.deep.equal([b,c]);
      expect(a.others({ withinDistance: 5}).length).to.equal(2);
    })
  });

  describe('grids', () => {
    class Cell extends Space<Game> { color: string }

    it('creates squares', () => {
      game = new Game({ classRegistry: [Space, Piece, GameElement, Cell] });
      game.createGrid({ rows: 3, columns: 3 }, Cell, 'cell');
      expect(game.all(Cell).length).to.equal(9);
      expect(game.first(Cell)!.row).to.equal(1);
      expect(game.first(Cell)!.column).to.equal(1);
      expect(game.last(Cell)!.row).to.equal(3);
      expect(game.last(Cell)!.column).to.equal(3);

      const corner = game.first(Cell, {row: 1, column: 1})!;
      expect(corner.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1]]);

      const middle = game.first(Cell, {row: 2, column: 2})!;
      expect(middle.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1], [2,3], [3,2]]);
    });

    it('creates squares with diagonals', () => {
      game = new Game({ classRegistry: [Space, Piece, GameElement, Cell] });
      game.createGrid({ rows: 3, columns: 3, diagonalDistance: 1.5 }, Cell, 'cell');
      expect(game.all(Cell).length).to.equal(9);
      expect(game.first(Cell)!.row).to.equal(1);
      expect(game.first(Cell)!.column).to.equal(1);
      expect(game.last(Cell)!.row).to.equal(3);
      expect(game.last(Cell)!.column).to.equal(3);

      const corner = game.first(Cell, {row: 1, column: 1})!;
      expect(corner.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1], [2,2]]);

      const knight = game.first(Cell, {row: 3, column: 2})!;
      expect(corner.distanceTo(knight)).to.equal(2.5);
    });

    it('creates hexes', () => {
      game = new Game({ classRegistry:  [Space, Piece, GameElement, Cell] });
      game.createGrid({ rows: 3, columns: 3, style: 'hex' }, Cell, 'cell');
      expect(game.all(Cell).length).to.equal(9);
      expect(game.first(Cell)!.row).to.equal(1);
      expect(game.first(Cell)!.column).to.equal(1);
      expect(game.last(Cell)!.row).to.equal(3);
      expect(game.last(Cell)!.column).to.equal(3);

      const corner = game.first(Cell, {row: 1, column: 1})!;
      expect(corner.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1], [2,2]]);

      const middle = game.first(Cell, {row: 2, column: 2})!;
      expect(middle.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,1], [1,2], [2,1], [2,3], [3,2], [3,3]]);
    });

    it('creates inverse hexes', () => {
      game = new Game({ classRegistry: [Space, Piece, GameElement, Cell] });
      game.createGrid({ rows: 3, columns: 3, style: 'hex-inverse' }, Cell, 'cell');
      expect(game.all(Cell).length).to.equal(9);
      expect(game.first(Cell)!.row).to.equal(1);
      expect(game.first(Cell)!.column).to.equal(1);
      expect(game.last(Cell)!.row).to.equal(3);
      expect(game.last(Cell)!.column).to.equal(3);

      const corner = game.first(Cell, {row: 1, column: 1})!;
      expect(corner.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1]]);

      const middle = game.first(Cell, {row: 2, column: 2})!;
      expect(middle.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [1,3], [2,1], [2,3], [3,1], [3,2]]);
    });

    it('adjacencies', () => {
      game = new Game({ classRegistry: [Space, Piece, GameElement, Cell] });
      game.createGrid({ rows: 3, columns: 3 }, Cell, 'cell');
      for (const cell of game.all(Cell, {row: 2})) cell.color = 'red';
      const center = game.first(Cell, {row: 2, column: 2})!;
      expect(center.adjacencies(Cell).map(c => [c.row, c.column])).to.deep.equal([[1, 2], [2, 1], [2, 3], [3, 2]]);
      expect(center.adjacencies(Cell, {color: 'red'}).map(c => [c.row, c.column])).to.deep.equal([[2, 1], [2, 3]]);
      expect(center.isAdjacentTo(game.first(Cell, {row: 1, column: 2})!)).to.be.true;
      expect(center.isAdjacentTo(game.first(Cell, {row: 1, column: 1})!)).to.be.false;
    });
  });

  describe('placement', () => {
    it('creates squares', () => {
      game = new Game({ classRegistry: [Space, Piece] });
      const piece1 = game.create(Piece, 'piece-1', { row: 1, column: 1 });
      const piece2 = game.create(Piece, 'piece-2', { row: 1, column: 2 });
      const piece3 = game.create(Piece, 'piece-3', { row: 2, column: 2 });

      expect(piece1.adjacencies(Piece).length).to.equal(1);
      expect(piece1.adjacencies(Piece)[0]).to.equal(piece2);
      expect(piece2.adjacencies(Piece).length).to.equal(2);
      expect(piece2.adjacencies(Piece)).includes(piece1);
      expect(piece2.adjacencies(Piece)).includes(piece3);

      expect(piece2.isAdjacentTo(piece1)).to.equal(true);
      expect(piece2.isAdjacentTo(piece3)).to.equal(true);
      expect(piece1.isAdjacentTo(piece3)).to.equal(false);
    });
  });

  describe('layouts', () => {
    beforeEach(() => {
      game = new Game({ classRegistry: [Space, Piece, GameElement] });
      game.layout(GameElement, {
        margin: 0,
        gap: 0,
      });
    });

    it('applies', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      game.applyLayouts();

      expect(game._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 100, height: 100 })
      expect(a._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
    });

    it('applies overlaps', () => {
      const s1 = game.create(Space, 's1');
      const s2 = game.create(Space, 's2');
      const s3 = game.create(Space, 's3');
      const s4 = game.create(Space, 's4');
      const p1 = game.create(Piece, 'p1');
      const p2 = game.create(Piece, 'p2');
      const p3 = game.create(Piece, 'p3');
      const p4 = game.create(Piece, 'p4');
      game.applyLayouts(() => {
        game.layout(Piece, {
          rows: 3,
          columns: 3,
          direction: 'ltr'
        });
      });

      expect(p1._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(p2._ui.computedStyle).to.deep.equal({ left: 100 / 3, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(p3._ui.computedStyle).to.deep.equal({ left: 200 / 3, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(p4._ui.computedStyle).to.deep.equal({ left: 0, top: 100 / 3, width: 100 / 3, height: 100 / 3 })
    });

    it('adds gaps and margins', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          gap: 10,
          margin: 5
        });
      });
      expect(a._ui.computedStyle).to.deep.equal({ left: 5, top: 5, width: 40, height: 40 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 55, top: 5, width: 40, height: 40 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 5, top: 55, width: 40, height: 40 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 55, top: 55, width: 40, height: 40 })
    });

    it('adds gaps and margins absolutely to relative sizes', () => {
      const outer = game.createMany(4, Space, 'outer');
      const a = outer[3].create(Space, 'a');
      const b = outer[3].create(Space, 'b');
      const c = outer[3].create(Space, 'c');
      const d = outer[3].create(Space, 'd');
      game.applyLayouts(() => {
        outer[3].layout(GameElement, {
          gap: 4,
          margin: 2
        });
      });
      expect(a._ui.computedStyle).to.deep.equal({ left: 4, top: 4, width: 42, height: 42 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 54, top: 4, width: 42, height: 42 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 4, top: 54, width: 42, height: 42 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 54, top: 54, width: 42, height: 42 })
    });

    it('areas are relative to parent', () => {
      const outer = game.createMany(3, Space, 'outer');
      const a = outer[2].create(Space, 'a');
      const b = outer[2].create(Space, 'b');
      const c = outer[2].create(Space, 'c');
      const d = outer[2].create(Space, 'd');
      game.applyLayouts(() => {
        outer[2].layout(GameElement, {
          gap: 4,
          area: {
            left: 10,
            top: 20,
            width: 80,
            height: 60,
          }
        });
      });
      expect(a._ui.computedStyle).to.deep.equal({ left: 10, top: 20, width: 36, height: 26 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 54, top: 20, width: 36, height: 26 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 10, top: 54, width: 36, height: 26 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 54, top: 54, width: 36, height: 26 })
    });

    it('aligns', () => {
      const spaces = game.createMany(3, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          scaling: 'fit',
          alignment: 'right',
        });
      });

      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 60, top: 0, width: 40, height: 50 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 20, top: 0, width: 40, height: 50 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 60, top: 50, width: 40, height: 50 })
    });

    it('aligns vertical', () => {
      const spaces = game.createMany(3, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          aspectRatio: 5 / 4,
          scaling: 'fit',
          alignment: 'bottom right',
        });
      });

      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 50, top: 60, width: 50, height: 40 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 0, top: 60, width: 50, height: 40 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 50, top: 20, width: 50, height: 40 })
    });

    it('sizes to fit', () => {
      const spaces = game.createMany(3, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          scaling: 'fit'
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 10, top: 0, width: 40, height: 50 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 40, height: 50 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 10, top: 50, width: 40, height: 50 })
    });

    it('sizes to fill', () => {
      const spaces = game.createMany(3, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 62.5 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 62.5 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 0, top: 37.5, width: 50, height: 62.5 })
    });

    it('retains sizes', () => {
      const spaces = game.createMany(3, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          size: { width: 20, height: 25 },
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 30, top: 25, width: 20, height: 25 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 25, width: 20, height: 25 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 30, top: 50, width: 20, height: 25 })
    });

    it('fits based on aspect ratios', () => {
      const spaces = game.createMany(3, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          aspectRatio: 5 / 4,
          scaling: 'fit'
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 0, top: 10, width: 50, height: 40 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 10, width: 50, height: 40 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 40 })
    });

    it('fills based on aspect ratios', () => {
      const spaces = game.createMany(3, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          aspectRatio: 5 / 4,
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 62.5, height: 50 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 37.5, top: 0, width: 62.5, height: 50 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 62.5, height: 50 })
    });

    it('accommodate min row', () => {
      const spaces = game.createMany(10, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          rows: { min: 2 },
          columns: 1,
          aspectRatio: 5 / 4,
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle?.width).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.height).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.top).to.be.approximately(0, 0.0001);
    });

    it('accommodate min col', () => {
      const spaces = game.createMany(10, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          columns: { min: 2 },
          rows: 1,
          aspectRatio: 4 / 5,
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle?.height).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.width).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.left).to.be.approximately(0, 0.0001);
    });

    it('size overrides scaling', () => {
      const spaces = game.createMany(10, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          rows: { min: 2 },
          columns: 1,
          size: { width: 5, height: 4 },
          scaling: 'fill'
        });
      });
      expect(spaces[0]._ui.computedStyle?.width).to.equal(5);
      expect(spaces[0]._ui.computedStyle?.height).to.equal(4);
      expect(spaces[0]._ui.computedStyle?.top).to.equal(30);
    });

    it('isomorphic', () => {
      const spaces = game.createMany(9, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          offsetColumn: {x: 100, y: 100},
          scaling: 'fit',
        });
      });

      expect(spaces[0]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 42, top: 0 });
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 58, top: 20 });
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 74, top: 40 });
      expect(spaces[3]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 26, top: 20 });
      expect(spaces[4]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 42, top: 40 });
      expect(spaces[5]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 58, top: 60 });
      expect(spaces[6]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 10, top: 40 });
      expect(spaces[7]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 26, top: 60 });
      expect(spaces[8]._ui.computedStyle).to.deep.equal({ width: 16, height: 20, left: 42, top: 80 });
    });

    it('stacks', () => {
      const spaces = game.createMany(9, Space, 'space');
      game.applyLayouts(() => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          offsetColumn: {x: -5, y: -5},
          scaling: 'fit',
          direction: 'ltr'
        });
      });

      expect(spaces[8]!._ui.computedStyle!.top).to.equal(0);
      expect(spaces[0]!._ui.computedStyle!.top + spaces[0]!._ui.computedStyle!.height).to.equal(100);
    });

    it('align+scale', () => {
      const pieces = game.createMany(6, Piece, 'piece');

      game.applyLayouts(() => {
        game.layout(Piece, {
          offsetColumn: {x: 10, y: 10},
          scaling: 'fit',
        });
      });

      expect(pieces[0]!._ui.computedStyle!.top).to.equal(0);
      expect(pieces[5]!._ui.computedStyle!.top + pieces[5]!._ui.computedStyle!.height).to.equal(100);
      expect(pieces[3]!._ui.computedStyle!.left).to.equal(0);
      expect(pieces[2]!._ui.computedStyle!.left + pieces[2]!._ui.computedStyle!.width).to.equal(100);
    });

    it('specificity', () => {
      class Country extends Space<Game> { }
      game = new Game({ classRegistry: [Space, Piece, GameElement, Country] });

      const spaces = game.createMany(4, Space, 'space');
      const space = game.create(Space, 'special');
      const france = game.create(Country, 'france');
      const special = game.create(Country, 'special');
      const el = game.create(GameElement, 'whatev');

      game.applyLayouts(() => {
        game.layout(spaces[2], { direction: 'btt-rtl', showBoundingBox: '1' });
        game.layout('special', { direction: 'ttb-rtl', showBoundingBox: '2' });
        game.layout(spaces.slice(0, 2), { direction: 'ttb', showBoundingBox: '3' });
        game.layout(Country, { direction: 'rtl', showBoundingBox: '4' });
        game.layout(Space, { direction: 'btt', showBoundingBox: '5' });
        game.layout(GameElement, { direction: 'ltr-btt', showBoundingBox: '6' });
      });

      expect(game._ui.computedLayouts?.[6].children).to.include(el); // by GameElement
      expect(game._ui.computedLayouts?.[5].children).contains(spaces[3]); // by Space
      expect(game._ui.computedLayouts?.[4].children).contains(france); // by more specific class
      expect(game._ui.computedLayouts?.[3].children).contains(spaces[0]); // by single ref
      expect(game._ui.computedLayouts?.[2].children).contains(space); // by name
      expect(game._ui.computedLayouts?.[2].children).contains(special); // by name
      expect(game._ui.computedLayouts?.[1].children).contains(spaces[2]); // by array ref
    });

    it('can place', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.row = 2;
      a.column = 2;
      game.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
    });

    it('can shift bounds', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.row = 4;
      a.column = 4;
      game.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
    });

    it('can shift negative', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.row = -4;
      a.column = -4;
      game.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
    });

    it('can stretch bounds', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.row = 1;
      a.column = 2;
      d.row = 4;
      d.column = 2;
      game.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 100, height: 25 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 0, top: 25, width: 100, height: 25 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 100, height: 25 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 0, top: 75, width: 100, height: 25 })
    });

    it('can become sparse', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.row = 4;
      a.column = 1;
      d.row = 1;
      d.column = 4;
      game.applyLayouts();

      expect(a._ui.computedStyle).to.deep.equal({ left: 0, top: 75, width: 25, height: 25 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 25, height: 25 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 25, top: 0, width: 25, height: 25 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 75, top: 0, width: 25, height: 25 })
    });

    it('can place sticky', () => {
      const a = game.create(Piece, 'a');
      const b = game.create(Piece, 'b');
      const c = game.create(Piece, 'c');
      const d = game.create(Piece, 'd');
      game.applyLayouts(() => {
        game.layout(Piece, { sticky: true });
      });
      a.remove();

      expect(b._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
    });
  });

  describe('shapes', () => {
    let p1: Piece<Game>;
    let p2: Piece<Game>;

    beforeEach(() => {
      p1 = game.create(Piece, 'p1');
      p2 = game.create(Piece, 'p2');

      p1.setShape(
        'ABC',
        'D  ',
        'E  ',
      );

      p2.setShape(
        'abcd',
        'e f ',
      );
    });

    describe("both zero degrees", () => {
      it('finds overlap 1', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = 0;
        p2.row = 0;

        expect(p1.isOverlapping(p2)).to.be.true;
      });

      it('finds overlap 2', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = 1;
        p2.row = 1;

        expect(p1.isOverlapping(p2)).to.be.false;
      });

      it('finds overlap 3', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = -1;

        expect(p1.isOverlapping(p2)).to.be.true;
      });

      it('finds overlap 4', () => {
        p1.column = 4;
        p1.row = 2;
        p2.column = 1;
        p2.row = 1;

        expect(p1.isOverlapping(p2)).to.be.false;
      });
    });

    describe("p1 at 90 degrees", () => {
      beforeEach(() => p1.rotation = 90);
      it('finds overlap 5', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = 1;

        expect(p1.isOverlapping(p2)).to.be.true;
      });

      it('finds overlap 6', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -2;
        p2.row = 1;

        expect(p1.isOverlapping(p2)).to.be.false;
      });

      it('finds overlap 7', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = 2;
        p2.row = 2;

        expect(p1.isOverlapping(p2)).to.be.true;
      });

      it('finds overlap 8', () => {
        p1.column = 2;
        p1.row = 4;
        p2.column = 3;
        p2.row = 2;

        expect(p1.isOverlapping(p2)).to.be.false;
      });
    });

    describe("p2 at 270 degrees", () => {
      beforeEach(() => p2.rotation = 270);
      it('finds overlap 9', () => {
        p1.column = -1;
        p1.row = 0;
        p2.column = 1;
        p2.row = 0;

        expect(p1.isOverlapping(p2)).to.be.true;
      });

      it('finds overlap 10', () => {
        p1.column = -1;
        p1.row = 0;
        p2.column = 0;
        p2.row = 1;

        expect(p1.isOverlapping(p2)).to.be.false;
      });

      it('finds overlap 11', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = 0;
        p2.row = 2;

        expect(p1.isOverlapping(p2)).to.be.true;
      });

      it('finds overlap 12', () => {
        p1.column = 1;
        p1.row = 0;
        p2.column = 0;
        p2.row = 2;

        expect(p1.isOverlapping(p2)).to.be.false;
      });
    });

    describe("p1 at 180 degrees, p2 at 270 degrees", () => {
      beforeEach(() => {p1.rotation = 180; p2.rotation = 270});
      it('finds overlap 13', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = -1;

        expect(p1.isOverlapping(p2)).to.be.true;
      });

      it('finds overlap 14', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = 0;
        p1.setEdges({
          C: {
            up: 'UP',
            down: 'DOWN',
            left: 'LEFT',
            right: 'RIGHT'
          }
        });
        p2.setEdges({
          b: {
            up: 'up',
            down: 'down',
            left: 'left',
            right: 'right'
          },
          f: {
            up: 'Up',
            down: 'Down',
            left: 'Left',
            right: 'Right'
          },
          e: {
            right: 'stuff'
          }
        });

        // d  E
        // cf D
        // bCBA
        // ae
        expect(p1.isOverlapping(p2)).to.be.false;
        expect(p1.adjacenciesWithCells(p2)).to.deep.equal([
          {
            element: p2,
            from: 'C',
            to: 'f'
          },
          {
            element: p2,
            from: 'C',
            to: 'b'
          },
          {
            element: p2,
            from: 'C',
            to: 'e'
          }
        ]);
        expect(p1.adjacenciesWithEdges(p2)).to.deep.equal([
          {
            element: p2,
            from: 'DOWN',
            to: 'Left'
          },
          {
            element: p2,
            from: 'RIGHT',
            to: 'down'
          },
          {
            element: p2,
            from: 'UP',
            to: 'stuff'
          }
        ]);
      });

      it('finds overlap 15', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = 1;

        expect(p1.isOverlapping(p2)).to.be.true;
      });

      it('finds overlap 16', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = 2;
        p1.setEdges({
          C: {
            up: 'UP',
            down: 'DOWN',
            left: 'LEFT',
            right: 'RIGHT'
          }
        });
        p2.setEdges({
          d: {
            up: 'up',
            down: 'down',
            left: 'left',
            right: 'right'
          },
          f: {
            up: 'Up',
            down: 'Down',
            left: 'Left',
            right: 'Right'
          }
        });

        //    E
        //    D
        // dCBA
        // cf
        // b
        // ae
        expect(p1.isOverlapping(p2)).to.be.false;
        expect(p1.adjacenciesWithCells(p2)).to.deep.equal([
          {
            element: p2,
            from: 'C',
            to: 'd'
          },
          {
            element: p2,
            from: 'C',
            to: 'f'
          }
        ]);
        expect(p1.adjacenciesWithEdges(p2)).to.deep.equal([
          {
            element: p2,
            from: 'RIGHT',
            to: 'down'
          },
          {
            element: p2,
            from: 'UP',
            to: 'Right'
          }
        ]);
      });

      it('3 body problem', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = 2;
        const p3 = game.create(Piece, 'p3') // unshaped
        p3.column = 1;
        p3.row = 3;
        p1.setEdges({
          C: {
            up: 'UP',
            down: 'DOWN',
            left: 'LEFT',
            right: 'RIGHT'
          },
          B: {
            up: 'UP',
            down: 'DOWN',
            left: 'LEFT',
            right: 'RIGHT'
          }
        });
        p2.setEdges({
          d: {
            up: 'up',
            down: 'down',
            left: 'left',
            right: 'right'
          },
          f: {
            up: 'Up',
            down: 'Down',
            left: 'Left',
            right: 'Right'
          }
        });

        //    E
        //    D
        // dCBA
        // cf.
        // b
        // ae
        expect(p1.isOverlapping(p2)).to.be.false;
        expect(p1.isOverlapping(p3)).to.be.false;
        expect(p3.isOverlapping(p1)).to.be.false;
        expect(p3.isOverlapping(p2)).to.be.false;
        expect(p1.isOverlapping()).to.be.false;
        expect(p3.isOverlapping()).to.be.false;
        expect(p1.adjacenciesWithCells()).to.deep.equal([
          {
            element: p2,
            from: 'C',
            to: 'd'
          },
          {
            element: p2,
            from: 'C',
            to: 'f'
          },
          {
            element: p3,
            from: 'B',
            to: '.'
          }
        ]);
        expect(p1.adjacenciesWithEdges()).to.deep.equal([
          {
            element: p2,
            from: 'RIGHT',
            to: 'down'
          },
          {
            element: p2,
            from: 'UP',
            to: 'Right'
          },
          {
            element: p3,
            from: 'UP',
            to: undefined
          }
        ]);
        expect(p3.adjacenciesWithEdges()).to.deep.equal([
          {
            element: p1,
            from: undefined,
            to: 'UP'
          },
          {
            element: p2,
            from: undefined,
            to: 'Down'
          },
        ]);
      });
    });
  });
});

      // console.log('<div style="width: 200; height: 200; position: relative; outline: 1px solid black">');
      // for (const c of game._t.children) console.log(`<div style="position: absolute; left: ${c._ui.computedStyle?.left}%; top: ${c._ui.computedStyle?.top}%; width: ${c._ui.computedStyle?.width}%; height: ${c._ui.computedStyle?.height}%; background: red; outline: 1px solid blue"></div>`);
      // console.log('</div>');
