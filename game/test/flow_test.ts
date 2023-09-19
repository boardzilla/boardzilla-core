/* global describe, it, beforeEach */
/* eslint-disable no-unused-expressions */

import chai from 'chai';
import spies from 'chai-spies';
import {
  Sequence,
  PlayerAction,
  Step,
  Loop,
  ForEach,
  SwitchCase,
  IfElse,
  skip,
  repeat
} from '../flow';

chai.use(spies);
const { expect } = chai;

describe('Flow', () => {
  const stepSpy1 = chai.spy();
  const stepSpy2 = chai.spy();
  const actionSpy = chai.spy(() => []);
  const playSpy = chai.spy((a:any) => {a});
  const testFlow = new Sequence({ name: 'test', steps: [
    new Step({ name: 'step1', command: stepSpy1 }),
    new Step({ name: 'step2', command: stepSpy2 }),
    new Step({ name: 'step3' }),
    new Sequence({ name: 'step4', steps: [
      new Step({ name: 'substep1' }),
      new Step({ name: 'substep2' }),
      new PlayerAction({ name: 'play-or-pass', actions: {
        play: new Step({ name: 'play-step', command: ({ play }) => playSpy(play) }),
        pass: new Sequence({ name: 'pass-stage', steps: [
          new Step({ name: 'pass-step1' }),
          new Step({ name: 'pass-step2' }),
        ]})
      }}),
      new Step({ name: 'substep3' }),
    ]}),
    new Step({ name: 'step5' }),
  ]});
  // @ts-ignore mock game
  testFlow.ctx.game = { flow: testFlow, players: { currentPosition: 1, atPosition: () => {} }, action: a => ({ play: { process: actionSpy }, pass: { process: () => [] } }[a]) };

  beforeEach(() => {
    testFlow.start();
  })
  it('initial', () => {
    expect(testFlow.branch()).to.deep.equal([{ type: 'sequence', name: 'test', position: 0 }]);
  });
  it('setPosition', () => {
    testFlow.setBranch([{ type: 'sequence', name: 'test', position: 0 }]);
    expect(testFlow.branch()).to.deep.equals([{ type: 'sequence', name: 'test', position: 0 }]);
  });
  it('play from initial', () => {
    testFlow.playOneStep();
    expect(stepSpy1).to.have.been.called();
    expect(stepSpy2).to.not.have.been.called();
    expect(testFlow.branch()).to.deep.equal([{ type: 'sequence', name: 'test', position: 1 }]);
  });
  it('play twice', () => {
    testFlow.playOneStep();
    testFlow.playOneStep();
    expect(stepSpy1).to.have.been.called();
    expect(stepSpy2).to.have.been.called();
    expect(testFlow.branch()).to.deep.equals([{ type: 'sequence', name: 'test', position: 2 }]);
  });
  it('play from state', () => {
    testFlow.setBranch([{ type: 'sequence', name: 'test', position: 1 }]);
    testFlow.playOneStep();
    expect(stepSpy1).to.have.been.called();
    expect(stepSpy2).to.have.been.called();
    expect(testFlow.branch()).to.deep.equals([{ type: 'sequence', name: 'test', position: 2 }]);
  });
  it('nested', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 0 }
    ]);
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 0 }
    ]);
  });
  it('advances into nested', () => {
    testFlow.setBranch([{ type: 'sequence', name: 'test', position: 2 }]);
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 0 }
    ]);
  });
  it('advances out of nested', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 3 }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([{ type: 'sequence', name: 'test', position: 4 }]);
  });
  it('awaits action', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 2 }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: "sequence", name: "test", position: 3 },
      { type: "sequence", name: "step4", position: 2 },
    ]);
  });
  it('receives action', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 2 }
    ]);
    testFlow.processMove({ action: 'play', args: ['violin'], player: 1 });
    expect(actionSpy).to.have.been.called();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 2 },
      { type: 'action', name: 'play-or-pass', position: { action: 'play', args: ['violin'], player: 1 }}
    ]);
  });
  it('rejects actions out of turn', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 2 }
    ]);
    expect(() => testFlow.processMove({ action: 'play', args: ['violin'], player: 2 })).to.throw();
  });
  it('plays action', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 2 },
      { type: 'action', name: 'play-or-pass', position: { action: 'play', args: ['violin'], player: 1 }}
    ]);
    testFlow.playOneStep();
    expect(playSpy).to.have.been.called.with(['violin']);
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 3 },
    ]);
  });
  it('actions continue into other flows', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 2 }
    ]);
    testFlow.processMove({ action: 'pass', args: [], player: 1 });
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 2 },
      { type: 'action', name: 'play-or-pass', position: { action: 'pass', args: [], player: 1 }},
      { type: 'sequence', name: 'pass-stage', position: 1 },
    ]);
  });
  it('plays', () => {
    let actions = testFlow.play();
    expect(typeof actions).to.equal('object');
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 2 }
    ]);
    testFlow.processMove({ action: 'pass', args: [], player: 1 });
    actions = testFlow.play();
    expect(actions).to.equal(undefined);
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 4 }
    ]);
  });
  it('serializes', () => {
    const branch = [
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'sequence', name: 'step4', position: 2 },
      { type: 'action', name: 'play-or-pass', position: { action: 'pass', args: [], player: 1 }},
      { type: 'sequence', name: 'pass-stage', position: 1 },
    ];
    testFlow.setBranch(branch);
    testFlow.setBranchFromJSON(testFlow.branchJSON());
    expect(testFlow.branch()).to.deep.equals(branch);
  });
});

describe('Loop', () => {
  const stepSpy1 = chai.spy((x:number) => x);
  const stepSpy2 = chai.spy((x:number) => x);
  const forLoop = new Loop({ name: 'loop', initial: 10, next: loop => loop + 1, while: loop => loop < 13, do: (
    new Step({ name: 'substep1', command: ({ loop }) => stepSpy1(loop) })
  )});

  const nonLoop = new Loop({ name: 'nonloop', initial: 0, next: loop => loop + 1, while: loop => loop < 0, do: (
    new Step({ name: 'substep2', command: ({ nonloop }) => stepSpy2(nonloop) })
  )});

  const testFlow = new Sequence({ name: 'test', steps: [
    new Step({ name: 'step1' }),
    forLoop,
    new Step({ name: 'step2' }),
    nonLoop,
    new Step({ name: 'step3' }),
  ]});
  // @ts-ignore
  testFlow.ctx.game = { flow: testFlow };

  beforeEach(() => {
    testFlow.start();
  })

  it('enters loop', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 0 }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 1 },
      { type: 'loop', name: 'loop', position: { index: 0, value: 10 } }
    ]);
    expect(stepSpy1).to.not.have.been.called();
  });
  it('repeats loop', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 1 },
      { type: 'loop', name: 'loop', position: { index: 0, value: 10 } }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 1 },
      { type: 'loop', name: 'loop', position: { index: 1, value: 11 } }
    ]);
    expect(stepSpy1).to.have.been.called.with(10);

    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 1 },
      { type: 'loop', name: 'loop', position: { index: 2, value: 12 } }
    ]);
    expect(stepSpy1).to.have.been.called.with(11);
  });
  it('exits loop', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 1 },
      { type: 'loop', name: 'loop', position: { index: 2, value: 12 } }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 2 },
    ]);
  });
  it('skips non-loop', () => {
    testFlow.setBranch([
      { type: 'sequence', name: 'test', position: 2 },
    ]);
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 3 },
      { type: 'loop', name: 'nonloop', position: { index: -1, value: 0 } }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'sequence', name: 'test', position: 4 },
    ]);
    expect(stepSpy2).to.not.have.been.called();
  });

  describe('nested', () => {
    const stepSpy = chai.spy((x: number, y: number) => {x; y});
    const nestedLoop = new Loop({
      name: 'x',
      initial: 0,
      next: x => x + 1,
      while: x => x < 3,
      do: new Loop({
        name: 'y',
        initial: 0,
        next: y => y + 1,
        while: y => y < 2,
        do: new Step({ command: ({ x, y }) => stepSpy(x, y) })
      })
    });

    beforeEach(() => {
      nestedLoop.start();
    })

    it ('resets counters', () => {
      while(nestedLoop.playOneStep() === 'ok') { }
      expect(stepSpy).to.have.been.called.exactly(6);
      expect(stepSpy).on.nth(1).be.called.with(0, 0);
      expect(stepSpy).on.nth(2).be.called.with(0, 1);
      expect(stepSpy).on.nth(3).be.called.with(1, 0);
      expect(stepSpy).on.nth(4).be.called.with(1, 1);
      expect(stepSpy).on.nth(5).be.called.with(2, 0);
      expect(stepSpy).on.nth(6).be.called.with(2, 1);
    });
  });

  describe('foreach', () => {
    it ('loops', () => {
      const stepSpy = chai.spy((x:number) => x);
      const loop = new ForEach({ name: 'foreach', collection: [3, 5, 7], do: new Step({
        command: ({ foreach }) => stepSpy(foreach)
      })});
      loop.start();
      while(loop.playOneStep() === 'ok') { }
      expect(stepSpy).to.have.been.called.exactly(3);
      expect(stepSpy).on.nth(1).be.called.with(3);
      expect(stepSpy).on.nth(2).be.called.with(5);
      expect(stepSpy).on.nth(3).be.called.with(7);
    });
    it ('resumes', () => {
      const stepSpy = chai.spy((x:number) => x);
      const loop = new ForEach({ name: 'foreach', collection: [3, 5, 7], do: new Step({
        command: ({ foreach }) => stepSpy(foreach)
      })});
      loop.start();
      loop.setBranch([
        {
          type: 'foreach',
          name: 'foreach',
          position: { index: 1, value: 5, collection: [3,5,7] }
        }
      ]);
      loop.playOneStep();
      expect(stepSpy).to.have.been.called.with(5);
      expect(loop.playOneStep()).to.equal('complete');
      expect(stepSpy).to.have.been.called.with(7);
    });
    it ('allows dynamic collection', () => {
      const stepSpy = chai.spy((x:number) => x);
      const loop = new Loop({ name: 'loop', initial: 1, next: loop => loop + 1, while: loop => loop != 3, do: (
        new ForEach({ name: 'foreach', collection: ({ loop }) => [10 + loop, 20 + loop], do: (
          new Step({
            command: ({ foreach }) => stepSpy(foreach)
          })
        )})
      )});
      loop.start();
      while(loop.playOneStep() === 'ok') { }
      expect(stepSpy).to.have.been.called.exactly(4);
      expect(stepSpy).on.nth(1).be.called.with(11);
      expect(stepSpy).on.nth(2).be.called.with(21);
      expect(stepSpy).on.nth(3).be.called.with(12);
      expect(stepSpy).on.nth(4).be.called.with(22);
    });
    it ('empty collection', () => {
      const stepSpy = chai.spy((x:number) => x);
      const loop = new ForEach({ name: 'foreach', collection: [], do: new Step({
        command: ({ foreach }) => stepSpy(foreach)
      })});
      loop.start();
      while(loop.playOneStep() === 'ok') { }
      expect(stepSpy).not.to.have.been.called();
    });

  });
});


describe('Loop short-circuiting', () => {
  it('can repeat', () => {
    const stepSpy1 = chai.spy((x:number) => x === 12 ? repeat() : undefined);
    const stepSpy2 = chai.spy((s: string, x:number) => x);
    const forLoop = new Loop({ name: 'loop', initial: 10, next: loop => loop + 1, while: loop => loop < 20, do: new Sequence({ steps: [
      new Step({ name: 'start', command: ({ loop }) => stepSpy2('start', loop) }),
      new Step({ name: 'skipper', command: ({ loop }) => stepSpy1(loop) }),
      new Step({ name: 'skipped', command: ({ loop }) => stepSpy2('end', loop) })
    ]})});
    forLoop.start();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    expect(stepSpy2).to.have.been.called.with('start', 11);
    expect(stepSpy2).to.have.been.called.with('end', 11);
    expect(stepSpy2).to.have.been.called.with('start', 12);
    expect(stepSpy2).not.to.have.been.called.with('end', 12);
    expect(stepSpy2).not.to.have.been.called.with('start', 13);
  });

  it('can skip', () => {
    const stepSpy1 = chai.spy((x:number) => x === 12 ? skip() : undefined);
    const stepSpy2 = chai.spy((s: string, x:number) => x);
    const forLoop = new Loop({ name: 'loop', initial: 10, next: loop => loop + 1, while: loop => loop < 20, do: new Sequence({ steps: [
      new Step({ name: 'start', command: ({ loop }) => stepSpy2('start', loop) }),
      new Step({ name: 'skipper', command: ({ loop }) => stepSpy1(loop) }),
      new Step({ name: 'skipped', command: ({ loop }) => stepSpy2('end', loop) })
    ]})});
    forLoop.start();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    forLoop.playOneStep();
    expect(stepSpy2).to.have.been.called.with('start', 11);
    expect(stepSpy2).to.have.been.called.with('end', 11);
    expect(stepSpy2).to.have.been.called.with('start', 12);
    expect(stepSpy2).not.to.have.been.called.with('end', 12);
    expect(stepSpy2).to.have.been.called.with('start', 13);
  });
});

describe('SwitchCase', () => {
  it('switches', () => {
    const stepSpy1 = chai.spy((x:number) => x);
    const testFlow = new Loop({ name: 'loop', initial: 0, next: loop => loop + 1, while: loop => loop < 3, do: (
      new SwitchCase({ name: 'switcher', switch: ({ loop }) => loop, cases: [
        { eq: 0, flow: new Step({ name: 'case-0', command: ({ switcher }) => stepSpy1(switcher) })},
        { eq: 1, flow: new Step({ name: 'case-1', command: ({ switcher }) => stepSpy1(switcher) })},
      ]})
    )});

    // @ts-ignore
    testFlow.ctx.game = { flow: testFlow };
    testFlow.start();

    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 0, value: 0 } },
      { type: 'switch-case', name: 'switcher', position: { index: 0, value: 0 } }
    ]);
    expect(stepSpy1).not.to.have.been.called();
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 1, value: 1 } },
      { type: 'switch-case', name: 'switcher', position: { index: 1, value: 1 } }
    ]);
    expect(stepSpy1).to.have.been.called.with(0);
    expect(testFlow.playOneStep()).to.equal('ok');
    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 2, value: 2 } },
      { type: 'switch-case', name: 'switcher', position: { index: -1, value: 2 } }
    ]);
    expect(stepSpy1).to.have.been.called.with(1);
    expect(testFlow.playOneStep()).to.equal('complete');
    expect(stepSpy1).to.have.been.called.exactly(2);
  });

  it('sets position', () => {
    const stepSpy1 = chai.spy((x:number) => x);
    const testFlow = new Loop({ name: 'loop', initial: 0, next: loop => loop + 1, while: loop => loop < 3, do: (
      new SwitchCase({ name: 'switch', switch: ({ loop }) => loop, cases: [
        { eq: 0, flow: new Step({ name: 'case-0', command: () => stepSpy1(0) })},
        { eq: 1, flow: new Step({ name: 'case-1', command: () => stepSpy1(1) })},
      ]})
    )});

    // @ts-ignore
    testFlow.ctx.game = { flow: testFlow };
    testFlow.start();

    testFlow.setBranch([
      { type: 'loop', name: 'loop', position: { index: 1, value: 1 } },
      { type: 'switch-case', name: 'switch', position: { index: 1, value: 1 } }
    ]);
    expect(stepSpy1).not.to.have.been.called();
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 2, value: 2 } },
      { type: 'switch-case', name: 'switch', position: { index: -1, value: 2 } }
    ]);
    expect(stepSpy1).to.have.been.called.with(1);
  });

  it('defaults', () => {
    const stepSpy1 = chai.spy((x:number) => x);
    const testFlow = new Loop({ name: 'loop', initial: 0, next: loop => loop + 1, while: loop => loop < 3, do: (
      new SwitchCase({
        name: 'switch',
        switch: ({ loop }) => loop,
        cases: [
          { eq: 0, flow: new Step({ name: 'case-0', command: () => stepSpy1(0) })},
          { eq: 1, flow: new Step({ name: 'case-1', command: () => stepSpy1(1) })},
        ],
        default: new Step({ name: 'case-0', command: () => stepSpy1(-1) })
      })
    )});

    // @ts-ignore
    testFlow.ctx.game = { flow: testFlow };
    testFlow.start();

    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 0, value: 0 } },
      { type: 'switch-case', name: 'switch', position: { index: 0, value: 0 } }
    ]);
    expect(stepSpy1).not.to.have.been.called();
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 1, value: 1 } },
      { type: 'switch-case', name: 'switch', position: { index: 1, value: 1 } }
    ]);
    expect(stepSpy1).to.have.been.called.with(0);
    expect(testFlow.playOneStep()).to.equal('ok');
    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 2, value: 2 } },
      { type: 'switch-case', name: 'switch', position: { default: true, value: 2 } }
    ]);
    expect(stepSpy1).to.have.been.called.with(1);
    expect(testFlow.playOneStep()).to.equal('complete');
    expect(stepSpy1).to.have.been.called.with(-1);
    expect(stepSpy1).to.have.been.called.exactly(3);
  });
});


describe('IfElse', () => {
  it('switches', () => {
    const stepSpy1 = chai.spy((x:number) => x);
    const testFlow = new Loop({ name: 'loop', initial: 0, next: loop => loop + 1, while: loop => loop < 3, do: new IfElse({
      name: 'if',
      test: ({ loop }) => loop === 1,
      do: new Step({ command: () => stepSpy1(0) }),
      else: new Step({ command: () => stepSpy1(-1) })
    })});

    // @ts-ignore
    testFlow.ctx.game = { flow: testFlow };
    testFlow.start();

    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 0, value: 0 } },
      { type: 'if-else', name: 'if', position: { default: true, value: false } }
    ]);
    expect(stepSpy1).not.to.have.been.called();
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 1, value: 1 } },
      { type: 'if-else', name: 'if', position: { index: 0, value: true } }
    ]);
    expect(stepSpy1).to.have.been.called.with(-1);
    testFlow.playOneStep();
    expect(testFlow.branch()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 2, value: 2 } },
      { type: 'if-else', name: 'if', position: { default: true, value: false } }
    ]);
    expect(stepSpy1).to.have.been.called.with(0);
    testFlow.playOneStep();
    expect(stepSpy1).to.have.been.called.exactly(3);
    expect(stepSpy1).on.nth(1).be.called.with(-1);
    expect(stepSpy1).on.nth(2).be.called.with(0);
    expect(stepSpy1).on.nth(3).be.called.with(-1);
  });
});
