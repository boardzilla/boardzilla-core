import chai from 'chai';
import spies from 'chai-spies';

import Flow from '../src/flow/flow.js';
import {
  playerActions,
  whileLoop,
  forLoop,
  forEach,
  switchCase,
  ifElse,
} from '../src/index.js';

import {
  Do,
  FlowControl,
} from '../src/flow/enums.js';

import type { FlowBranchJSON } from '../src/flow/flow.js';
import type { Player } from '../src/player/index.js';

chai.use(spies);
const { expect } = chai;

describe('Flow', () => {
  let testFlow: Flow<Player>;
  let stepSpy1: Function;
  let stepSpy2: Function;
  let actionSpy: Function;
  let playSpy: Function;
  let finishSpy: Function;

  beforeEach(() => {
    stepSpy1 = chai.spy();
    stepSpy2 = chai.spy();
    actionSpy = chai.spy(() => {});
    playSpy = chai.spy((a:any) => {a});
    finishSpy = chai.spy()
    testFlow = new Flow({ name: 'test', do: [
      () => stepSpy1(),
      () => stepSpy2(),
      () => {},
      ifElse({ name: 'step4', if: () => true, do: [
        () => {},
        playerActions({
          name: 'play-or-pass',
          actions: {
            play: a => playSpy(a.play),
            pass: [
              () => {}
            ]
          }
        }),
        () => {}
      ]}),
      () => {}
    ]});
    const game = {
      flow: testFlow,
      players: {
        currentPosition: [1],
        atPosition: () => ({position: 1}),
        setCurrent: () => {}
      },
      action: (a: string) => ({
        play: { _process: actionSpy, _cfg: {messages: []} },
        pass: { _process: () => {}, _cfg: {messages: []} }
      }[a]),
      finish: finishSpy,
    };
    // @ts-ignore mock game
    testFlow.game = game;

    testFlow.reset();
  })
  it('initial', () => {
    expect(testFlow.branchJSON()).to.deep.equal([{ type: 'sequence', name: 'test', position: null, sequence: 0 }]);
  });
  it('setPosition', () => {
    testFlow.setBranchFromJSON([{ type: 'sequence', name: 'test', position: null, sequence: 0 }]);
    expect(testFlow.branchJSON()).to.deep.equals([{ type: 'sequence', name: 'test', position: null, sequence: 0 }]);
  });
  it('play from initial', () => {
    testFlow.playOneStep();
    expect(stepSpy1).to.have.been.called();
    expect(stepSpy2).to.not.have.been.called();
    expect(testFlow.branchJSON()).to.deep.equal([{ type: 'sequence', name: 'test', position: null, sequence: 1 }]);
  });
  it('play twice', () => {
    testFlow.playOneStep();
    testFlow.playOneStep();
    expect(stepSpy1).to.have.been.called();
    expect(stepSpy2).to.have.been.called();
    expect(testFlow.branchJSON()).to.deep.equals([{ type: 'sequence', name: 'test', position: null, sequence: 2 }]);
  });
  it('play from state', () => {
    testFlow.setBranchFromJSON([{ type: 'sequence', name: 'test', position: null, sequence: 1 }]);
    testFlow.playOneStep();
    expect(stepSpy1).not.to.have.been.called();
    expect(stepSpy2).to.have.been.called();
    expect(testFlow.branchJSON()).to.deep.equals([{ type: 'sequence', name: 'test', position: null, sequence: 2 }]);
  });
  it('nested', () => {
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 0 }
    ]);
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 0 }
    ]);
  });
  it('advances into nested', () => {
    testFlow.setBranchFromJSON([{ type: 'sequence', name: 'test', position: null, sequence: 2 }]);
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 0 }
    ]);
  });
  it('advances out of nested', () => {
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 2 }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([{ type: 'sequence', name: 'test', position: null, sequence: 4 }]);
  });
  it('awaits action', () => {
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: null }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: "sequence", name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: null }
    ]);
  });
  it('receives action', () => {
    testFlow.setBranchFromJSON([
      { type: "sequence", name: "test", sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: null }
    ]);
    testFlow.processMove({ action: 'play', args: ['violin'], player: 1 });
    expect(actionSpy).to.have.been.called();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: "sequence", name: "test", sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: { action: 'play', args: ['violin'], player: 1 }}
    ]);
  });
  it('rejects actions out of turn', () => {
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: null }
    ]);
    expect(() => testFlow.processMove({ action: 'play', args: ['violin'], player: 2 })).to.throw;
  });
  it('plays action', () => {
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: { action: 'play', args: ['violin'], player: 1 }}
    ]);
    testFlow.playOneStep();
    expect(playSpy).to.have.been.called.with(['violin']);
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 2 },
    ]);
  });
  it('actions continue into other flows', () => {
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: null }
    ]);
    testFlow.processMove({ action: 'pass', args: [], player: 1 });
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: { action: 'pass', args: [], player: 1 }, sequence: 0 },
    ]);
  });
  it('plays', () => {
    testFlow.play();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: null }
    ]);
    testFlow.processMove({ action: 'pass', args: [], player: 1 });
    testFlow.play();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 4 }
    ]);
    expect(finishSpy).to.have.been.called();
  });
  it('serializes', () => {
    const branch: FlowBranchJSON[] = [
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'switch-case', name: 'step4', position: { index: 0, value: true, default: false }, sequence: 1 },
      { type: 'action', name: 'play-or-pass', position: { action: 'pass', args: [], player: 1 }, sequence: 0 }
    ];
    testFlow.setBranchFromJSON(branch);
    expect(testFlow.branchJSON()).to.deep.equals(branch);
  });
  it('finds by name', () => {
    expect(testFlow.getStep('test')?.name).to.equal('test');
    expect(testFlow.getStep('step4')?.name).to.equal('step4');
    expect(testFlow.getStep('play-or-pass')?.name).to.equal('play-or-pass');
  });
  it('disallows duplicate step names',() => {
    const duplFlow = new Flow({ name: 'test', do: [
      () => stepSpy1(),
      () => stepSpy2(),
      () => {},
      ifElse({ name: 'step4', if: () => true, do: [
        () => {},
        playerActions({
          name: 'test',
          actions: {
            play: a => playSpy(a.play),
            pass: [
              () => {}
            ]
          }
        }),
        () => {}
      ]}),
      () => {}
    ]});
    expect(() => duplFlow.getStep('test')).to.throw;
  });
});

describe('Loop', () => {
  let stepSpy1: Function
  let stepSpy2: Function
  let counter: number
  let loop: Flow<Player>
  let nonLoop: Flow<Player>
  let testFlow: Flow<Player>;
  beforeEach(() => {
    stepSpy1 = chai.spy((x:number) => x);
    stepSpy2 = chai.spy((x:number) => x);
    counter = 10;
    loop = whileLoop({ while: () => counter < 13, do: (
      () => { stepSpy1(counter); counter += 1; }
    )});

    nonLoop = forLoop({ name: 'nonloop', initial: 0, next: loop => loop + 1, while: loop => loop < 0, do: (
      ({ nonloop }) => stepSpy2(nonloop)
    )});

    testFlow = new Flow({ name: 'test', do: [
      () => {},
      loop,
      () => {},
      nonLoop,
      () => {},
    ]});
    // @ts-ignore
    testFlow.game = { flow: testFlow, players: { setCurrent: () => {} } };

    testFlow.reset();
  })

  it('enters loop', () => {
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 0 }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 1 },
      { type: 'loop', position: { index: 0 } }
    ]);
    expect(stepSpy1).to.not.have.been.called;
  });
  it('repeats loop', () => {
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 1 },
      { type: 'loop', position: { index: 0 } }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 1 },
      { type: 'loop', position: { index: 1 } }
    ]);
    expect(stepSpy1).to.have.been.called.with(10);

    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 1 },
      { type: 'loop', position: { index: 2 } }
    ]);
    expect(stepSpy1).to.have.been.called.with(11);
  });
  it('exits loop', () => {
    counter = 12;
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 1 },
      { type: 'loop', position: { index: 2 } }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 2 },
    ]);
  });
  it('skips non-loop', () => {
    testFlow.setBranchFromJSON([
      { type: 'sequence', name: 'test', position: null, sequence: 2 },
    ]);
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 3 },
      { type: 'loop', name: 'nonloop', position: { index: -1, value: 0 } }
    ]);
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'sequence', name: 'test', position: null, sequence: 4 },
    ]);
    expect(stepSpy2).to.not.have.been.called;
  });

  describe('nested', () => {
    let stepSpy: Function;
    let nestedLoop: Flow<Player>;
    beforeEach(() => {
      stepSpy = chai.spy((x: number, y: number) => {x; y});
      nestedLoop = forLoop({
        name: 'x',
        initial: 0,
        next: x => x + 1,
        while: x => x < 3,
        do: forLoop({
          name: 'y',
          initial: 0,
          next: y => y + 1,
          while: y => y < 2,
          do: ({ x, y }) => stepSpy(x, y)
        })
      });

      nestedLoop.reset();
    })

    it ('resets counters', () => {
      while(nestedLoop.playOneStep() === FlowControl.ok) { }
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
      const stepSpy = chai.spy((x:number) => {x});
      const loop = forEach({ name: 'foreach', collection: [3, 5, 7], do: ({ foreach }) => stepSpy(foreach) });
      loop.reset();
      while(loop.playOneStep() === FlowControl.ok) { }
      expect(stepSpy).to.have.been.called.exactly(3);
      expect(stepSpy).on.nth(1).be.called.with(3);
      expect(stepSpy).on.nth(2).be.called.with(5);
      expect(stepSpy).on.nth(3).be.called.with(7);
    });
    it ('resumes', () => {
      const stepSpy = chai.spy((x:number) => {x});
      const loop = forEach({ name: 'foreach', collection: [3, 5, 7], do: ({ foreach }) => stepSpy(foreach) });
      loop.reset();
      loop.setBranchFromJSON([
        {
          type: 'foreach',
          name: 'foreach',
          position: { index: 1, value: 5, collection: [3,5,7] }
        }
      ]);
      loop.playOneStep();
      expect(stepSpy).to.have.been.called.with(5);
      expect(loop.playOneStep()).to.equal(FlowControl.complete);
      expect(stepSpy).to.have.been.called.with(7);
    });
    it ('allows dynamic collection', () => {
      const stepSpy = chai.spy((x:number) => {x});
      const outerLoop = forLoop({ name: 'loop', initial: 1, next: loop => loop + 1, while: loop => loop != 3, do: (
        forEach({ name: 'foreach', collection: ({ loop }) => [10 + loop, 20 + loop], do: ({ foreach }) => stepSpy(foreach) })
      )});
      outerLoop.reset();
      while(outerLoop.playOneStep() === FlowControl.ok) { }
      expect(stepSpy).to.have.been.called.exactly(4);
      expect(stepSpy).on.nth(1).be.called.with(11);
      expect(stepSpy).on.nth(2).be.called.with(21);
      expect(stepSpy).on.nth(3).be.called.with(12);
      expect(stepSpy).on.nth(4).be.called.with(22);
    });
    it ('empty collection', () => {
      const stepSpy = chai.spy((x:number) => {x});
      const empty = forEach({ name: 'foreach', collection: [], do: ({ foreach }) => stepSpy(foreach) });
      empty.reset();
      while(empty.playOneStep() === FlowControl.ok) { }
      expect(stepSpy).not.to.have.been.called;
    });

  });
});

describe('Loop short-circuiting', () => {
  it('can repeat', () => {
    const stepSpy1 = chai.spy((x:number) => x === 12 ? Do.repeat : undefined);
    const stepSpy2 = chai.spy((_: string, x:number) => {x});
    const shortLoop = forLoop({ name: 'loop', initial: 10, next: loop => loop + 1, while: loop => loop < 20, do: [
      ({ loop }) => stepSpy2('start', loop),
      ({ loop }) => stepSpy1(loop),
      ({ loop }) => stepSpy2('end', loop)
    ]});
    shortLoop.reset();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    expect(stepSpy2).to.have.been.called.with('start', 11);
    expect(stepSpy2).to.have.been.called.with('end', 11);
    expect(stepSpy2).to.have.been.called.with('start', 12);
    expect(stepSpy2).not.to.have.been.called.with('end', 12);
    expect(stepSpy2).not.to.have.been.called.with('start', 13);
  });

  it('can skip', () => {
    const stepSpy1 = chai.spy((x:number) => x === 12 ? Do.continue : undefined);
    const stepSpy2 = chai.spy((_: string, x:number) => {x});
    const shortLoop = forLoop({ name: 'loop', initial: 10, next: loop => loop + 1, while: loop => loop < 20, do: [
      ({ loop }) => stepSpy2('start', loop),
      ({ loop }) => stepSpy1(loop),
      ({ loop }) => stepSpy2('end', loop)
    ]});
    shortLoop.reset();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    expect(stepSpy2).to.have.been.called.with('start', 11);
    expect(stepSpy2).to.have.been.called.with('end', 11);
    expect(stepSpy2).to.have.been.called.with('start', 12);
    expect(stepSpy2).not.to.have.been.called.with('end', 12);
    expect(stepSpy2).to.have.been.called.with('start', 13);
  });

  it('can break', () => {
    const stepSpy1 = chai.spy((x:number) => x === 12 ? Do.break : undefined);
    const stepSpy2 = chai.spy((_: string, x:number) => {x});
    const shortLoop = forLoop({ name: 'loop', initial: 10, next: loop => loop + 1, while: loop => loop < 20, do: [
      ({ loop }) => stepSpy2('start', loop),
      ({ loop }) => stepSpy1(loop),
      ({ loop }) => stepSpy2('end', loop)
    ]});
    shortLoop.reset();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    shortLoop.playOneStep();
    const result = shortLoop.playOneStep();
    expect(result).to.equal(FlowControl.complete);
    expect(stepSpy2).to.have.been.called.with('start', 11);
    expect(stepSpy2).to.have.been.called.with('end', 11);
    expect(stepSpy2).to.have.been.called.with('start', 12);
    expect(stepSpy2).not.to.have.been.called.with('end', 12);
    expect(stepSpy2).not.to.have.been.called.with('start', 13);
  });
});

describe('SwitchCase', () => {
  it('switches', () => {
    const stepSpy1 = chai.spy((x:number) => {x});
    const testFlow = forLoop({ name: 'loop', initial: 0, next: loop => loop + 1, while: loop => loop < 3, do: (
      switchCase({ name: 'switcher', switch: ({ loop }) => loop, cases: [
        { eq: 0, do: ({ switcher }) => stepSpy1(switcher) },
        { eq: 1, do: ({ switcher }) => stepSpy1(switcher) },
      ]})
    )});

    // @ts-ignore
    testFlow.game = { flow: testFlow };
    testFlow.reset();

    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 0, value: 0 } },
      { type: 'switch-case', name: 'switcher', position: { index: 0, value: 0, default: false } }
    ]);
    expect(stepSpy1).not.to.have.been.called;
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 1, value: 1 } },
      { type: 'switch-case', name: 'switcher', position: { index: 1, value: 1, default: false } }
    ]);
    expect(stepSpy1).to.have.been.called.with(0);
    expect(testFlow.playOneStep()).to.equal(FlowControl.ok);
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 2, value: 2 } },
      { type: 'switch-case', name: 'switcher', position: { index: -1, value: 2, default: false } }
    ]);
    expect(stepSpy1).to.have.been.called.with(1);
    expect(testFlow.playOneStep()).to.equal(FlowControl.complete);
    expect(stepSpy1).to.have.been.called.exactly(2);
  });

  it('sets position', () => {
    const stepSpy1 = chai.spy((x:number) => {x});
    const testFlow = forLoop({ name: 'loop', initial: 0, next: loop => loop + 1, while: loop => loop < 3, do: (
      switchCase({ name: 'switch', switch: ({ loop }) => loop, cases: [
        { eq: 0, do: () => stepSpy1(0) },
        { eq: 1, do: () => stepSpy1(1) },
      ]})
    )});

    // @ts-ignore
    testFlow.game = { flow: testFlow };
    testFlow.reset();

    testFlow.setBranchFromJSON([
      { type: 'loop', name: 'loop', position: { index: 1, value: 1 } },
      { type: 'switch-case', name: 'switch', position: { index: 1, value: 1, default: false } }
    ]);
    expect(stepSpy1).not.to.have.been.called;
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 2, value: 2 } },
      { type: 'switch-case', name: 'switch', position: { index: -1, value: 2, default: false } }
    ]);
    expect(stepSpy1).to.have.been.called.with(1);
  });

  it('defaults', () => {
    const stepSpy1 = chai.spy((x:number) => {x});
    const testFlow = forLoop({ name: 'loop', initial: 0, next: loop => loop + 1, while: loop => loop < 3, do: (
      switchCase({
        name: 'switch',
        switch: ({ loop }) => loop,
        cases: [
          { eq: 0, do: () => stepSpy1(0) },
          { eq: 1, do: () => stepSpy1(1) },
        ],
        default: () => stepSpy1(-1)
      })
    )});

    // @ts-ignore
    testFlow.game = { flow: testFlow };
    testFlow.reset();

    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 0, value: 0 } },
      { type: 'switch-case', name: 'switch', position: { index: 0, value: 0, default: false } }
    ]);
    expect(stepSpy1).not.to.have.been.called;
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 1, value: 1 } },
      { type: 'switch-case', name: 'switch', position: { index: 1, value: 1, default: false } }
    ]);
    expect(stepSpy1).to.have.been.called.with(0);
    expect(testFlow.playOneStep()).to.equal(FlowControl.ok);
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 2, value: 2 } },
      { type: 'switch-case', name: 'switch', position: { index: -1, value: 2, default: true } }
    ]);
    expect(stepSpy1).to.have.been.called.with(1);
    expect(testFlow.playOneStep()).to.equal(FlowControl.complete);
    expect(stepSpy1).to.have.been.called.with(-1);
    expect(stepSpy1).to.have.been.called.exactly(3);
  });
});

describe('IfElse', () => {
  it('switches', () => {
    const stepSpy1 = chai.spy((x:number) => {x});
    const testFlow = forLoop({
      name: 'loop',
      initial: 0,
      next: loop => loop + 1,
      while: loop => loop < 3,
      do: ifElse({
        name: 'if',
        if: ({ loop }) => loop === 1,
        do: () => stepSpy1(0),
        else: () => stepSpy1(-1)
      })
    });

    // @ts-ignore
    testFlow.game = { flow: testFlow };
    testFlow.reset();

    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 0, value: 0 } },
      { type: 'switch-case', name: 'if', position: { index: -1, default: true, value: false } }
    ]);
    expect(stepSpy1).not.to.have.been.called;
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 1, value: 1 } },
      { type: 'switch-case', name: 'if', position: { index: 0, default: false, value: true } }
    ]);
    expect(stepSpy1).to.have.been.called.with(-1);
    testFlow.playOneStep();
    expect(testFlow.branchJSON()).to.deep.equals([
      { type: 'loop', name: 'loop', position: { index: 2, value: 2 } },
      { type: 'switch-case', name: 'if', position: { index: -1, default: true, value: false } }
    ]);
    expect(stepSpy1).to.have.been.called.with(0);
    testFlow.playOneStep();
    expect(stepSpy1).to.have.been.called.exactly(3);
    expect(stepSpy1).on.nth(1).be.called.with(-1);
    expect(stepSpy1).on.nth(2).be.called.with(0);
    expect(stepSpy1).on.nth(3).be.called.with(-1);
  });
});
