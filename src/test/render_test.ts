import chai from 'chai';
import spies from 'chai-spies';

import {
  Game,
  Space,
  Piece,
  GameElement,
} from '../board/index.js';

import {
  applyLayouts,
  applyDiff
} from '../ui/render.js';

import type { BaseGame } from '../board/game.js';

chai.use(spies);
const { expect } = chai;

describe('Render', () => {
  let game: BaseGame;

  describe('layouts', () => {
    beforeEach(() => {
      game = new Game({});
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
      const ui = applyLayouts(game);

      expect(ui.game.relPos).to.deep.equal({ left: 0, top: 0, width: 100, height: 100 })
      expect(ui.all[a._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
    });

    it('applies overlaps', () => {
      game.create(Space, 's1');
      game.create(Space, 's2');
      game.create(Space, 's3');
      game.create(Space, 's4');
      const p1 = game.create(Piece, 'p1');
      const p2 = game.create(Piece, 'p2');
      const p3 = game.create(Piece, 'p3');
      const p4 = game.create(Piece, 'p4');
      const ui = applyLayouts(game, () => {
        game.layout(Piece, {
          rows: 3,
          columns: 3,
          direction: 'ltr'
        });
      });

      expect(ui.all[p1._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(ui.all[p2._t.ref].relPos).to.deep.equal({ left: 100 / 3, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(ui.all[p3._t.ref].relPos).to.deep.equal({ left: 200 / 3, top: 0, width: 100 / 3, height: 100 / 3 })
      expect(ui.all[p4._t.ref].relPos).to.deep.equal({ left: 0, top: 100 / 3, width: 100 / 3, height: 100 / 3 })
    });

    it('adds gaps and margins', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          gap: 10,
          margin: 5
        });
      });
      expect(ui.all[a._t.ref].relPos).to.deep.equal({ left: 5, top: 5, width: 40, height: 40 })
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 55, top: 5, width: 40, height: 40 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 5, top: 55, width: 40, height: 40 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 55, top: 55, width: 40, height: 40 })
    });

    it('adds gaps and margins absolutely to relative sizes', () => {
      const outer = game.createMany(4, Space, 'outer');
      const a = outer[3].create(Space, 'a');
      const b = outer[3].create(Space, 'b');
      const c = outer[3].create(Space, 'c');
      const d = outer[3].create(Space, 'd');
      const ui = applyLayouts(game, () => {
        outer[3].layout(GameElement, {
          gap: 4,
          margin: 2
        });
      });
      expect(ui.all[a._t.ref].relPos).to.deep.equal({ left: 4, top: 4, width: 42, height: 42 })
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 54, top: 4, width: 42, height: 42 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 4, top: 54, width: 42, height: 42 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 54, top: 54, width: 42, height: 42 })
    });

    it('areas are relative to parent', () => {
      const outer = game.createMany(3, Space, 'outer');
      const a = outer[2].create(Space, 'a');
      const b = outer[2].create(Space, 'b');
      const c = outer[2].create(Space, 'c');
      const d = outer[2].create(Space, 'd');
      const ui = applyLayouts(game, () => {
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
      expect(ui.all[a._t.ref].relPos).to.deep.equal({ left: 10, top: 20, width: 36, height: 26 })
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 54, top: 20, width: 36, height: 26 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 10, top: 54, width: 36, height: 26 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 54, top: 54, width: 36, height: 26 })
    });

    it('aligns', () => {
      const spaces = game.createMany(3, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          scaling: 'fit',
          alignment: 'right',
        });
      });

      expect(ui.all[spaces[0]._t.ref].relPos).to.deep.equal({ left: 60, top: 0, width: 40, height: 50 })
      expect(ui.all[spaces[1]._t.ref].relPos).to.deep.equal({ left: 20, top: 0, width: 40, height: 50 })
      expect(ui.all[spaces[2]._t.ref].relPos).to.deep.equal({ left: 60, top: 50, width: 40, height: 50 })
    });

    it('aligns vertical', () => {
      const spaces = game.createMany(3, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          aspectRatio: 5 / 4,
          scaling: 'fit',
          alignment: 'bottom right',
        });
      });

      expect(ui.all[spaces[0]._t.ref].relPos).to.deep.equal({ left: 50, top: 60, width: 50, height: 40 })
      expect(ui.all[spaces[1]._t.ref].relPos).to.deep.equal({ left: 0, top: 60, width: 50, height: 40 })
      expect(ui.all[spaces[2]._t.ref].relPos).to.deep.equal({ left: 50, top: 20, width: 50, height: 40 })
    });

    it('sizes to fit', () => {
      const spaces = game.createMany(3, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          scaling: 'fit'
        });
      });
      expect(ui.all[spaces[0]._t.ref].relPos).to.deep.equal({ left: 10, top: 0, width: 40, height: 50 })
      expect(ui.all[spaces[1]._t.ref].relPos).to.deep.equal({ left: 50, top: 0, width: 40, height: 50 })
      expect(ui.all[spaces[2]._t.ref].relPos).to.deep.equal({ left: 10, top: 50, width: 40, height: 50 })
    });

    it('sizes to fill', () => {
      const spaces = game.createMany(3, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          scaling: 'fill'
        });
      });
      expect(ui.all[spaces[0]._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 50, height: 62.5 })
      expect(ui.all[spaces[1]._t.ref].relPos).to.deep.equal({ left: 50, top: 0, width: 50, height: 62.5 })
      expect(ui.all[spaces[2]._t.ref].relPos).to.deep.equal({ left: 0, top: 37.5, width: 50, height: 62.5 })
    });

    it('retains sizes', () => {
      const spaces = game.createMany(3, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          size: { width: 20, height: 25 },
        });
      });
      expect(ui.all[spaces[0]._t.ref].relPos).to.deep.equal({ left: 30, top: 25, width: 20, height: 25 })
      expect(ui.all[spaces[1]._t.ref].relPos).to.deep.equal({ left: 50, top: 25, width: 20, height: 25 })
      expect(ui.all[spaces[2]._t.ref].relPos).to.deep.equal({ left: 30, top: 50, width: 20, height: 25 })
    });

    it('fits based on aspect ratios', () => {
      const spaces = game.createMany(3, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          aspectRatio: 5 / 4,
          scaling: 'fit'
        });
      });
      expect(ui.all[spaces[0]._t.ref].relPos).to.deep.equal({ left: 0, top: 10, width: 50, height: 40 })
      expect(ui.all[spaces[1]._t.ref].relPos).to.deep.equal({ left: 50, top: 10, width: 50, height: 40 })
      expect(ui.all[spaces[2]._t.ref].relPos).to.deep.equal({ left: 0, top: 50, width: 50, height: 40 })
    });

    it('fills based on aspect ratios', () => {
      const spaces = game.createMany(3, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          aspectRatio: 5 / 4,
          scaling: 'fill'
        });
      });
      expect(ui.all[spaces[0]._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 62.5, height: 50 })
      expect(ui.all[spaces[1]._t.ref].relPos).to.deep.equal({ left: 37.5, top: 0, width: 62.5, height: 50 })
      expect(ui.all[spaces[2]._t.ref].relPos).to.deep.equal({ left: 0, top: 50, width: 62.5, height: 50 })
    });

    it('accommodate min row', () => {
      const spaces = game.createMany(10, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          rows: { min: 2 },
          columns: 1,
          aspectRatio: 5 / 4,
          scaling: 'fill'
        });
      });
      expect(ui.all[spaces[0]._t.ref].relPos?.width).to.equal(62.5);
      expect(ui.all[spaces[0]._t.ref].relPos?.height).to.equal(50);
      expect(ui.all[spaces[0]._t.ref].relPos?.top).to.be.approximately(0, 0.0001);
    });

    it('accommodate min col', () => {
      const spaces = game.createMany(10, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          columns: { min: 2 },
          rows: 1,
          aspectRatio: 4 / 5,
          scaling: 'fill'
        });
      });
      expect(ui.all[spaces[0]._t.ref].relPos?.height).to.equal(62.5);
      expect(ui.all[spaces[0]._t.ref].relPos?.width).to.equal(50);
      expect(ui.all[spaces[0]._t.ref].relPos?.left).to.be.approximately(0, 0.0001);
    });

    it('size overrides scaling', () => {
      const spaces = game.createMany(10, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          rows: { min: 2 },
          columns: 1,
          size: { width: 5, height: 4 },
          scaling: 'fill'
        });
      });
      expect(ui.all[spaces[0]._t.ref].relPos?.width).to.equal(5);
      expect(ui.all[spaces[0]._t.ref].relPos?.height).to.equal(4);
      expect(ui.all[spaces[0]._t.ref].relPos?.top).to.equal(30);
    });

    it('isomorphic', () => {
      const spaces = game.createMany(9, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          offsetColumn: {x: 100, y: 100},
          scaling: 'fit',
        });
      });

      expect(ui.all[spaces[0]._t.ref].relPos).to.deep.equal({ width: 16, height: 20, left: 42, top: 0 });
      expect(ui.all[spaces[1]._t.ref].relPos).to.deep.equal({ width: 16, height: 20, left: 58, top: 20 });
      expect(ui.all[spaces[2]._t.ref].relPos).to.deep.equal({ width: 16, height: 20, left: 74, top: 40 });
      expect(ui.all[spaces[3]._t.ref].relPos).to.deep.equal({ width: 16, height: 20, left: 26, top: 20 });
      expect(ui.all[spaces[4]._t.ref].relPos).to.deep.equal({ width: 16, height: 20, left: 42, top: 40 });
      expect(ui.all[spaces[5]._t.ref].relPos).to.deep.equal({ width: 16, height: 20, left: 58, top: 60 });
      expect(ui.all[spaces[6]._t.ref].relPos).to.deep.equal({ width: 16, height: 20, left: 10, top: 40 });
      expect(ui.all[spaces[7]._t.ref].relPos).to.deep.equal({ width: 16, height: 20, left: 26, top: 60 });
      expect(ui.all[spaces[8]._t.ref].relPos).to.deep.equal({ width: 16, height: 20, left: 42, top: 80 });
    });

    it('stacks', () => {
      const spaces = game.createMany(9, Space, 'space');
      const ui = applyLayouts(game, () => {
        game.layout(GameElement, {
          aspectRatio: 4 / 5,
          offsetColumn: {x: -5, y: -5},
          scaling: 'fit',
          direction: 'ltr'
        });
      });

      expect(ui.all[spaces[8]!._t.ref].relPos!.top).to.equal(0);
      expect(ui.all[spaces[0]!._t.ref].relPos!.top + ui.all[spaces[0]!._t.ref].relPos!.height).to.equal(100);
    });

    it('align+scale', () => {
      const pieces = game.createMany(6, Piece, 'piece');

      const ui = applyLayouts(game, () => {
        game.layout(Piece, {
          offsetColumn: {x: 10, y: 10},
          scaling: 'fit',
        });
      });

      expect(ui.all[pieces[0]!._t.ref].relPos!.top).to.equal(0);
      expect(ui.all[pieces[5]!._t.ref].relPos!.top + ui.all[pieces[5]!._t.ref].relPos!.height).to.equal(100);
      expect(ui.all[pieces[3]!._t.ref].relPos!.left).to.equal(0);
      expect(ui.all[pieces[2]!._t.ref].relPos!.left + ui.all[pieces[2]!._t.ref].relPos!.width).to.equal(100);
    });

    it('specificity', () => {
      class Country extends Space<Game> { }
      game = new Game({});

      const spaces = game.createMany(4, Space, 'space');
      const space = game.create(Space, 'special');
      const france = game.create(Country, 'france');
      const special = game.create(Country, 'special');
      const el = game.create(GameElement, 'whatev');

      const ui = applyLayouts(game, () => {
        game.layout(spaces[2], { direction: 'btt-rtl', showBoundingBox: '1' });
        game.layout('special', { direction: 'ttb-rtl', showBoundingBox: '2' });
        game.layout(spaces.slice(0, 2), { direction: 'ttb', showBoundingBox: '3' });
        game.layout(Country, { direction: 'rtl', showBoundingBox: '4' });
        game.layout(Space, { direction: 'btt', showBoundingBox: '5' });
        game.layout(GameElement, { direction: 'ltr-btt', showBoundingBox: '6' });
      });

      expect(ui.game.layouts[6].children.some(r => r.element === el)).to.be.true; // by GameElement
      expect(ui.game.layouts[5].children.some(r => r.element === spaces[3])).to.be.true; // by Space
      expect(ui.game.layouts[4].children.some(r => r.element === france)).to.be.true; // by more specific class
      expect(ui.game.layouts[3].children.some(r => r.element === spaces[0])).to.be.true; // by single ref
      expect(ui.game.layouts[2].children.some(r => r.element === space)).to.be.true; // by name
      expect(ui.game.layouts[2].children.some(r => r.element === special)).to.be.true; // by name
      expect(ui.game.layouts[1].children.some(r => r.element === spaces[2])).to.be.true; // by array ref
    });

    it('can place', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.row = 2;
      a.column = 2;
      const ui = applyLayouts(game);

      expect(ui.all[a._t.ref].relPos).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
    });

    it('can shift bounds', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.row = 4;
      a.column = 4;
      const ui = applyLayouts(game);

      expect(ui.all[a._t.ref].relPos).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
    });

    it('can shift negative', () => {
      const a = game.create(Space, 'a');
      const b = game.create(Space, 'b');
      const c = game.create(Space, 'c');
      const d = game.create(Space, 'd');
      a.row = -4;
      a.column = -4;
      const ui = applyLayouts(game);

      expect(ui.all[a._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 50, height: 50 })
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
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
      const ui = applyLayouts(game);

      expect(ui.all[a._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 100, height: 25 })
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 0, top: 25, width: 100, height: 25 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 0, top: 50, width: 100, height: 25 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 0, top: 75, width: 100, height: 25 })
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
      const ui = applyLayouts(game);

      expect(ui.all[a._t.ref].relPos).to.deep.equal({ left: 0, top: 75, width: 25, height: 25 })
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 0, top: 0, width: 25, height: 25 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 25, top: 0, width: 25, height: 25 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 75, top: 0, width: 25, height: 25 })
    });

    it('can place sticky', () => {
      const a = game.create(Piece, 'a');
      const b = game.create(Piece, 'b');
      const c = game.create(Piece, 'c');
      const d = game.create(Piece, 'd');
      applyLayouts(game, () => {
        game.layout(Piece, { sticky: true });
      });
      a.remove();
      game.resetUI();
      const ui = applyLayouts(game, () => {
        game.layout(Piece, { sticky: true });
      });

      expect(b.column).to.equal(2);
      expect(ui.all[b._t.ref].relPos).to.deep.equal({ left: 50, top: 0, width: 50, height: 50 })
      expect(ui.all[c._t.ref].relPos).to.deep.equal({ left: 0, top: 50, width: 50, height: 50 })
      expect(ui.all[d._t.ref].relPos).to.deep.equal({ left: 50, top: 50, width: 50, height: 50 })
    });
  });

  describe('applyDiff', () => {
    let client: BaseGame;
    let server: BaseGame;

    beforeEach(() => {
      client = new Game({ classRegistry: [Space, Piece] });
      server = new Game({ classRegistry: [Space, Piece] });
      server._ctx.trackMovement = true;
    });

    it("combines local and server", () => {
      const a = server.create(Space, 'a');
      const b = server.create(Space, 'b');
      a.create(Piece, 'p1');
      a.create(Piece, 'p2');

      client.fromJSON(server.allJSON(1));
      const p1c = client.first(Piece, 'p1')!;
      const p2c = client.first(Piece, 'p2')!;
      // client move
      p1c.putInto(client.first('b')!);

      const ui1 = applyLayouts(client);

      const p1s = server.first(Piece, 'p1')!;
      // server same move
      p1s.putInto(b);

      client.fromJSON(server.allJSON(1));
      const p1c2 = client.first(Piece, 'p1')!;
      const p2c2 = client.first(Piece, 'p2')!;

      const ui2 = applyLayouts(client);
      applyDiff(ui2.game, ui2, ui1);

      // pieces are retained
      expect(p1c).to.equal(p1c2);
      expect(p2c).to.equal(p2c2);
      // keys are retained
      expect(ui2.all[p1c2._t.ref].key).to.equal(ui1.all[p1c._t.ref].key);
      expect(ui2.all[p2c2._t.ref].key).to.equal(ui1.all[p2c._t.ref].key);
      // no transform since same move
      expect(ui2.all[p1c2._t.ref].styles?.transform).to.be.undefined
      expect(ui2.all[p2c2._t.ref].styles?.transform).to.be.undefined
    });

    it("combines local and server conflicts", () => {
      const a = server.create(Space, 'a');
      server.create(Space, 'b');
      const c = server.create(Space, 'c');
      a.create(Piece, 'p1');
      a.create(Piece, 'p2');

      client.fromJSON(server.allJSON(1));
      const p1c = client.first(Piece, 'p1')!;
      const p2c = client.first(Piece, 'p2')!;
      // client move
      p1c.putInto(client.first('b')!);

      const ui1 = applyLayouts(client);

      const p1s = server.first(Piece, 'p1')!;
      // server different move
      p1s.putInto(c);

      client.fromJSON(server.allJSON(1));
      const p1c2 = client.first(Piece, 'p1')!;
      const p2c2 = client.first(Piece, 'p2')!;

      const ui2 = applyLayouts(client);
      applyDiff(ui2.game, ui2, ui1);

      // piece not retained with conflicting parent moves
      expect(p1c).to.not.equal(p1c2);
      // unmoved piece is retained
      expect(p2c).to.equal(p2c2);
      // same with keys
      expect(ui2.all[p1c2._t.ref].key).to.not.equal(ui1.all[p1c._t.ref].key);
      expect(ui2.all[p2c2._t.ref].key).to.equal(ui1.all[p2c._t.ref].key);
      // transform for moved
      expect(ui2.all[p1c2._t.ref].styles?.transform).not.to.be.undefined
      expect(ui2.all[p2c2._t.ref].styles?.transform).to.be.undefined
    });

    it("tracks reorders", () => {
      const a = server.create(Space, 'a');
      const p1s = a.create(Piece, 'p1');
      const p2s = a.create(Piece, 'p2'); // on bottom

      client.fromJSON(server.allJSON(1));
      const ui1 = applyLayouts(client);

      const p1c = client.first(Piece, 'p1')!;
      const p2c = client.first(Piece, 'p2')!;
      expect(client.first(Piece)!.name).to.equal('p1');

      // server shuffle
      expect(server.first(Piece)).to.equal(p1s);
      p1s.putInto(a, { fromBottom: 0 });
      expect(server.first(Piece)).to.equal(p2s); // now on top

      client.fromJSON(server.allJSON(1));
      const p1c2 = client.first(Piece, 'p1')!;
      const p2c2 = client.first(Piece, 'p2')!;

      const ui2 = applyLayouts(client);
      applyDiff(ui2.game, ui2, ui1);

      // tracks move
      expect(client.first(Piece)!.name).to.equal('p2');
      expect(p1c).to.equal(p1c2);
      expect(p2c).to.equal(p2c2);
      // transform for both
      expect(ui2.all[p1c2._t.ref].styles?.transform).not.to.be.undefined
      expect(ui2.all[p2c2._t.ref].styles?.transform).not.to.be.undefined
    });

    it("shows stack reorders if visible", () => {
      const a = server.create(Space, 'a');
      a.setOrder('stacking');
      const p1s = a.create(Piece, 'p1');
      const p2s = a.create(Piece, 'p2'); // on top

      client.fromJSON(server.allJSON(1));
      const ui1 = applyLayouts(client);

      const p1c = client.first(Piece, 'p1')!;
      const p2c = client.first(Piece, 'p2')!;
      expect(client.first(Piece)!.name).to.equal('p2');

      // server shuffle
      expect(server.first(Piece)).to.equal(p2s);
      p2s.putInto(a, { fromBottom: 0 });
      expect(server.first(Piece)).to.equal(p1s); // now on top

      client.fromJSON(server.allJSON(1));
      const p1c2 = client.first(Piece, 'p1')!;
      const p2c2 = client.first(Piece, 'p2')!;

      const ui2 = applyLayouts(client);
      applyDiff(ui2.game, ui2, ui1);

      // tracks move
      expect(client.first(Piece)!.name).to.equal('p1');
      expect(p1c).to.equal(p1c2);
      expect(p2c).to.equal(p2c2);
      // transform for both
      expect(ui2.all[p1c2._t.ref].styles?.transform).not.to.be.undefined
      expect(ui2.all[p2c2._t.ref].styles?.transform).not.to.be.undefined
    });

    it("hides stack reorders if hidden", () => {
      const a = server.create(Space, 'a');
      a.setOrder('stacking');
      const p1s = a.create(Piece, 'p1');
      const p2s = a.create(Piece, 'p2'); // on top
      a.all(Piece).hideFromAll();

      client.fromJSON(server.allJSON(1));
      const ui1 = applyLayouts(client);

      const p1c = client.first(Piece)!;
      const p2c = client.last(Piece)!;

      // server shuffle
      expect(server.first(Piece)).to.equal(p2s);
      p2s.putInto(a, { fromBottom: 0 });
      expect(server.first(Piece)).to.equal(p1s); // now on top

      client.fromJSON(server.allJSON(1));
      const p1c2 = client.first(Piece)!;
      const p2c2 = client.last(Piece)!;

      const ui2 = applyLayouts(client);
      applyDiff(ui2.game, ui2, ui1);

      // no move
      expect(p1c).to.equal(p1c2);
      expect(p2c).to.equal(p2c2);
      // no transform
      expect(ui2.all[p1c2._t.ref].styles?.transform).to.be.undefined
      expect(ui2.all[p2c2._t.ref].styles?.transform).to.be.undefined
    });
  });
});

      // console.log('<div style="width: 200; height: 200; position: relative; outline: 1px solid black">');
      // for (const c of game._t.children) console.log(`<div style="position: absolute; left: ${c._t.ref].relPos?.left}%; top: ${c._t.ref].relPos?.top}%; width: ${c._t.ref].relPos?.width}%; height: ${c._t.ref].relPos?.height}%; background: red; outline: 1px solid blue"></div>`);
      // console.log('</div>');
