import chai from 'chai';
import spies from 'chai-spies';
import random from 'random-seed';

import {
  Game,
  Space,
  Piece,
  ConnectedSpaceMap,
  SquareGrid,
  HexGrid,
  PieceGrid
} from '../board/index.js';

import {
  Player,
  PlayerCollection,
} from '../player/index.js';
import type { BaseGame } from '../board/game.js';
import { applyLayouts } from '../ui/render.js';

chai.use(spies);
const { expect } = chai;

describe('Game', () => {
  let game: BaseGame;

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
    });
    game._ctx.gameManager.game = game;
    game.setBoardSize({
      name: '_default',
      aspectRatio: 1,
      frame: {x:100, y:100},
      screen: {x:100, y:100}
    });
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
    map.create(Piece, 'token3');
    map.create(Space, 'england', {});
    game.create(Space, 'play', {});
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
    map.create(Space, 'england', {});
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
    map.create(Space, 'england', {});
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
        { className: 'Card', _ref: 2, flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _visible: { default: false, except: [1] } },
      );
      expect(card.toJSON(2)).to.deep.equal(
        { className: 'Card', _ref: 2, flipped: false, state: 'initial', pip: 1, _visible: { default: false, except: [1] } },
      )
      game.fromJSON(JSON.parse(JSON.stringify(game.allJSON(2))));
      const card3 = game.first(Card)!;
      expect(card3.pip).to.equal(1);
      expect(card3.suit).to.equal(undefined);
    });

    it("hides spaces", () => {
      const hand = game.create(Space, 'hand', { player: players[0] });
      hand.create(Card, 'AH', { suit: 'H', pip: 1 });

      hand.blockViewFor('all-but-owner');
      expect(hand.toJSON(1)).to.deep.equal(
        { className: 'Space', name: "hand", player: "$p[1]", _ref: 2, children: [
          {className: 'Card', _ref: 3, flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1},
        ]}
      );
      expect(hand.toJSON(2)).to.deep.equal(
        { className: 'Space', name: "hand", player: "$p[1]", _ref: 2 }
      );

      hand.blockViewFor('all');
      expect(hand.toJSON(1)).to.deep.equal(
        { className: 'Space', name: "hand", player: "$p[1]", _ref: 2 }
      );
      expect(hand.toJSON(2)).to.deep.equal(
        { className: 'Space', name: "hand", player: "$p[1]", _ref: 2 }
      );

      hand.blockViewFor('none');
      expect(hand.toJSON(1)).to.deep.equal(
        { className: 'Space', name: "hand", player: "$p[1]", _ref: 2, children: [
          {className: 'Card', _ref: 3, flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1},
        ]}
      );
      expect(hand.toJSON(2)).to.deep.equal(
        { className: 'Space', name: "hand", player: "$p[1]", _ref: 2, children: [
          {className: 'Card', _ref: 3, flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1},
        ]}
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
    let map: ConnectedSpaceMap<BaseGame>;
    beforeEach(() => {
      map = game.create(ConnectedSpaceMap, 'map');
    });

    it("adjacency", () => {
      const a = map.create(Space, 'a');
      const b = map.create(Space, 'b');
      const c = map.create(Space, 'c');
      map.connect(a, b);
      expect(a.isAdjacentTo(b)).to.equal(true);
      expect(a.isAdjacentTo(c)).to.equal(false);
      expect(map.isAdjacent(a, b)).to.equal(true);
      expect(map.isAdjacent(a, c)).to.equal(false);
    })

    it("calculates distance", () => {
      const a = map.create(Space, 'a');
      const b = map.create(Space, 'b');
      const c = map.create(Space, 'c');
      map.connect(a, b, 2);
      map.connect(b, c, 3);
      map.connect(a, c, 6);
      expect(a.distanceTo(c)).to.equal(5);
      expect(map.distanceBetween(a, c)).to.equal(5);
    })

    it("calculates closest", () => {
      const a = map.create(Space, 'a');
      const b = map.create(Space, 'b');
      const c = map.create(Space, 'c');
      map.connect(a, b, 2);
      map.connect(b, c, 3);
      map.connect(a, c, 6);
      expect(map.closestTo(a)).to.equal(b);
    })

    it("finds adjacencies", () => {
      const a = map.create(Space, 'a');
      const b = map.create(Space, 'b');
      const c = map.create(Space, 'c');
      const d = map.create(Space, 'd');
      map.connect(a, b, 2);
      map.connect(b, c, 3);
      map.connect(a, c, 6);
      map.connect(c, d, 1);
      expect(a.adjacencies()).to.deep.equal([b, c]);
      expect(c.adjacencies()).to.deep.equal([a, b, d]);
      expect(map.allAdjacentTo(a)).to.deep.equal([b, c]);
      expect(map.allAdjacentTo(c)).to.deep.equal([a, b, d]);
    })

    it("searches by distance", () => {
      const a = map.create(Space, 'a');
      const b = map.create(Space, 'b');
      const c = map.create(Space, 'c');
      const d = map.create(Space, 'd');
      map.connect(a, b, 2);
      map.connect(b, c, 3);
      map.connect(a, c, 6);
      map.connect(c, d, 1);
      expect(a.withinDistance(5).all(Space)).to.deep.equal([b, c]);
      expect(map.allWithinDistanceOf(a, 5, Space)).to.deep.equal([b, c]);
    })

    it("searches contiguous", () => {
      const a = map.create(Space, 'a');
      const b = map.create(Space, 'b');
      const c = map.create(Space, 'c');
      const d = map.create(Space, 'd');
      const e = map.create(Space, 'e');
      const f = map.create(Space, 'f');
      map.connect(a, b, 2);
      map.connect(b, c, 3);
      map.connect(a, c, 6);
      map.connect(c, d, 1);
      map.connect(e, f, 1);
      expect(map.allConnectedTo(a).all(Space)).to.deep.equal([a, b, c, d]);
    })
  });

  describe('grids', () => {
    class Cell extends Space<Game> { color: string }

    it('creates squares', () => {
      game.create(SquareGrid, 'square', { rows: 3, columns: 3, space: Cell });
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
      const square = game.create(SquareGrid, 'square', { rows: 3, columns: 3, diagonalDistance: 1.5, space: Cell });
      expect(game.all(Cell).length).to.equal(9);
      expect(game.first(Cell)!.row).to.equal(1);
      expect(game.first(Cell)!.column).to.equal(1);
      expect(game.last(Cell)!.row).to.equal(3);
      expect(game.last(Cell)!.column).to.equal(3);

      const corner = game.first(Cell, {row: 1, column: 1})!;
      expect(corner.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,2], [2,1], [2,2]]);

      const knight = game.first(Cell, {row: 3, column: 2})!;
      expect(square.distanceBetween(corner, knight)).to.equal(2.5);
    });

    it('creates hexes', () => {
      game.create(HexGrid, 'hex', { rows: 3, columns: 3, space: Cell });
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
      game.create(HexGrid, 'hex', { rows: 3, columns: 3, axes: 'east-by-southeast', space: Cell });
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

    it('creates hex-shaped hexes', () => {
      game.create(HexGrid, 'hex', { rows: 4, columns: 5, shape: 'hex', space: Cell });
      expect(game.all(Cell).length).to.equal(16);
      expect(game.all(Cell, {row: 1}).length).to.equal(3);
      expect(game.all(Cell, {row: 2}).length).to.equal(4);
      expect(game.all(Cell, {row: 3}).length).to.equal(5);
      expect(game.all(Cell, {row: 4}).length).to.equal(4);

      const cell = game.first(Cell, {row: 2, column: 4})!;
      expect(cell.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,3], [2,3], [3,4], [3,5]]);
    });

    it('creates inverse hex-shaped hexes', () => {
      game.create(HexGrid, 'hex', { rows: 4, columns: 5, shape: 'hex', axes: 'east-by-southeast', space: Cell });
      expect(game.all(Cell).length).to.equal(16);
      expect(game.all(Cell, {row: 1}).length).to.equal(3);
      expect(game.all(Cell, {row: 2}).length).to.equal(4);
      expect(game.all(Cell, {row: 3}).length).to.equal(5);
      expect(game.all(Cell, {row: 4}).length).to.equal(4);

      const cell = game.first(Cell, {row: 2, column: 2})!;
      expect(cell.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,3], [2,3], [3,1], [3,2]]);
    });

    it('creates square-shaped hexes', () => {
      game.create(HexGrid, 'hex', { rows: 4, columns: 5, shape: 'square', axes: 'east-by-southeast', space: Cell });
      expect(game.all(Cell).length).to.equal(18);
      expect(game.all(Cell, {row: 1}).length).to.equal(5);
      expect(game.all(Cell, {row: 2}).length).to.equal(4);
      expect(game.all(Cell, {row: 3}).length).to.equal(5);
      expect(game.all(Cell, {row: 4}).length).to.equal(4);

      const cell = game.first(Cell, {row: 2, column: 1})!;
      expect(cell.adjacencies(Cell).map(e => [e.row, e.column])).to.deep.equal([[1,1], [1,2], [2,2], [3,0], [3,1]]);
    });

    it('adjacencies', () => {
      game.create(SquareGrid, 'square', { rows: 3, columns: 3, space: Cell });
      for (const cell of game.all(Cell, {row: 2})) cell.color = 'red';
      const center = game.first(Cell, {row: 2, column: 2})!;
      expect(center.adjacencies(Cell).map(c => [c.row, c.column])).to.deep.equal([[1, 2], [2, 1], [2, 3], [3, 2]]);
      expect(center.adjacencies(Cell, {color: 'red'}).map(c => [c.row, c.column])).to.deep.equal([[2, 1], [2, 3]]);
      expect(center.isAdjacentTo(game.first(Cell, {row: 1, column: 2})!)).to.be.true;
      expect(center.isAdjacentTo(game.first(Cell, {row: 1, column: 1})!)).to.be.false;
    });

    it('deep adjacencies', () => {
      game.create(SquareGrid, 'square', { rows: 3, columns: 3, space: Cell });
      const topLeft = game.first(Cell, {row: 1, column: 1})!;
      const topCenter = game.first(Cell, {row: 1, column: 2})!;
      const center = game.first(Cell, {row: 2, column: 2})!;
      const p1 = topLeft.create(Piece, 'p1');
      const p2 = topCenter.create(Piece, 'p2');
      const p3 = center.create(Piece, 'p3');
      expect(p2.adjacencies(Piece)).to.deep.equal([p1, p3]);
      expect(p1.adjacencies(Piece)).to.deep.equal([p2]);
      expect(p3.adjacencies(Piece)).to.deep.equal([p2]);
    });
  });

  describe('shapes', () => {
    let p1: Piece<Game>;
    let p2: Piece<Game>;
    let map: PieceGrid<Game>;

    beforeEach(() => {
      map = game.create(PieceGrid, 'map');
      p1 = map.create(Piece, 'p1');
      p2 = map.create(Piece, 'p2');

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

        expect(map.isOverlapping(p1, p2)).to.be.true;
      });

      it('finds overlap 2', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = 1;
        p2.row = 1;

        expect(map.isOverlapping(p1, p2)).to.be.false;
      });

      it('finds overlap 3', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = -1;

        expect(map.isOverlapping(p1, p2)).to.be.true;
      });

      it('finds overlap 4', () => {
        p1.column = 4;
        p1.row = 2;
        p2.column = 1;
        p2.row = 1;

        expect(map.isOverlapping(p1, p2)).to.be.false;
      });
    });

    describe("p1 at 90 degrees", () => {
      beforeEach(() => p1.rotation = 90);
      it('finds overlap 5', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = 1;

        expect(map.isOverlapping(p1, p2)).to.be.true;
      });

      it('finds overlap 6', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -2;
        p2.row = 1;

        expect(map.isOverlapping(p1, p2)).to.be.false;
      });

      it('finds overlap 7', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = 2;
        p2.row = 2;

        expect(map.isOverlapping(p1, p2)).to.be.true;
      });

      it('finds overlap 8', () => {
        p1.column = 2;
        p1.row = 4;
        p2.column = 3;
        p2.row = 2;

        expect(map.isOverlapping(p1, p2)).to.be.false;
      });
    });

    describe("p2 at 270 degrees", () => {
      beforeEach(() => p2.rotation = 270);
      it('finds overlap 9', () => {
        p1.column = -1;
        p1.row = 0;
        p2.column = 1;
        p2.row = 0;

        expect(map.isOverlapping(p1, p2)).to.be.true;
      });

      it('finds overlap 10', () => {
        p1.column = -1;
        p1.row = 0;
        p2.column = 0;
        p2.row = 1;

        expect(map.isOverlapping(p1, p2)).to.be.false;
      });

      it('finds overlap 11', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = 0;
        p2.row = 2;

        expect(map.isOverlapping(p1, p2)).to.be.true;
      });

      it('finds overlap 12', () => {
        p1.column = 1;
        p1.row = 0;
        p2.column = 0;
        p2.row = 2;

        expect(map.isOverlapping(p1, p2)).to.be.false;
      });
    });

    describe("p1 at 180 degrees, p2 at 270 degrees", () => {
      beforeEach(() => {p1.rotation = 180; p2.rotation = 270});
      it('finds overlap 13', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = -1;

        expect(map.isOverlapping(p1, p2)).to.be.true;
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
        expect(map.isOverlapping(p1, p2)).to.be.false;
        expect(map.adjacenciesByCell(p1, p2)).to.deep.equal([
          {
            piece: p2,
            from: 'C',
            to: 'f'
          },
          {
            piece: p2,
            from: 'C',
            to: 'e'
          },
          {
            piece: p2,
            from: 'C',
            to: 'b'
          },
        ]);
        expect(map.adjacenciesByEdge(p1, p2)).to.deep.equal([
          {
            piece: p2,
            from: 'DOWN',
            to: 'Left'
          },
          {
            piece: p2,
            from: 'UP',
            to: 'stuff'
          },
          {
            piece: p2,
            from: 'RIGHT',
            to: 'down'
          },
        ]);
      });

      it('finds overlap 15', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = 1;

        expect(map.isOverlapping(p1, p2)).to.be.true;
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
        expect(map.isOverlapping(p1, p2)).to.be.false;
        expect(map.adjacenciesByCell(p1, p2)).to.deep.equal([
          {
            piece: p2,
            from: 'C',
            to: 'f'
          },
          {
            piece: p2,
            from: 'C',
            to: 'd'
          },
        ]);
        expect(map.adjacenciesByEdge(p1, p2)).to.deep.equal([
          {
            piece: p2,
            from: 'UP',
            to: 'Right'
          },
          {
            piece: p2,
            from: 'RIGHT',
            to: 'down'
          }
        ]);
      });

      it('3 body problem', () => {
        p1.column = 0;
        p1.row = 0;
        p2.column = -1;
        p2.row = 2;
        const p3 = map.create(Piece, 'p3') // unshaped
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
        expect(map.isOverlapping(p1, p2)).to.be.false;
        expect(map.isOverlapping(p1, p3)).to.be.false;
        expect(map.isOverlapping(p3, p1)).to.be.false;
        expect(map.isOverlapping(p3, p2)).to.be.false;
        expect(map.isOverlapping(p1)).to.be.false;
        expect(map.isOverlapping(p3)).to.be.false;
        expect(map.adjacenciesByCell(p1)).to.deep.equal([
          {
            piece: p2,
            from: 'C',
            to: 'f'
          },
          {
            piece: p2,
            from: 'C',
            to: 'd'
          },
          {
            piece: p3,
            from: 'B',
            to: '.'
          }
        ]);
        expect(map.adjacenciesByEdge(p1)).to.deep.equal([
          {
            piece: p2,
            from: 'UP',
            to: 'Right'
          },
          {
            piece: p2,
            from: 'RIGHT',
            to: 'down'
          },
          {
            piece: p3,
            from: 'UP',
            to: undefined
          }
        ]);
        expect(map.adjacenciesByEdge(p3)).to.deep.equal([
          {
            piece: p1,
            from: undefined,
            to: 'UP'
          },
          {
            piece: p2,
            from: undefined,
            to: 'Down'
          },
        ]);
      });
    });

    it('can place shapes', () => {
      p1.column = 0;
      p1.row = 0;
      p2.column = -1;
      p2.row = -1;

      const ui = applyLayouts(game);
      expect(ui.all[p1._t.ref].relPos).to.deep.equal({ left: 25, top: 25, width: 75, height: 75 })
      expect(ui.all[p2._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 100, height: 50 })
    });

    it('can place shapes rotated', () => {
      p1.column = 0;
      p1.row = 0;
      p1.rotation = 180;
      p2.column = 1;
      p2.row = 1;
      p2.rotation = 90;

      const ui = applyLayouts(game);
      expect(ui.all[p1._t.ref].relPos).to.deep.equal({ left: 20, top: 0, width: 60, height: 60, rotation: 180 })
      expect(ui.all[p2._t.ref].relPos).to.deep.equal({ left: 40, top: 20, width: 80, height: 40, rotation: 90 })
      expect(ui.all[p2._t.ref].baseStyles?.transformOrigin).to.equal('25% 50%')
    });

    it('can find place for shapes', () => {
      p1.column = 4;
      p1.row = 5;
      p1.rotation = 0;
      p2.column = 5;
      p2.row = 5;
      p2.rotation = 90;
      map._fitPieceInFreePlace(p2, 4, 4, {column: 4, row: 4});
      // ..ea
      // ABCb
      // D.fc
      // E..d
      expect(p2.column).equal(6);
      expect(p2.row).equal(4);
      expect(p2.rotation).equal(90);
    });

    it('can find place for shapes even if rotation is forced', () => {
      p1.column = 2;
      p1.row = 2;
      p1.rotation = 180;
      p2.column = 2;
      p2.row = 2;
      p2.rotation = 90;
      map.rows = 5;
      map.columns = 5;
      map._fitPieceInFreePlace(p2, 5, 5, {column: 1, row: 1});
      // .....
      // d..E.
      // cf.D.
      // bCBA.
      // ae...
      expect(p2.column).equal(1);
      expect(p2.row).equal(2);
      expect(p2.rotation).equal(270);
    });
  });
});
