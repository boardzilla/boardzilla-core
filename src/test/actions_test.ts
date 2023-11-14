/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */
import chai from 'chai';
import spies from 'chai-spies';

import { action, Action } from '../action/index.js';

chai.use(spies);
const { expect } = chai;

describe('Actions', () => {
  let testAction: Action<any, {n: number, m: number}>;
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

  it('returns selections', () => {
    const error = testAction._process({});
    expect(error).to.not.be.undefined;
    const selections = testAction._getResolvedSelections({});
    expect(selections![0].selection.type).to.equal('number');
    expect(selections![0].selection.min).to.equal(0);
    expect(selections![0].selection.max).to.equal(3);
  });

  it('resolves dependant selections', () => {
    const error = testAction._process({n: 1});
    expect(error).to.not.be.undefined;
    const selections = testAction._getResolvedSelections({n: 1});
    expect(selections![0].selection.type).to.equal('number');
    expect(selections![0].selection.min).to.equal(1);
    expect(selections![0].selection.max).to.equal(2);
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

    // it('combines', () => {
    //   testAction = action({ prompt: 'purchase' })
    //     .enterText({ prompt: 'taunt' })
    //     .chooseNumber({ prompt: 'lumber' })
    //     .chooseNumber({ prompt: 'steel' })
    //     .combine({
    //       last: 2,
    //       validate: (lumber, steel) => lumber + steel < 10
    //     });
    //   const move = testAction._getResolvedSelections('fu');
    //   if (!move) {
    //     expect(move).to.not.be.undefined;
    //   } else {
    //     const selection = move[0].selection;
    //     expect(selection.prompt).to.equal('lumber');
    //     expect(selection.prompt).to.equal('lumber');
    //     expect(selection.clientContext?.followups.length).to.equal(1);
    //     expect(selection.clientContext?.followups[0].prompt).to.equal('steel');
    //     expect(selection.clientContext?.validate(5, 5)).to.equal(false);
    //     expect(selection.clientContext?.validate(5, 4)).to.equal(true);
    //   }
    // });
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
      const resolvedSelections = testAction._getResolvedSelections({});
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('choices');
      expect(resolvedSelections![0].selection.choices).to.deep.equal(['oil', 'garbage']);
    });

    it('expands first selection', () => {
      testAction._cfg.selections[0].expand = true;
      const resolvedSelections = testAction._getResolvedSelections({});
      expect(resolvedSelections?.length).to.equal(2);
      expect(resolvedSelections![0].selection.type).to.equal('number');
      expect(resolvedSelections![1].selection.type).to.equal('number');
    });

    it('provides next selection', () => {
      const resolvedSelections = testAction._getResolvedSelections({r: 'oil'});
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('number');
      expect(resolvedSelections![0].args).to.deep.equal({r: 'oil'});
    });

    it('skips next selection', () => {
      const resolvedSelections = testAction._getResolvedSelections({r: 'garbage'});
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('number');
      expect(resolvedSelections![0].args).to.deep.equal({r: 'garbage'});
    });

    it('completes', () => {
      const resolvedSelections = testAction._getResolvedSelections({r: 'oil', n: 2});
      expect(resolvedSelections?.length).to.equal(0);
    });

    it('skips', () => {
      testAction._cfg.selections[0].choices = ['oil'];
      const resolvedSelections = testAction._getResolvedSelections({});
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('number');
      expect(resolvedSelections![0].args).to.deep.equal({r: 'oil'});
    });

    it('prevents skips', () => {
      testAction._cfg.selections[0].choices = ['oil'];
      testAction._cfg.selections[0].skipIfOnlyOne = false;
      const resolvedSelections = testAction._getResolvedSelections({});
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('choices');
      expect(resolvedSelections![0].selection.choices).to.deep.equal(['oil']);
    });
  });
});
