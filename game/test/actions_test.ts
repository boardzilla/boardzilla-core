/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */

import chai from 'chai';
import spies from 'chai-spies';

import { action } from '../';
import { Action } from '../action';

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
    const [sel] = testAction.process();
    expect(sel?.type).to.equal('number');
    expect(sel?.min).to.equal(0);
    expect(sel?.max).to.equal(3);
  });

  it('resolves dependant selections', () => {
    const [sel] = testAction.process(1);
    expect(sel?.type).to.equal('number');
    expect(sel?.min).to.equal(1);
    expect(sel?.max).to.equal(2);
  });

  it('short circuits', () => {
    testAction.process(0);
    expect(actionSpy).to.have.been.called.with(0, 0);
  });

  it('processes', () => {
    testAction.process(1, 2);
    expect(actionSpy).to.have.been.called.with(1, 2);
  });

  describe('forceArgs', () => {
    let options: number[];
    const testAction = action({
      prompt: 'pick an even number',
    }).chooseFrom({
      choices: () => options.filter(n => n % 2 === 0)
    }).chooseFrom({
      choices: () => options.filter(n => n % 3 === 0)
    });

    // it('provides forced args', () => {
    //   options = [2,4];
    //   let [selection, args, error] = testAction.forceArgs();
    //   expect(selection).to.be.undefined;
    //   expect(error).not.to.be.undefined;

    //   options = [2,3,9];
    //   [selection, args, error] = testAction.forceArgs();
    //   expect(selection?.choices).to.deep.equal([3,9]);
    //   expect(args).to.deep.equal([2]);
    //   expect(error).to.be.undefined;

    //   options = [2,3];
    //   [selection, args, error] = testAction.forceArgs();
    //   expect(selection).to.be.undefined
    //   expect(args).to.deep.equal([2,3]);
    //   expect(error).to.be.undefined;
    // });
  });

  describe('isPossible', () => {
    let options: number[];

    it('tests choices', () => {
      testAction = action({ prompt: 'pick an even number' }).chooseFrom({ choices: [] });
      console.log(testAction.getMoveTree());
      expect(testAction.isPossible()).to.equal(false);

      testAction = action({ prompt: 'pick an even number' }).chooseFrom({ choices: [1] });
      expect(testAction.isPossible()).to.equal(true);
    });

    it('tests bounds', () => {
      testAction = action({ prompt: 'pick an even number' }).chooseNumber({ min: -1, max: 0 });
      console.log(testAction.getMoveTree());
      expect(testAction.isPossible()).to.equal(true);

      testAction = action({ prompt: 'pick an even number' }).chooseNumber({ min: 0, max: -1 });
      expect(testAction.isPossible()).to.equal(false);
    });

    it('resolves selection to determine viability', () => {
      testAction = action({ prompt: 'pick an even number' })
        .chooseFrom({ choices: () => options.filter(n => n % 2 === 0) })
      console.log(testAction.getMoveTree());

      options = [1,2];
      expect(testAction.isPossible()).to.equal(true);
      options = [1,3,5];
      expect(testAction.isPossible()).to.equal(false);
    });

    it('resolves selection deeply to determine viability', () => {
      testAction = action({ prompt: 'pick an even number' })
        .chooseFrom({ choices: () => options.filter(n => n % 2 === 0) })
        .chooseNumber({
          min: (n: number) => n,
          max: 4
        });
      console.log(testAction.getMoveTree());

      options = [1,8,9,10,11,4];
      expect(testAction.isPossible()).to.equal(true);
      options = [1,8,9,10,11];
      expect(testAction.isPossible()).to.equal(false);
    });

    it('does not fully resolve unbounded args', () => {
      testAction = action({ prompt: 'pick an even number' })
        .chooseNumber({ min: 1 })
        .chooseNumber({
          min: (n: number) => n * 10,
          max: 4
        });

      expect(testAction.isPossible()).to.equal(true);
    });
  });
});
