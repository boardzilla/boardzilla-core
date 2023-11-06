/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */

import chai from 'chai';
import spies from 'chai-spies';

import { action, Action } from '../game/action';

chai.use(spies);
const { expect } = chai;

describe('Actions', () => {
  let testAction: Action<any, any>;
  const actionSpy = chai.spy((n: number, m: number) => ([n, m]));
  beforeEach(() => {
    testAction = action({
      prompt: 'add some counters',
    }).chooseNumber({
      prompt: 'how many?',
      min: 0,
      max: 3,
    }).chooseNumber({
      prompt: 'how many more?',
      min: (n: number) => n * 1,
      max: (n: number) => n * 2,
    }).do(actionSpy)
  });

  it('returns selections', () => {
    const error = testAction._process();
    expect(error).to.not.be.undefined;
    const selections = testAction._getResolvedSelections();
    expect(selections![0].selection.type).to.equal('number');
    expect(selections![0].selection.min).to.equal(0);
    expect(selections![0].selection.max).to.equal(3);
  });

  it('resolves dependant selections', () => {
    const error = testAction._process(1);
    expect(error).to.not.be.undefined;
    const selections = testAction._getResolvedSelections(1);
    expect(selections![0].selection.type).to.equal('number');
    expect(selections![0].selection.min).to.equal(1);
    expect(selections![0].selection.max).to.equal(2);
  });

  it('processes', () => {
    testAction._process(1, 2);
    expect(actionSpy).to.have.been.called.with(1, 2);
  });

  describe('nextSelections', () => {
    it('skipIf', () => {
      testAction = action({ prompt: 'pick an even number' })
        .chooseFrom({ choices: [1,2] })
        .chooseFrom({ choices: [3,4], skipIf: x => x === 1 })
        .chooseFrom({ choices: [5,6]})
      expect(testAction._nextSelection()?.choices).to.deep.equal([1,2]);
      expect(testAction._nextSelection(2)?.choices).to.deep.equal([3,4]);
      expect(testAction._nextSelection(1)?.choices).to.deep.equal([5,6]);
      expect(testAction._nextSelection(2,3)?.choices).to.deep.equal([5,6]);
      expect(testAction._nextSelection(2,3,5)).to.be.undefined;
      expect(testAction._nextSelection(1,5)).to.be.undefined;
    });

    it('skipIf last', () => {
      testAction = action({ prompt: 'pick an even number' })
        .chooseFrom({ choices: [1,2] })
        .chooseFrom({ choices: [5,6]})
        .chooseFrom({ choices: [3,4], skipIf: x => x === 1 })
      expect(testAction._nextSelection(2,5)?.choices).to.deep.equal([3,4]);
      expect(testAction._nextSelection(1,5)).to.be.undefined;
    });
  });

  describe('getResolvedSelections', () => {
    let options: number[];

    it('tests choices', () => {
      testAction = action({ prompt: 'pick an even number' }).chooseFrom({ choices: [] });
      expect(testAction._getResolvedSelections()).to.be.undefined;

      testAction = action({ prompt: 'pick an even number' }).chooseFrom({ choices: [1] });
      expect(testAction._getResolvedSelections()?.length).to.equal(1);
    });

    it('tests bounds', () => {
      testAction = action({ prompt: 'pick an even number' }).chooseNumber({ min: -1, max: 0 });
      expect(testAction._getResolvedSelections()?.length).to.equal(1);

      testAction = action({ prompt: 'pick an even number' }).chooseNumber({ min: 0, max: -1 });
      expect(testAction._getResolvedSelections()).to.be.undefined;
    });

    it('resolves selection to determine viability', () => {
      testAction = action({ prompt: 'pick an even number' })
        .chooseFrom({ choices: () => options.filter(n => n % 2 === 0) })

      options = [1,2];
      expect(testAction._getResolvedSelections()?.length).to.equal(1);
      options = [1,3,5];
      expect(testAction._getResolvedSelections()).to.be.undefined;
    });

    it('resolves selection deeply to determine viability', () => {
      testAction = action({ prompt: 'pick an even number' })
        .chooseFrom({ choices: () => options.filter(n => n % 2 === 0) })
        .chooseNumber({
          min: (n: number) => n,
          max: 4
        });

      options = [1,8,9,10,11,4];
      expect(testAction._getResolvedSelections()?.length).to.equal(1);
      options = [1,8,9,10,11];
      expect(testAction._getResolvedSelections()).to.be.undefined;
    });

    it('does not fully resolve unbounded args', () => {
      testAction = action({ prompt: 'pick an even number' })
        .chooseNumber({ min: 1 })
        .chooseNumber({
          min: (n: number) => n * 10,
          max: 4
        });

      expect(testAction._getResolvedSelections()?.length).to.equal(1);
    });
  });

  describe('getResolvedSelections with skip/expand', () => {
    let testAction: Action<any, any>;
    beforeEach(() => {
      testAction = action({ prompt: 'p' }).chooseFrom({
        choices: ['oil', 'garbage']
      }).chooseNumber({
        max: r => r === 'oil' ? 3 : 1
      });
    });

    it('shows first selection', () => {
      const resolvedSelections = testAction._getResolvedSelections();
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('choices');
      expect(resolvedSelections![0].selection.choices).to.deep.equal(['oil', 'garbage']);
    });

    it('expands first selection', () => {
      testAction._cfg.selections[0].expand = true;
      const resolvedSelections = testAction._getResolvedSelections();
      expect(resolvedSelections?.length).to.equal(2);
      expect(resolvedSelections![0].selection.type).to.equal('number');
      expect(resolvedSelections![1].selection.type).to.equal('number');
    });

    it('provides next selection', () => {
      const resolvedSelections = testAction._getResolvedSelections('oil');
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('number');
      expect(resolvedSelections![0].args).to.deep.equal(['oil']);
    });

    it('skips next selection', () => {
      const resolvedSelections = testAction._getResolvedSelections('garbage');
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('number');
      expect(resolvedSelections![0].args).to.deep.equal(['garbage']);
    });

    it('completes', () => {
      const resolvedSelections = testAction._getResolvedSelections('oil', 2);
      expect(resolvedSelections?.length).to.equal(0);
    });

    it('skips', () => {
      testAction._cfg.selections[0].choices = ['oil'];
      const resolvedSelections = testAction._getResolvedSelections();
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('number');
      expect(resolvedSelections![0].args).to.deep.equal(['oil']);
    });

    it('prevents skips', () => {
      testAction._cfg.selections[0].choices = ['oil'];
      testAction._cfg.selections[0].skipIfOnlyOne = false;
      const resolvedSelections = testAction._getResolvedSelections();
      expect(resolvedSelections?.length).to.equal(1);
      expect(resolvedSelections![0].selection.type).to.equal('choices');
      expect(resolvedSelections![0].selection.choices).to.deep.equal(['oil']);
    });
  });
});
