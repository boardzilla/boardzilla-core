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

check(({ game }) => { // S - game re-enters here with the supplied player action but now on S2
  game.mutate // S1 = this will be double run
  if (game.test()) { // test on S1 is instead on S2+1
    game.mutate // S2
    return action // action choice returned based on S1, S2 but enters flow with response on S2+1 and possibly completely different branch
  } else { // pos [3,4,{step: 0, value: true}]
    return action
  }
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

