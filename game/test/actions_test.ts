/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */

import chai from 'chai';
import spies from 'chai-spies';

import { Action, MoveAction } from '../';

chai.use(spies);
const { expect } = chai;

describe('Actions', () => {
  let action: Action;
  const actionSpy = chai.spy((n: number, m: number) => ([n, m]));
  beforeEach(() => {
    action = new Action({
      prompt: 'add some counters',
      selections: [{
        prompt: 'how many?',
        selectNumber: {
          min: 0,
          max: 3,
        }
      }, {
        prompt: 'how many more?',
        selectNumber: {
          min: (n: number) => n * 1,
          max: (n: number) => n * 2,
        }
      }],
      move: (n: number, m: number) => actionSpy(n, m)
    });
  });

  it('returns selections', () => {
    const [sel] = action.process();
    expect(sel?.type).to.equal('number');
    expect(sel?.min).to.equal(0);
    expect(sel?.max).to.equal(3);
  });

  it('resolves dependant selections', () => {
    const [sel] = action.process(1);
    expect(sel?.type).to.equal('number');
    expect(sel?.min).to.equal(1);
    expect(sel?.max).to.equal(2);
  });

  it('short circuits', () => {
    action.process(0);
    expect(actionSpy).to.have.been.called.with(0, 0);
  });

  it('processes', () => {
    action.process(1, 2);
    expect(actionSpy).to.have.been.called.with(1, 2);
  });

  describe('getSelections', () => {
    it('flattens selections', () => {
      action = new Action({
        prompt: 'add some counters',
        selections: [
          new Action({
            prompt: 'put token back',
            selections: [{
              selectNumber: {
                min: 1,
                max: 6,
              }
            }]
          }),
          {
            selectNumber: {
              min: 7,
              max: 12,
            }
          }
        ],
      });

      const selections = action.getSelections();
      expect(selections.length).to.equal(2);
      expect(selections[0]?.type).to.equal('number');
      expect(selections[0]?.min).to.equal(1);
      expect(selections[0]?.max).to.equal(6);
      expect(selections[1]?.type).to.equal('number');
      expect(selections[1]?.min).to.equal(7);
      expect(selections[1]?.max).to.equal(12);
    });
  });

  describe('forceArgs', () => {
    let options: number[];
    const action = new Action({
      prompt: 'pick an even number',
      selections: [{
        selectFromChoices: {
          choices: () => options.filter(n => n % 2 === 0)
        }
      }, {
        selectFromChoices: {
          choices: () => options.filter(n => n % 3 === 0)
        }
      }],
    });

    it('provides forced args', () => {
      options = [2,4];
      let [selection, args, error] = action.forceArgs();
      expect(selection).to.be.undefined;
      expect(error).not.to.be.undefined;

      options = [2,3,9];
      [selection, args, error] = action.forceArgs();
      expect(selection?.choices).to.deep.equal([3,9]);
      expect(args).to.deep.equal([2]);
      expect(error).to.be.undefined;

      options = [2,3];
      [selection, args, error] = action.forceArgs();
      expect(selection).to.be.undefined
      expect(args).to.deep.equal([2,3]);
      expect(error).to.be.undefined;
    });
  });

  describe('isPossible', () => {
    let options: number[];

    it('tests choices', () => {
      action = new Action({
        prompt: 'pick an even number',
        selections: [{
          selectFromChoices: { choices: [] }
        }],
      });
      expect(action.isPossible()).to.equal(false);

      action = new Action({
        prompt: 'pick an even number',
        selections: [{
          selectFromChoices: { choices: [1] }
        }],
      });

      expect(action.isPossible()).to.equal(true);
    });

    it('tests bounds', () => {
      action = new Action({
        prompt: 'pick an even number',
        selections: [{
          selectNumber: { min: -1, max: 0 }
        }],
      });
      expect(action.isPossible()).to.equal(true);

      action = new Action({
        prompt: 'pick an even number',
        selections: [{
          selectNumber: { min: 0, max: -1 }
        }],
      });

      expect(action.isPossible()).to.equal(false);
    });

    it('resolves selection to determine viability', () => {
      action = new Action({
        prompt: 'pick an even number',
        selections: [{
          selectFromChoices: {
            choices: () => options.filter(n => n % 2 === 0)
          }
        }],
      });

      options = [1,2];
      expect(action.isPossible()).to.equal(true);
      options = [1,3,5];
      expect(action.isPossible()).to.equal(false);
    });

    it('resolves selection deeply to determine viability', () => {
      action = new Action({
        prompt: 'pick an even number',
        selections: [{
          selectFromChoices: {
            choices: () => options.filter(n => n % 2 === 0)
          }
        }, {
          selectNumber: {
            min: (n: number) => n,
            max: 4
          }
        }],
      });

      options = [1,8,9,10,11,4];
      expect(action.isPossible()).to.equal(true);
      options = [1,8,9,10,11];
      expect(action.isPossible()).to.equal(false);
    });

    it('does not fully resolve unbounded args', () => {
      action = new Action({
        prompt: 'pick an even number',
        selections: [{
          selectNumber: {
            min: 1
          }
        }, {
          selectNumber: {
            min: (n: number) => n * 10,
            max: 4
          }
        }],
      });

      expect(action.isPossible()).to.equal(true);
    });
  });
});
