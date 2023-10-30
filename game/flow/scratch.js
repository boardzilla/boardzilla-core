// https://www.typescriptlang.org/play?strictPropertyInitialization=false&target=7#code/FAGw9mAOAUDewAIEDsCGBbApgLgQcnCgEY8AaRBAYzBBFwG0jSEAmAXXKVQCcBzAZ1yxCkItiIBfchICUAOgBG4SgGs4s0BBjwkaLLgJaSnKjToJGzdiZ4ChIsZJNKwq3CLgVdGHPhEsyLwRbQQRhI2w8VDwpIOpaBiiyfAU8DgoNDWAAMwBXZEoAFwBLMGQEEQAeAEEETAAPQsxkABN+BAAlTGpuFsr+Qu5i5F5mar5crGRCgD5mABU6xua2hHHeSebC5gA5JabW9oGhkZm4PUxmeJBmF1UJIQoL3B2Ta9x5+nTZXAAZLRqC12MzCFG4mEKuW45VgCCCdxUuGg2T+ANqADIwvQVJgAJ4IYYIHZsD5SYLIXHMVAUmYyBAAXhB2QywAkwGAlBAqH47QAYuAAO41fYrdqwCQgnSmZDHXJFMDcaB08UUKoAaRFhwQx2GowQADVNat1ptpmdngg1cwAG6oEC5Xz6r7KoLgyHQlCYAUIflgIUYrE4-GEtUkg0SpUAbhZSBaYGRSJCuGqdMZYVk6dZ7OQXp9gqVcg8SWYlnY8iLqRLeEoZDwLTS8jj0DgqFuGbTqBk7IA9N3CrjIJgEP8oMKGgdVuKFkb2iaptsiTPtYNdSD6aDe0gEajRwHYNi8QTysTSVSKWfcSCAD4IZu2ZMITH7oNHolh+btkHWsDFFpd3tssA-aDggACiY7LFqU4IIs46imsEzzrsS46qcDJrI+gaHoSJ4wRImGwNkAD82DgXuB7Bse75ktSlLkpegHUDKhR1KRlTQcgkwKJg3DMEkMz0rAqDiMwKJCSJCjYCwEiAcADSQAqLHAUOc5bOhqG8AgN6ceg3HcFpCAKBAICYNSBkAApcriPHRhyXI8gglmoNZ+lShaGlZkBA5DryEETmKErodUXkgdUAAiYV+fB0EanBWoaWut6IpaomJnwoTkS+IZhjpemfgg36-gZ4WRZl2HlKGuC5TxNE0qmIK+dUMy2UxAwINkIjYCVlTzHx2R4IlPVLrRZwqFSLR-gykpghCUIwmygEdVo0B4P1NhTe1RZrXCSBIC2pAKPlrU0JghZgLwFBdl2QA

loop([
  () => {},
  loop(),
  playerAction({
    play: loop,
    pass: null
  })
});

flow
  .loop({name:'a', each:[1,2]})
  .do(({ a }) => {
    // do stuff with a
  })
  .loop({name:'b', each:[1,2]})
  .do(({ a, b }) => {
    // do stuff with a,b - this is an inner loop despite appearances!
  })
  .endloop()
  .endloop()
  
  // chain actions
  // play card, target land, then push invader from target land...

  // can't use functions to maintain scope because it allows for mutation outside the view of the flow class.
  // to avoid state-sync issues, actions can never be returned dynamically by impure *functions* in the flow
  // compare:

  branch({
    test: ({ game }) => game.test(),
    cases: [
      {value: true, step }, // pos [3,4,{step: 0, value: true}]
      {value: false, step },
    ],
    default: step // pos [3,4,{default: true}]
  }),

// flow state at this point is e.g. ['main-flow']
() => {
  // non-idempotent code
  game.mutateStuff();
  if (game.test()) {
    return nextPlayerAction({ name: 'next', actions: {...} }); // flow state is now something like ['main-flow', 'next'] ?
    // returning an action is the problem here, since the potent function needs
    // to be re-eval'd to retrieve the action, returng repeat/loop/goto is fine
    // since it's fully captured in the flow state
  }
}),
// so now how, given a state of ['main-flow', 'next'] can the flow rehydrate
// itself to get at the nextPlayerAction without running non-idempotent code

// only works by introducing a "gosub", .e.g:

// flow state at this point is e.g. ['main-flow']
defineFlow({
  main: () => {
    // non-idempotent code
    game.mutateStuff();
    if (game.test()) {
      return 'sub1'; // string or void expected here
    }
  },
  sub1: nextPlayerAction({ name: 'next', actions: {...} });
  // flow state is now something like ['main-flow', 'sub1']
  // when play() through sub1, once it completes it returns back up the call stack
  // to main-flow, just like gosub
}),



check({
  test: () => game.test(),
  case: 



  game.defineFlow(
    [
      {name: 'step1', step: stepSpy1}, // pos [0],
      ({ args }) => stepSpy2(), // pos [1],
      {name: 'step3'}, // pos [2]
      [
        step('substep1'), // pos [3,0]
        step('substep2'),
        playerChooses({
        // pos [3,2]
        play: ({ args, game }) => playSpy(game.lastPlay), // pos [3,2,{action: play, args: []},
        pass: [
          step('pass-step1'), // pos [3,2,{action: 'pass'},0]
          step('pass-step2')
        ]
      }),
      game => game.setPlayer(1),
      branch({
        test: ({ game }) => game.test(),
        cases: [
          {value: true, step }, // pos [3,4,{step: 0, value: true}]
          {value: false, step },
        ],
        default: step // pos [3,4,{default: true}]
      }),
      if({
        test: ({ game }) => game.test(),
        step, // pos [3,5,0]
      }),
      repeat({
        until: game => game.test(),
        step: ({ loop }) => {}, // pos [3,6,{loop: 0}]
      }),
    ],
    step('step5'),
  ]
);

game.defineFlow(
  steps('test', [
    step('step1', stepSpy1),
    step('step2', stepSpy2),
    step('step3'),
    steps('step4', [
      step('substep1'),
      step('substep2'),
      action('play-or-pass', {
        'play': step('play-step', ({ args }) => playSpy(game.lastPlay)),
        'pass': steps('pass-stage', [
          step('pass-step1'),
          step('pass-step2'),
        ]),
      }),
      step('substep3'),
    ]),
    step('step5'),
  ])
);

