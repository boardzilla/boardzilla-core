/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */
import chai from 'chai';
import spies from 'chai-spies';

import { action, Action } from '../action/index.js';

chai.use(spies);
const { expect } = chai;

describe('Actions', () => {
  let testAction: Action<any>;
  const actionSpy = chai.spy(({ n, m }: { n: number, m: number }) => ([n, m]));
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
    const error = testAction._process({});
    expect(error).to.not.be.undefined;
    const moves = testAction._getResolvedSelections({});
    expect(moves![0].selections[0].type).to.equal('number');
    expect(moves![0].selections[0].min).to.equal(0);
    expect(moves![0].selections[0].max).to.equal(3);
  });

  it('resolves dependant selections', () => {
    const error = testAction._process({n: 1});
    expect(error).to.not.be.undefined;
    const moves = testAction._getResolvedSelections({n: 1});
    expect(moves![0].selections[0].type).to.equal('number');
    expect(moves![0].selections[0].min).to.equal(1);
    expect(moves![0].selections[0].max).to.equal(2);
  });

  it('processes', () => {
    testAction._process({n: 1, m: 2});
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

  describe('getResolvedSelections', () => {
    let options: number[];

    it('tests choices', () => {
      const testAction1 = action({ prompt: 'pick an even number' }).chooseFrom('n', []);
      expect(testAction1._getResolvedSelections({})).to.be.undefined;

      const testAction2 = action({ prompt: 'pick an even number' }).chooseFrom('n', [1]);
      expect(testAction2._getResolvedSelections({})?.length).to.equal(1);
    });

    it('tests bounds', () => {
      const testAction1 = action({ prompt: 'pick an even number' }).chooseNumber('n', { min: -1, max: 0 });
      expect(testAction1._getResolvedSelections({})?.length).to.equal(1);

      const testAction2 = action({ prompt: 'pick an even number' }).chooseNumber('n', { min: 0, max: -1 });
      expect(testAction2._getResolvedSelections({})).to.be.undefined;
    });

    it('resolves selection to determine viability', () => {
      const testAction1 = action({ prompt: 'pick an even number' })
        .chooseFrom('n', () => options.filter(n => n % 2 === 0))

      options = [1,2];
      expect(testAction1._getResolvedSelections({})?.length).to.equal(1);
      options = [1,3,5];
      expect(testAction1._getResolvedSelections({})).to.be.undefined;
    });

    it('resolves selection deeply to determine viability', () => {
      const testAction1 = action({ prompt: 'pick an even number' })
        .chooseFrom('n', () => options.filter(n => n % 2 === 0))
        .chooseNumber('m', {
          min: ({ n }) => n,
          max: 4
        });

      options = [1,8,9,10,11,4];
      expect(testAction1._getResolvedSelections({})?.length).to.equal(1);
      options = [1,8,9,10,11];
      expect(testAction1._getResolvedSelections({})).to.be.undefined;
    });

    it('does not fully resolve unbounded args', () => {
      const testAction1 = action({ prompt: 'pick an even number' })
        .chooseNumber('n', { min: 1 })
        .chooseNumber('m', {
          min: ({ n }) => n * 10,
          max: 4
        });

      expect(testAction1._getResolvedSelections({})?.length).to.equal(1);
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
      const move1 = testAction._getResolvedSelections({});
      if (!move1) {
        expect(move1).to.not.be.undefined;
      } else {
        expect(move1[0].selections.length).to.equal(1);
        expect(move1[0].selections[0].name).to.equal('taunt');
      }
      const move2 = testAction._getResolvedSelections({taunt: 'fu'});
      if (!move2) {
        expect(move2).to.not.be.undefined;
      } else {
        expect(move2[0].selections.length).to.equal(2);
        expect(move2[0].selections[0].name).to.equal('lumber');
        expect(move2[0].selections[1].name).to.equal('steel');
        expect(move2[0].selections[1].validate({ lumber: 5, steel: 5 })).to.not.be.undefined;
        expect(move2[0].selections[1].validate({ lumber: 5, steel: 4 })).to.be.undefined;
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
      const move = testAction._getResolvedSelections({});
      if (!move) {
        expect(move).to.not.be.undefined;
      } else {
        expect(move[0].selections.length).to.equal(2);
        expect(move[0].selections[0].name).to.equal('lumber');
        expect(move[0].selections[1].name).to.equal('meat');
      }
      const move2 = testAction._getResolvedSelections({lumber: 1, meat: 0});
      if (!move2) {
        expect(move2).to.not.be.undefined;
      } else {
        expect(move2[0].selections.length).to.equal(1);
        expect(move2[0].selections[0].name).to.equal('plastic'); // bit odd, but this is skippable
      }
      const move3 = testAction._getResolvedSelections({lumber: 0, meat: 0});
      expect(move3).to.be.undefined;
    });
  });

  describe('getResolvedSelections with skip/expand', () => {
    let testAction: Action<any, {r: string, n: number}>;
    beforeEach(() => {
      testAction = action({ prompt: 'p' })
        .chooseFrom('r', ['oil', 'garbage'])
        .chooseNumber('n', {
        max: ({ r }) => r === 'oil' ? 3 : 1
      });
    });

    it('shows first selection', () => {
      const moves = testAction._getResolvedSelections({});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('choices');
      expect(moves![0].selections[0].choices).to.deep.equal(['oil', 'garbage']);
    });

    it('expands first selection', () => {
      testAction._cfg.selections[0].expand = true;
      const moves = testAction._getResolvedSelections({});
      expect(moves?.length).to.equal(2);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('number');
      expect(moves![1].selections[0].type).to.equal('number');
    });

    it('provides next selection', () => {
      const moves = testAction._getResolvedSelections({r: 'oil'});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('number');
      expect(moves![0].args).to.deep.equal({r: 'oil'});
    });

    it('skips next selection', () => {
      const moves = testAction._getResolvedSelections({r: 'garbage'});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('number');
      expect(moves![0].args).to.deep.equal({r: 'garbage'});
    });

    it('completes', () => {
      const moves = testAction._getResolvedSelections({r: 'oil', n: 2});
      expect(moves?.length).to.equal(0);
    });

    it('skips', () => {
      testAction._cfg.selections[0].choices = ['oil'];
      const moves = testAction._getResolvedSelections({});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('number');
      expect(moves![0].args).to.deep.equal({r: 'oil'});
    });

    it('prevents skips', () => {
      testAction._cfg.selections[0].choices = ['oil'];
      testAction._cfg.selections[0].skipIfOnlyOne = false;
      const moves = testAction._getResolvedSelections({});
      expect(moves?.length).to.equal(1);
      expect(moves![0].selections.length).to.equal(1);
      expect(moves![0].selections[0].type).to.equal('choices');
      expect(moves![0].selections[0].choices).to.deep.equal(['oil']);
    });
  });
});
