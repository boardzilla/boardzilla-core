import {
  Player,
  Board,
  createBoardClasses,
} from '../../index.js';
import type Game from '../../game.js';

export class TestPlayer extends Player<TestPlayer, TestBoard> {
  tokens: number = 0;
}

export class TestBoard extends Board<TestPlayer, TestBoard> {
  tokens: number = 0;
}

const { Space, Piece } = createBoardClasses<TestPlayer, TestBoard>();

export class Token extends Piece {
  color: 'red' | 'blue';
}

const gameFactory = (creator: (game: Game<TestPlayer, TestBoard>) => void) => (game: Game<TestPlayer, TestBoard>) => {
  const { board } = game;
  const { playerActions, loop, eachPlayer } = game.flowCommands;
  board.registerClasses(Token);

  for (const player of game.players) {
    const mat = board.create(Space, 'mat', { player });
    mat.onEnter(Token, t => t.showToAll());
  }

  board.create(Space, 'pool');
  $.pool.onEnter(Token, t => t.hideFromAll());
  $.pool.createMany(game.setting('tokens') - 1, Token, 'blue', { color: 'blue' });
  $.pool.create(Token, 'red', { color: 'red' });

  game.defineFlow(
    loop(
      eachPlayer({
        name: 'player',
        do: playerActions({
          actions: ['take']
        }),
      })
    )
  );

  creator(game);
}


export const starterGame = gameFactory(game => {
  game.defineActions({
    take: player => game.action({
      prompt: 'Choose a token',
    }).chooseOnBoard(
      'token', $.pool.all(Token),
    ).move(
      'token', player.my('mat')!
    ).message(
      `{{player}} drew a {{token}} token.`
    ).do(({ token }) => {
      if (token.color === 'red') {
        game.message("{{player}} wins!", { player });
        game.finish(player);
      }
    }),
  });
});

export const starterGameWithConfirm = gameFactory(game => {
  game.defineActions({
    take: player => game.action({
      prompt: 'Choose a token',
    }).chooseOnBoard(
      'token', $.pool.all(Token),
      { confirm: 'confirm?' }
    ).move(
      'token', player.my('mat')!,
    ),
  });
});

export const starterGameWithValidate = gameFactory(game => {
  game.defineActions({
    take: player => game.action({
      prompt: 'Choose a token',
    }).chooseOnBoard(
      'token', $.pool.all(Token),
      { validate: ({ token }) => token.container()!.first(Token) === token ? 'not first' : undefined }
    ).move(
      'token', player.my('mat')!,
    ),
  });
});

export const starterGameWithCompoundMove = gameFactory(game => {
  game.defineActions({
    take: player => game.action({
      prompt: 'Choose a token',
    }).chooseOnBoard(
      'token', $.pool.all(Token),
    ).move(
      'token', player.my('mat')!
    ).chooseFrom(
      'a', [1,2]
    ),
  });
});

export const starterGameWithTiles = gameFactory(game => {
  game.defineActions({
    take: player => game.action({
      prompt: 'Choose a token',
    }).chooseOnBoard(
      'token', $.pool.all(Token),
    ).placePiece(
      'token', player.my('mat')!
    ),
  });
});

export const starterGameWithTilesConfirm = gameFactory(game => {
  game.defineActions({
    take: player => game.action({
      prompt: 'Choose a token',
    }).chooseOnBoard(
      'token', $.pool.all(Token),
    ).placePiece(
      'token', player.my('mat')!,
      { confirm: "confirm placement?" }
    ),
  });
});

export const starterGameWithTilesValidate = gameFactory(game => {
  game.defineActions({
    take: player => game.action({
      prompt: 'Choose a token',
    }).chooseOnBoard(
      'token', $.pool.all(Token),
    ).placePiece(
      'token', player.my('mat')!,
      { validate: ({ token }) => (token.column + token.row) % 2 !== 0 ? 'must be black square' : undefined, }
    ),
  });
});

export const starterGameWithTilesCompound = gameFactory(game => {
  game.defineActions({
    take: player => game.action({
      prompt: 'Choose a token',
    }).chooseOnBoard(
      'token', $.pool.all(Token),
    ).placePiece(
      'token', player.my('mat')!,
    ).chooseFrom(
      'a', [1,2]
    ),
  });
});
