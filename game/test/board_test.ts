/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */
import chai from 'chai';
import spies from 'chai-spies';

import {
  Board,
  Space,
  Piece,
  GameElement,
  Player,
  PlayerCollection,
} from '../';

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
  });
  players.addPlayer({
    name: 'Jane',
    position: 2,
    color: 'green',
  });

  beforeEach(() => {
    board = new Board(Space, Piece, GameElement);
    // @ts-ignore
    board.game = { players, board };
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

    board._ctx.classRegistry.push(Country);
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

      deck.lastN(2, Card).putInto(discard);
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 },
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
            ]}
          ]},
        ]
      );

      discard.first(Card)!.putInto(deck, {fromBottom: 0});
      expect(board.allJSON()).to.deep.equals(
        [
          { className: 'Board', _id: 0, children: [
            { className: 'Space', name: 'deck', _id: 2, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '2H', suit: 'H', pip: 2, _id: 5 },
              { className: 'Card', flipped: false, state: 'initial', name: 'AH', suit: 'H', pip: 1, _id: 4 },
            ]},
            { className: 'Space', name: 'discard', _id: 3, children: [
              { className: 'Card', flipped: false, state: 'initial', name: '3H', suit: 'H', pip: 3, _id: 6 }
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
      expect(board.last(Card, { mine: true })!.name).to.equal('neutral-card');
      board._ctx.player = players[1];
      expect(board.all(Card, { mine: true }).length).to.equal(1);
    });

    it("sorts", () => {
      const deck = board.create(Space, 'deck');
      deck.create(Card, 'AH', { suit: 'H', pip: 1 });
      deck.create(Card, '2C', { suit: 'C', pip: 2 });
      deck.create(Card, '3D', { suit: 'D', pip: 3 });
      deck.create(Card, '2H', { suit: 'H', pip: 2 });

      expect(board.all(Card).withHighest('pip').name).to.equal('3D');
      expect(board.all(Card).withHighest('suit').name).to.equal('AH');
      expect(board.all(Card).withHighest('suit', 'pip').name).to.equal('2H');
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
  })
});
