import chai from 'chai';
import spies from 'chai-spies';

import {
  Board,
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

describe('Board', () => {
  let board: Board<Player>;

  const players = new PlayerCollection<Player>;
  players.className = Player;
  players.addPlayer({
    name: 'Joe',
    position: 1,
    color: 'red',
    avatar: '',
    host: true
  });
  players.addPlayer({
    name: 'Jane',
    position: 2,
    color: 'green',
    avatar: '',
    host: false
  });

  beforeEach(() => {
    board = new Board({
      // @ts-ignore
      game: { players },
      classRegistry: [Space, Piece, GameElement]
    });
    board._ctx.game.board = board;
  });

  it('renders', () => {
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0 },
      ]
    );
  });

  it('creates new spaces', () => {
    board.create(Space, 'map', {});
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0, children: [
          { className: 'Space', name: 'map', _id: 2 }
        ]},
      ]
    );
  });

  it('creates new pieces', () => {
    board.create(Piece, 'token', { player: players[0] });
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0, children: [
          { className: 'Piece', name: 'token', _id: 2, player: '$p[1]' }
        ]},
      ]
    );
  });

  it('removes pieces', () => {
    board.create(Piece, 'token', { player: players[1] });
    board.create(Piece, 'token', { player: players[0] });
    board.first(Piece)!.remove();
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0, children: [
          { className: 'Piece', name: 'token', _id: 3, player: '$p[1]' }
        ]},
        { className: 'Piece', name: 'token', _id: 2, player: '$p[2]' }
      ]
    );
  });

  it('removes all', () => {
    board.create(Piece, 'token', { player: players[1] });
    board.create(Piece, 'token', { player: players[0] });
    board.all(Piece).remove();
    expect(board.allJSON()).to.deep.equals(
      [
        { className: 'Board', _id: 0},
        { className: 'Piece', name: 'token', _id: 2, player: '$p[2]' },
        { className: 'Piece', name: 'token', _id: 3, player: '$p[1]' }
      ]
    );
  });

  it('builds from json', () => {
    const map = board.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const piece3 = map.create(Piece, 'token3');
    const england = map.create(Space, 'england', {});
    const play = board.create(Space, 'play', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = france.create(Piece, 'token2', { player: players[1] });
    const json = board.allJSON();
    board.fromJSON(JSON.parse(JSON.stringify(board.allJSON())));
    expect(board.allJSON()).to.deep.equals(json);
    expect(board.first(Piece, 'token1')!._t.id).to.equal(piece1._t.id);
    expect(board.first(Piece, 'token1')!.player).to.equal(players[0]);
    expect(board.first(Piece, 'token2')!._t.id).to.equal(piece2._t.id);
    expect(board.first(Piece, 'token2')!.player).to.equal(players[1]);
    expect(board.first(Space, 'france')).to.equal(france);
  });

  it('preserves serializable attributes from json', () => {
    class Country extends Space<Player> {
      rival: Country;
      general: Piece<Player>;
    }
    board._ctx.classRegistry = [Space, Piece, GameElement, Country];

    const map = board.create(Space, 'map', {});
    const napolean = map.create(Piece, 'napolean')
    const england = map.create(Country, 'england', {});
    const france = map.create(Country, 'france', { rival: england, general: napolean });
    const json = board.allJSON();
    board.fromJSON(JSON.parse(JSON.stringify(board.allJSON())));
    expect(board.allJSON()).to.deep.equals(json);
    expect(board.first(Country, 'france')).to.equal(france);
    expect(board.first(Country, 'france')!.rival).to.equal(england);
    expect(board.first(Country, 'france')!.general).to.not.equal(napolean);
    expect(board.first(Country, 'france')!.general).to.equal(board.first(Piece, 'napolean'));
  });

  it('understands branches', () => {
    const map = board.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const england = map.create(Space, 'england', {});
    const play = board.create(Space, 'play', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = france.create(Piece, 'token2', { player: players[1] });
    const piece3 = play.create(Piece, 'token3');
    expect(piece1.branch()).to.equal('0/0/0/0');
    expect(piece2.branch()).to.equal('0/0/0/1');
    expect(piece3.branch()).to.equal('0/1/0');
    expect(board.atBranch('0/0/0/0')).to.equal(piece1);
    expect(board.atBranch('0/0/0/1')).to.equal(piece2);
    expect(board.atBranch('0/1/0')).to.equal(piece3);
  });

  it('assigns and finds IDs', () => {
    const map = board.create(Space, 'map', {});
    const france = map.create(Space, 'france', {});
    const england = map.create(Space, 'england', {});
    const play = board.create(Space, 'play', {});
    const piece1 = france.create(Piece, 'token1', { player: players[0] });
    const piece2 = france.create(Piece, 'token2', { player: players[1] });
    const piece3 = play.create(Piece, 'token3');
    expect(piece1._t.id).to.equal(6);
    expect(piece2._t.id).to.equal(7);
    expect(piece3._t.id).to.equal(8);
    expect(board.atID(6)).to.equal(piece1);
    expect(board.atID(7)).to.equal(piece2);
    expect(board.atID(8)).to.equal(piece3);
  });

  describe("Element subclasses", () => {
    class Card extends Piece<Player> {
      suit: string;
      pip: number = 1;
      flipped?: boolean = false;
      state?: string = 'initial';
    }

    beforeEach(() => {
      board._ctx.classRegistry.push(Card);
    });

    it('takes attrs', () => {
      board.create(Card, '2H', { suit: 'H', pip: 2 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 2 }
          ]},
        ]
      );
    });

    it('takes base attrs', () => {
      board.create(Card, '2H', { player: players[1], suit: 'H', pip: 2 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: '2H', player: '$p[2]', suit: 'H', pip: 2, _id: 2 }
          ]},
        ]
      );
    });

    it('searches', () => {
      board.create(Card, 'AH', { suit: 'H', pip: 1 });
      board.create(Card, '2H', { suit: 'H', pip: 2 });
      board.create(Card, '3H', { suit: 'H', pip: 3 });
      const card = board.first(Card, {pip: 2});
      expect(card!.name).equals('2H');
      const card2 = board.first(Card, {pip: 4});
      expect(card2).equals(undefined);
      const card3 = board.first(Card, {pip: 2, suit: 'D'});
      expect(card3).equals(undefined);
      const cards = board.all(Card, c => c.pip >= 2);
      expect(cards.length).equals(2);
      expect(cards[0].name).equals('2H');
      expect(cards[1].name).equals('3H');
      const card4 = board.first("2H");
      expect(card4!.name).equals('2H');
    });

    it('searches undefined', () => {
      board.create(Card, 'AH', { suit: 'H', pip: 1, player: players[0] });
      board.create(Card, '2H', { suit: 'H', pip: 2, player: players[1] });
      const h3 = board.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(board.first(Card, {player: undefined})).to.equal(h3);
    }),

    it('modifies', () => {
      board.create(Card, 'AH', { suit: 'H', pip: 1 });
      board.create(Card, '2H', { suit: 'H', pip: 2 });
      board.create(Card, '3H', { suit: 'H', pip: 3 });
      const card = board.first(Card, {pip: 2})!;
      card.suit = 'D';
      expect(card.suit).equals('D');
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 2 },
            { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'D', pip: 2, _id: 3 },
            { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 4 }
          ]},
        ]
      );
    });

    it('takes from pile', () => {
      board.create(Card, 'AH', { suit: 'H', pip: 1 });
      board.create(Card, '2H', { suit: 'H', pip: 2 });
      const pile = board._ctx.removed;
      pile.create(Card, '3H', { suit: 'H', pip: 3 });

      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 2 },
            { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 3 },
          ]},
          { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 4 }
        ]
      );

      expect(board.all(Card).length).to.equal(2);
      expect(pile.all(Card).length).to.equal(1);
    });

    it('moves', () => {
      const deck = board.create(Space, 'deck');
      const discard = board.create(Space, 'discard');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
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
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
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
      const deck = board.create(Space, 'deck');
      const discard = board.create(Space, 'discard');
      deck.setOrder('stacking');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
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
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
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
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
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
      const deck = board.create(Space, 'deck');
      const discard = board.create(Space, 'discard');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
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
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
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
      const deck = board.create(Space, 'deck');
      const discard = board.create(Space, 'discard');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });
      deck.create(Card, '3H', { suit: 'H', pip: 3 });
      const json = board.allJSON();
      board._ctx.trackMovement = true;
      board.fromJSON(json);

      deck.lastN(2, Card).putInto(discard);
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
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
      const players1Mat = board.create(Space, 'mat', {player: players[0]});
      board.create(Space, 'mat', {player: players[1]});

      players1Mat.create(Card, 'player-1-card', { suit: 'H', pip: 1, player: players[0] });
      players1Mat.create(Card, 'player-2-card', { suit: 'H', pip: 1, player: players[1] });
      players1Mat.create(Card, 'neutral-card', { suit: 'H', pip: 2 });

      //expect(board.all(Card, { mine: true })).to.throw();
      board._ctx.player = players[0];
      expect(board.all(Card, { mine: true }).length).to.equal(2);
      expect(board.all(Card, { mine: false }).length).to.equal(1);
      expect(board.last(Card, { mine: true })!.name).to.equal('neutral-card');
      board._ctx.player = players[1];
      expect(board.all(Card, { mine: true }).length).to.equal(1);
      expect(board.all(Card, { mine: false }).length).to.equal(2);
    });

    it("sorts", () => {
      const deck = board.create(Space, 'deck');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2C', { suit: 'C', pip: 2 });
      deck.create(Card, '3D', { suit: 'D', pip: 3 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });

      expect(board.all(Card).withHighest('pip')!.name).to.equal('3D');
      expect(board.all(Card).withHighest('suit')!.name).to.equal('AH');
      expect(board.all(Card).withHighest('suit', 'pip')!.name).to.equal('2H');
      expect(board.all(Card).withHighest(c => c.suit === 'D' ? 100 : 1)!.name).to.equal('3D');
      expect(board.all(Card).min('pip')).to.equal(1);
      expect(board.all(Card).max('pip')).to.equal(3);
      expect(board.all(Card).min('suit')).to.equal('C');
      expect(board.all(Card).max('suit')).to.equal('H');
    });

    it("isVisibleTo", () => {
      const card = board.create(Card, 'AH', { suit: 'H', pip: 1 });
      card.hideFromAll();
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
      Card.hide('suit');
      const card = board.create(Card, 'AH', { suit: 'H', pip: 1 });
      const card2 = card.hidden();
      expect(card2 instanceof Card).to.equal(true);
      expect(card2.pip).to.equal(1);
      expect(card2.suit).to.equal(undefined);
      card.showOnlyTo(1);
      expect(card.toJSON(1)).to.deep.equal(
        { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _visible: { default: false, except: [1] } },
      );
      expect(card.toJSON(2)).to.deep.equal(
        { className: 'Card', flipped: false, state: 'initial', name: 'AH', pip: 1, _visible: { default: false, except: [1] } },
      )
      board.fromJSON(JSON.parse(JSON.stringify(board.allJSON(2))));
      const card3 = board.first(Card)!;
      expect(card3.pip).to.equal(1);
      expect(card3.suit).to.equal(undefined);
    });

    it("listens to add events", () => {
      const eventSpy = chai.spy();
      board.onEnter(Card, eventSpy);
      board.create(Card, "AH", {suit: "H", pip: 1});
      expect(eventSpy).to.have.been.called()
    });

    it("listens to add events from moves", () => {
      const eventSpy = chai.spy();
      const deck = board.create(Space, 'deck');
      board.create(Space, 'discard');
      deck.onEnter(Card, eventSpy);
      const card = board.create(Card, "AH", {suit: "H", pip: 1});
      card.putInto(deck);
      expect(eventSpy).to.have.been.called()
    });

    it("preserves events in JSON", () => {
      const eventSpy = chai.spy();
      board.onEnter(Card, eventSpy);
      board.fromJSON(JSON.parse(JSON.stringify(board.allJSON())));
      board.create(Card, "AH", {suit: "H", pip: 1});
      expect(eventSpy).to.have.been.called()
    });
  });

  describe("graph", () => {
    it("adjacency", () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      a.connectTo(b);
      expect(a.adjacentTo(b)).to.equal(true);
      expect(a.adjacentTo(c)).to.equal(false);
      expect(a.others({ adjacent: true }).includes(b)).to.equal(true);
      expect(a.others({ adjacent: true }).includes(c)).to.not.equal(true);
    })

    it("calculates distance", () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      expect(a.distanceTo(c)).to.equal(5);
    })

    it("calculates closest", () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      expect(a.closest()).to.equal(b);
    })

    it("finds adjacencies", () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
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
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      a.connectTo(b, 2);
      b.connectTo(c, 3);
      a.connectTo(c, 6);
      c.connectTo(d, 1);
      expect(a.withinDistance(5).all(Space)).to.deep.equal([b,c]);
      expect(a.others({ withinDistance: 5}).length).to.equal(2);
    })
  });

  describe('grids', () => {
    class Cell extends Space<Player> {
      x: number;
      y: number;
    }

    it('creates squares', () => {
      board = new Board({ classRegistry: [Space, Piece, GameElement, Cell] });
      board.createGrid({ rows: 3, columns: 3 }, Cell, 'cell', (x, y) => ({x, y}));
      expect(board.all(Cell).length).to.equal(9);
      expect(board.first(Cell)!.x).to.equal(1);
      expect(board.first(Cell)!.y).to.equal(1);
      expect(board.last(Cell)!.x).to.equal(3);
      expect(board.last(Cell)!.y).to.equal(3);

      const corner = board.first(Cell, {x:1, y:1})!;
      expect(corner.adjacencies(Cell).map(e => [e.x, e.y])).to.deep.equal([[1,2], [2,1]]);

      const middle = board.first(Cell, {x:2, y:2})!;
      expect(middle.adjacencies(Cell).map(e => [e.x, e.y])).to.deep.equal([[1,2], [2,1], [2,3], [3,2]]);
    });

    it('creates hexes', () => {
      board = new Board({ classRegistry: [Space, Piece, GameElement, Cell] });
      board.createGrid({ rows: 3, columns: 3, style: 'hex' }, Cell, 'cell', (x, y) => ({x, y}));
      expect(board.all(Cell).length).to.equal(9);
      expect(board.first(Cell)!.x).to.equal(1);
      expect(board.first(Cell)!.y).to.equal(1);
      expect(board.last(Cell)!.x).to.equal(3);
      expect(board.last(Cell)!.y).to.equal(3);

      const corner = board.first(Cell, {x:1, y:1})!;
      expect(corner.adjacencies(Cell).map(e => [e.x, e.y])).to.deep.equal([[1,2], [2,1], [2,2]]);

      const middle = board.first(Cell, {x:2, y:2})!;
      expect(middle.adjacencies(Cell).map(e => [e.x, e.y])).to.deep.equal([[1,1], [1,2], [2,1], [2,3], [3,2], [3,3]]);
    });

    it('creates inverse hexes', () => {
      board = new Board({ classRegistry: [Space, Piece, GameElement, Cell] });
      board.createGrid({ rows: 3, columns: 3, style: 'hex-inverse' }, Cell, 'cell', (x, y) => ({x, y}));
      expect(board.all(Cell).length).to.equal(9);
      expect(board.first(Cell)!.x).to.equal(1);
      expect(board.first(Cell)!.y).to.equal(1);
      expect(board.last(Cell)!.x).to.equal(3);
      expect(board.last(Cell)!.y).to.equal(3);

      const corner = board.first(Cell, {x:1, y:1})!;
      expect(corner.adjacencies(Cell).map(e => [e.x, e.y])).to.deep.equal([[1,2], [2,1]]);

      const middle = board.first(Cell, {x:2, y:2})!;
      expect(middle.adjacencies(Cell).map(e => [e.x, e.y])).to.deep.equal([[1,2], [1,3], [2,1], [2,3], [3,1], [3,2]]);
    });
  });

  describe('layouts', () => {
    beforeEach(() => {
      board = new Board({ classRegistry: [Space, Piece, GameElement] });
      board.layout(GameElement, {
        margin: 0,
        gap: 0,
      });
      board._ui.layoutsSet = true;
    })
    it('applies', () => {
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      board.applyLayouts();
      expect(board._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 100, height: 100 })
      expect(a._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
    });

    it('applies overlaps', () => {
      board.layout(Piece, {
        rows: 3,
        columns: 3,
        direction: 'ltr'
      });
      const s1 = board.create(Space, 's1');
      const s2 = board.create(Space, 's2');
      const s3 = board.create(Space, 's3');
      const s4 = board.create(Space, 's4');
      const p1 = board.create(Piece, 'p1');
      const p2 = board.create(Piece, 'p2');
      const p3 = board.create(Piece, 'p3');
      const p4 = board.create(Piece, 'p4');
      board.applyLayouts();

      expect(p1._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(p2._ui.computedStyle).to.deep.equal({ left: 100 / 3, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(p3._ui.computedStyle).to.deep.equal({ left: 200 / 3, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(p4._ui.computedStyle).to.deep.equal({ left: 0, top: 100 / 3, width: 100 / 3, height: 100 / 3 })
    });

    it('adds gaps and margins', () => {
      board.layout(GameElement, {
        gap: 10,
        margin: 5
      });
      const a = board.create(Space, 'a');
      const b = board.create(Space, 'b');
      const c = board.create(Space, 'c');
      const d = board.create(Space, 'd');
      board.applyLayouts();
      expect(a._ui.computedStyle).to.deep.equal({ left: 5, top: 5, width: 40, height: 40 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 55, top: 5, width: 40, height: 40 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 5, top: 55, width: 40, height: 40 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 55, top: 55, width: 40, height: 40 })
    });

    it('adds gaps and margins absolutely to relative sizes', () => {
      const outer = board.createMany(4, Space, 'outer');
      outer[3].layout(GameElement, {
        gap: 4,
        margin: 2
      });
      const a = outer[3].create(Space, 'a');
      const b = outer[3].create(Space, 'b');
      const c = outer[3].create(Space, 'c');
      const d = outer[3].create(Space, 'd');
      board.applyLayouts();
      expect(a._ui.computedStyle).to.deep.equal({ left: 4, top: 4, width: 42, height: 42 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 54, top: 4, width: 42, height: 42 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 4, top: 54, width: 42, height: 42 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 54, top: 54, width: 42, height: 42 })
    });

    it('areas are relative to parent', () => {
      const outer = board.createMany(3, Space, 'outer');
      outer[2].layout(GameElement, {
        gap: 4,
        area: {
          left: 10,
          top: 20,
          width: 80,
          height: 60,
        }
      });
      const a = outer[2].create(Space, 'a');
      const b = outer[2].create(Space, 'b');
      const c = outer[2].create(Space, 'c');
      const d = outer[2].create(Space, 'd');
      board.applyLayouts();
      expect(a._ui.computedStyle).to.deep.equal({ left: 10, top: 20, width: 36, height: 26 })
      expect(b._ui.computedStyle).to.deep.equal({ left: 54, top: 20, width: 36, height: 26 })
      expect(c._ui.computedStyle).to.deep.equal({ left: 10, top: 54, width: 36, height: 26 })
      expect(d._ui.computedStyle).to.deep.equal({ left: 54, top: 54, width: 36, height: 26 })
    });

    it('aligns', () => {
      board.layout(GameElement, {
        size: { width: 20, height: 25 },
        scaling: 'fit',
        alignment: 'right',
      });
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts();

      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 60, top: 0, width: 40, height: 50 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 20, top: 0, width: 40, height: 50 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 60, top: 50, width: 40, height: 50 })
    });

    it('aligns vertical', () => {
      board.layout(GameElement, {
        size: { width: 25, height: 20 },
        scaling: 'fit',
        alignment: 'bottom right',
      });
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts();

      // console.log('<div style="width: 200; height: 200; position: relative; outline: 1px solid black">');
      // for (const c of board._t.children) console.log(`<div style="position: absolute; left: ${c._ui.computedStyle?.left}%; top: ${c._ui.computedStyle?.top}%; width: ${c._ui.computedStyle?.width}%; height: ${c._ui.computedStyle?.height}%; background: red; outline: 1px solid blue"></div>`);
      // console.log('</div>');
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 50, top: 60, width: 50, height: 40 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 0, top: 60, width: 50, height: 40 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 50, top: 20, width: 50, height: 40 })
    });

    it('sizes to fit', () => {
      board.layout(GameElement, {
        size: { width: 20, height: 25 },
        scaling: 'fit'
      });
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts();
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 10, top: 0, width: 40, height: 50 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 40, height: 50 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 10, top: 50, width: 40, height: 50 })
    });

    it('sizes to fill', () => {
      board.layout(GameElement, {
        size: { width: 20, height: 25 },
        scaling: 'fill'
      });
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts();
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 50, height: 62.5 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 0, width: 50, height: 62.5 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 0, top: 37.5, width: 50, height: 62.5 })
    });

    it('retains sizes', () => {
      board.layout(GameElement, {
        size: { width: 20, height: 25 },
        scaling: 'none'
      });
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts();
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 30, top: 25, width: 20, height: 25 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 25, width: 20, height: 25 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 30, top: 50, width: 20, height: 25 })
    });

    it('fits based on aspect ratios', () => {
      board.layout(GameElement, {
        aspectRatio: 5 / 4,
        scaling: 'fit'
      });
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts();
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 0, top: 10, width: 50, height: 40 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 50, top: 10, width: 50, height: 40 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 50, height: 40 })
    });

    it('fills based on aspect ratios', () => {
      board.layout(GameElement, {
        aspectRatio: 5 / 4,
        scaling: 'fill'
      });
      const spaces = board.createMany(3, Space, 'space');
      board.applyLayouts();
      expect(spaces[0]._ui.computedStyle).to.deep.equal({ left: 0, top: 0, width: 62.5, height: 50 })
      expect(spaces[1]._ui.computedStyle).to.deep.equal({ left: 37.5, top: 0, width: 62.5, height: 50 })
      expect(spaces[2]._ui.computedStyle).to.deep.equal({ left: 0, top: 50, width: 62.5, height: 50 })
    });

    it('accommodate min row', () => {
      board.layout(GameElement, {
        rows: { min: 2 },
        columns: 1,
        aspectRatio: 5 / 4,
        scaling: 'fill'
      });
      const spaces = board.createMany(10, Space, 'space');
      board.applyLayouts();
      expect(spaces[0]._ui.computedStyle?.width).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.height).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.top).to.be.approximately(0, 0.0001);
    });

    it('accommodate min col', () => {
      board.layout(GameElement, {
        columns: { min: 2 },
        rows: 1,
        aspectRatio: 4 / 5,
        scaling: 'fill'
      });
      const spaces = board.createMany(10, Space, 'space');
      board.applyLayouts();
      expect(spaces[0]._ui.computedStyle?.height).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.width).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.left).to.be.approximately(0, 0.0001);
    });

    it('accommodate min row with size', () => {
      board.layout(GameElement, {
        rows: { min: 2 },
        columns: 1,
        size: { width: 5, height: 4 },
        scaling: 'fill'
      });
      const spaces = board.createMany(10, Space, 'space');
      board.applyLayouts();
      expect(spaces[0]._ui.computedStyle?.width).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.height).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.top).to.be.approximately(0, 0.0001);
    });

    it('accommodate min columns with size', () => {
      board.layout(GameElement, {
        columns: { min: 2 },
        rows: 1,
        size: { width: 4, height: 5 },
        scaling: 'fill'
      });
      const spaces = board.createMany(10, Space, 'space');
      board.applyLayouts();
      expect(spaces[0]._ui.computedStyle?.height).to.equal(62.5);
      expect(spaces[0]._ui.computedStyle?.width).to.equal(50);
      expect(spaces[0]._ui.computedStyle?.left).to.be.approximately(0, 0.0001);
    });

    it('isomorphic', () => {
      board.layout(GameElement, {
        aspectRatio: 4 / 5,
        offsetColumn: {x: 100, y: 100},
        scaling: 'fit',
      });
      const spaces = board.createMany(9, Space, 'space');
      board.applyLayouts();

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
      board.layout(GameElement, {
        aspectRatio: 4 / 5,
        offsetColumn: {x: -5, y: -5},
        scaling: 'fit',
        direction: 'ltr'
      });
      const spaces = board.createMany(9, Space, 'space');
      board.applyLayouts();
    });

    it('nested aspect ratios', () => {
      board.layout(GameElement, {
        aspectRatio: 4 / 5,
      });
      const space = board.create(Space, 'space');
      space.layout(GameElement, {
        aspectRatio: 1,
      });
      const inner = space.create(Space, 'inner');
      board.applyLayouts();
      if (!inner._ui.computedStyle) throw Error();
      expect(inner._ui.computedStyle.height * 5).to.equal(inner._ui.computedStyle.width * 4);
    });

    it('specificity', () => {
      class Country extends Space<Player> { }
      const spaces = board.createMany(4, Space, 'space');
      const space = board.create(Space, 'special');

      board = new Board({ classRegistry: [Space, Piece, GameElement, Country] });
      board.layout(spaces[2], { direction: 'btt-rtl' });
      board.layout('special', { direction: 'ttb-rtl' });
      board.layout(spaces.slice(0, 2), { direction: 'ttb' });
      board.layout(Country, { direction: 'rtl' });
      board.layout(Space, { direction: 'btt' });
      board.layout(GameElement, { direction: 'ltr-btt' });

      expect(board._ui.layouts.map(l => l.attributes?.direction)).to.deep.equal([
        'square',
        'ltr-btt',
        'btt',
        'rtl',
        'ttb',
        'ttb-rtl',
        'btt-rtl'
      ])
    });
  });
});

      // console.log('<div style="width: 200; height: 200; position: relative; outline: 1px solid black">');
      // for (const c of board._t.children) console.log(`<div style="position: absolute; left: ${c._ui.computedStyle?.left}%; top: ${c._ui.computedStyle?.top}%; width: ${c._ui.computedStyle?.width}%; height: ${c._ui.computedStyle?.height}%; background: red; outline: 1px solid blue"></div>`);
      // console.log('</div>');
