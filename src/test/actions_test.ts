/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */
import chai from 'chai';
import spies from 'chai-spies';

import { action, Action } from '../action/index.js';
import Player from '../player/player.js';
import { Board } from '../index.js';
import Space from '../board/space.js';
import Piece from '../board/piece.js';

chai.use(spies);
const { expect } = chai;
const player = new Player();

describe('Actions', () => {
  let testAction: Action<any>;
  const actionSpy = chai.spy(({ n, m }: { n: number, m: number }) => {[n, m]});
  beforeEach(() => {
    testAction = action({
      prompt: 'add some counters',
    }).chooseNumber('n', {
      prompt: 'how many?',
      min: 0,
      max: 3,
    }).chooseNumber('m', {
      prompt: 'how many more?',
      min: ({ n }) => n * 1,
      max: ({ n }) => n * 2,
    }).do(actionSpy)
  });

  it('returns moves', () => {
    const error = testAction._process(player, {});
    expect(error).to.not.be.undefined;
    const moves = testAction._getPendingMoves({});
    expect(moves![0].selections[0].type).to.equal('number');
    expect(moves![0].selections[0].min).to.equal(0);
    expect(moves![0].selections[0].max).to.equal(3);
  });

  it('resolves dependant selections', () => {
    const error = testAction._process(player, {n: 1});
    expect(error).to.not.be.undefined;
    const moves = testAction._getPendingMoves({n: 1});
    expect(moves![0].selections[0].type).to.equal('number');
    expect(moves![0].selections[0].min).to.equal(1);
    expect(moves![0].selections[0].max).to.equal(2);
  });

  it('processes', () => {
    testAction._process(player, {n: 1, m: 2});
    expect(actionSpy).to.have.been.called.with({n: 1, m: 2});
  });

  describe('nextSelections', () => {
    it('skipIf', () => {
      const testAction = action({ prompt: 'pick an even number' })
        .chooseFrom('a', [1, 2])
        .chooseFrom('b', [3, 4], {skipIf: ({ a }) => a === 1 })
        .chooseFrom('c', [5, 6])
      expect(testAction._nextSelection({})?.choices).to.deep.equal([1,2]);
      expect(testAction._nextSelection({a: 2})?.choices).to.deep.equal([3,4]);
      expect(testAction._nextSelection({a: 1})?.choices).to.deep.equal([5,6]);
      expect(testAction._nextSelection({a: 2, b: 3})?.choices).to.deep.equal([5,6]);
      expect(testAction._nextSelection({a: 2, b: 3, c: 5})).to.be.undefined;
      expect(testAction._nextSelection({a:1, c: 5})).to.be.undefined;
    });

    it('skipIf last', () => {
      const testAction = action({ prompt: 'pick an even number' })
        .chooseFrom('a', [1, 2] )
        .chooseFrom('b', [5, 6])
        .chooseFrom('c', [3, 4], { skipIf: ({ a }) => a === 1 })
      expect(testAction._nextSelection({a: 2, b: 5})?.choices).to.deep.equal([3,4]);
      expect(testAction._nextSelection({a: 1, b: 5})).to.be.undefined;
    });
  });

  describe('getPendingMoves', () => {
    let options: number[];

    it('tests choices', () => {
      const testAction1 = action({ prompt: 'pick an even number' }).chooseFrom('n', []);
      expect(testAction1._getPendingMoves({})).to.be.undefined;

      const testAction2 = action({ prompt: 'pick an even number' }).chooseFrom('n', [1]);
      expect(testAction2._getPendingMoves({})?.length).to.equal(1);
    });

    it('tests bounds', () => {
      const testAction1 = action({ prompt: 'pick an even number' }).chooseNumber('n', { min: -1, max: 0 });
      expect(testAction1._getPendingMoves({})?.length).to.equal(1);

      const testAction2 = action({ prompt: 'pick an even number' }).chooseNumber('n', { min: 0, max: -1 });
      expect(testAction2._getPendingMoves({})).to.be.undefined;
    });

    it('resolves selection to determine viability', () => {
      const testAction1 = action({ prompt: 'pick an even number' })
        .chooseFrom('n', () => options.filter(n => n % 2 === 0))

      options = [1,2];
      expect(testAction1._getPendingMoves({})?.length).to.equal(1);
      options = [1,3,5];
      expect(testAction1._getPendingMoves({})).to.be.undefined;
    });

    it('resolves selection deeply to determine viability', () => {
      const testAction1 = action({ prompt: 'pick an even number' })
        .chooseFrom('n', () => options.filter(n => n % 2 === 0))
        .chooseNumber('m', {
          min: ({ n }) => n,
          max: 4
        });

      options = [1,8,9,10,11,4];
      expect(testAction1._getPendingMoves({})?.length).to.equal(1);
      options = [1,8,9,10,11];
      expect(testAction1._getPendingMoves({})).to.be.undefined;
    });

    it('does not fully resolve unbounded args', () => {
      const testAction1 = action({ prompt: 'pick an even number' })
        .chooseNumber('n', { min: 1 })
        .chooseNumber('m', {
          min: ({ n }) => n * 10,
          max: 4
        });

      expect(testAction1._getPendingMoves({})?.length).to.equal(1);
    });

    it('combines', () => {
      testAction = action({ prompt: 'purchase' })
        .enterText('taunt', { prompt: 'taunt' })
        .chooseGroup({
          lumber: ['number'],
          steel: ['number']
        }, {
          validate: ({ lumber, steel }) => lumber + steel < 10
        });
      const move1 = testAction._getPendingMoves({});
      if (!move1) {
        expect(move1).to.not.be.undefined;
      } else {
        expect(move1[0].selections.length).to.equal(1);
        expect(move1[0].selections[0].name).to.equal('taunt');
      }
      const move2 = testAction._getPendingMoves({taunt: 'fu'});
      if (!move2) {
        expect(move2).to.not.be.undefined;
      } else {
        expect(move2[0].selections.length).to.equal(2);
        expect(move2[0].selections[0].name).to.equal('lumber');
        expect(move2[0].selections[1].name).to.equal('steel');
        expect(move2[0].selections[1].error({ lumber: 5, steel: 5 })).to.not.be.undefined;
        expect(move2[0].selections[1].error({ lumber: 5, steel: 4 })).to.be.undefined;
      }
    });

    it('combines and skips', () => {
      testAction = action({ prompt: 'purchase' })
        .chooseGroup({
          lumber: ['number', {min: 0, max: 3}],
          steel: ['number', {min: 0, max: 0}],
          meat: ['number', {min: 0, max: 3}],
          plastic: ['number', {min: 0, max: 0}]
        }, {
          validate: ({ lumber, steel, meat, plastic }) => lumber + steel + meat + plastic > 0
        });
      const move = testAction._getPendingMoves({});
      if (!move) {
        expect(move).to.not.be.undefined;
      } else {
        expect(move[0].selections.length).to.equal(2);
        expect(move[0].selections[0].name).to.equal('lumber');
        expect(move[0].selections[1].name).to.equal('meat');
      }
      const move2 = testAction._getPendingMoves({lumber: 1, meat: 0});
      if (!move2) {
        expect(move2).to.not.be.undefined;
      } else {
        expect(move2[0].selections.length).to.equal(1);
        expect(move2[0].selections[0].name).to.equal('plastic'); // bit odd, but this is skippable
      }
      const move3 = testAction._getPendingMoves({lumber: 0, meat: 0});
      expect(move3).to.be.undefined;
    });

    it('combines forced', () => {
      testAction = action({ prompt: 'purchase' })
        .chooseNumber('lumber', {min: 0, max: 3})
        .chooseNumber('steel', {min: 0, max: 0})
        .chooseNumber('meat', {min: 0, max: 3})
        .chooseNumber('plastic', {min: 0, max: 0,
          validate: ({ lumber, steel, meat, plastic }) => lumber + steel + meat + plastic > 0
        });
      const move = testAction._getPendingMoves({});
      if (!move) {
        expect(move).to.not.be.undefined;
      } else {
        expect(move[0].selections.length).to.equal(1);
        expect(move[0].selections[0].name).to.equal('lumber');
        expect(move[0].args).to.deep.equal({steel: 0});
      }
      const move2 = testAction._getPendingMoves({lumber: 0, steel: 0});
      if (!move2) {
        expect(move2).to.not.be.undefined;
      } else {
        expect(move2[0].selections.length).to.equal(1);
        expect(move2[0].selections[0].name).to.equal('meat');
        expect(move2[0].args).to.deep.equal({lumber: 0, steel: 0, plastic: 0});
      }
    });
  });

  describe('getPendingMoves with skip strategies', () => {
    let testAction: Action<any, {r: string, n: number}>;
    beforeEach(() => {
      testAction = action({ prompt: 'p' })
        .chooseFrom('r', ['oil', 'garbage'])
        .chooseNumber('n', {
        max: ({ r }) => r === 'oil' ? 3 : 1
      });
    });

    it('shows first selection', () => {
      const moves = testAction._getPendingMoves({});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('choices');
      expect(moves![0].selections[0].choices).to.deep.equal(['oil', 'garbage']);
    });

    it('expands first selection', () => {
      testAction.selections[0].skipIf = 'always';
      const moves = testAction._getPendingMoves({});
      expect(moves?.length).to.equal(2);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('number');
      expect(moves![1].selections[0].type).to.equal('number');
    });

    it('provides next selection', () => {
      const moves = testAction._getPendingMoves({r: 'oil'});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('number');
      expect(moves![0].args).to.deep.equal({r: 'oil'});
    });

    it('skips next selection', () => {
      const moves = testAction._getPendingMoves({r: 'garbage'});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('number');
      expect(moves![0].args).to.deep.equal({r: 'garbage'});
    });

    it('completes', () => {
      const moves = testAction._getPendingMoves({r: 'oil', n: 2});
      expect(moves?.length).to.equal(0);
    });

    it('skips', () => {
      testAction.selections[0].choices = ['oil'];
      const moves = testAction._getPendingMoves({});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('number');
      expect(moves![0].args).to.deep.equal({r: 'oil'});
    });

    it('prevents skips', () => {
      testAction.selections[0].choices = ['oil'];
      testAction.selections[0].skipIf = 'never';
      const moves = testAction._getPendingMoves({});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('choices');
      expect(moves![0].selections[0].choices).to.deep.equal(['oil']);
    });
  });

  describe('board moves', () => {
    let board: Board;
    beforeEach(() => {
      board = new Board({ classRegistry: [Space, Piece] });
      const space1 = board.create(Space, 'space-1');
      board.create(Space, 'space-2');
      space1.create(Piece, 'piece-1');
      space1.create(Piece, 'piece-2');
    });

    it('chooseOnBoard', () => {
      const boardAction = action({
      }).chooseOnBoard('piece', board.all(Piece));
      const moves = boardAction._getPendingMoves({});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('board');
      expect(moves![0].selections[0].boardChoices).to.deep.equal(board.all(Piece));
    });

    it('moves', () => {
      const boardAction = action({
      }).chooseOnBoard('piece', board.all(Piece)).move('piece', board.first('space-2')!);
      boardAction._process(player, {piece: board.first('piece-1')!});
      expect(board.first('space-1')!.all(Piece).length).to.equal(1);
      expect(board.first('space-2')!.all(Piece).length).to.equal(1);
    });

    it('places', () => {
      const boardAction = action({
      }).chooseOnBoard('piece', board.all(Piece)).placePiece('piece', board.first('space-2')!);
      boardAction._process(player, {piece: board.first('piece-1')!, "__placement__": [3, 2]});
      expect(board.first('space-1')!.all(Piece).length).to.equal(1);
      expect(board.first('space-2')!.all(Piece).length).to.equal(1);
      const piece = board.first('piece-1')!;
      expect(piece.row).to.equal(2);
      expect(piece.column).to.equal(3);
    });
  });
});
