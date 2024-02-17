import chai from 'chai';

import {
  Player,
  Board,
  times,
  createGame,
} from '../index.js';
import { createGameStore } from '../ui/index.js';

import type Game from '../game.js';
import type { SerializedMove } from '../game.js';

import {
  starterGame,
  starterGameWithConfirm,
  starterGameWithValidate,
  starterGameWithCompoundMove,
  starterGameWithTiles,
  starterGameWithTilesConfirm,
  starterGameWithTilesCompound,
  Token
} from './fixtures/games.js';

const history: SerializedMove[] = [];

globalThis.window = {
  clearTimeout: () => {},
  top: { postMessage: ({ data }: { data: SerializedMove }) => history.push(data) }
} as unknown as typeof globalThis.window;

const { expect } = chai;

describe('UI', () => {
  beforeEach(() => history.splice(0, history.length));

  it("presents moves", () => {

    const store = getGameStore(starterGame);

    updateStore(store, 2, {tokens: 4});
    const state = store.getState();

    expect(state.pendingMoves?.[0].name).to.equal('take');
    expect(state.boardPrompt).to.equal('Choose a token');
    expect(Object.values(state.boardSelections).length).to.equal(4);
  });

  it("accepts moves", () => {
    const store = getGameStore(starterGame);

    updateStore(store, 2, {tokens: 4});
    let state = store.getState();
    const token = state.game.board.first(Token)!;
    const clickMoves = state.boardSelections[token.branch()].clickMoves;
    expect(state.pendingMoves?.length).to.equal(1);
    expect(state.pendingMoves?.[0].name).to.equal('take');
    expect(state.pendingMoves?.[0].requireExplicitSubmit).to.be.false;

    state.selectElement(clickMoves, token);
    state = store.getState();

    expect(history.length).to.equal(1);
    expect(history[0].name).to.equal('take');

    expect(state.pendingMoves).to.deep.equal([]);
    expect(state.boardPrompt).to.match(/taking their turn/);
    expect(state.game.board.first('mat')!.all(Token).length).to.equal(1);
    expect(state.game.board.first('pool')!.all(Token).length).to.equal(3);
  });

  it("prompts confirm", () => {
    const store = getGameStore(starterGameWithConfirm);

    updateStore(store, 2, {tokens: 4});
    let state = store.getState();
    let token = state.game.board.first(Token)!;
    const clickMoves = state.boardSelections[token.branch()].clickMoves;
    state.selectElement(clickMoves, token);
    state = store.getState();
    token = state.game.board.first(Token)!;

    expect(history.length).to.equal(0);
    expect(state.selected).to.deep.equal([token]);
    expect(state.pendingMoves?.[0].name).to.equal('take');
    expect(state.boardPrompt).to.equal('Choose a token');
    expect(state.uncommittedArgs.token).to.equal(token);

    state.selectMove(state.pendingMoves?.[0], state.uncommittedArgs);
    state = store.getState();

    expect(history.length).to.equal(1);
    expect(state.pendingMoves).to.deep.equal([]);
  });

  it("validates", () => {
    const store = getGameStore(starterGameWithValidate);

    updateStore(store, 2, {tokens: 4});
    let state = store.getState();
    let token = state.game.board.first(Token)!;
    const clickMoves = state.boardSelections[token.branch()].clickMoves;

    expect(state.boardSelections[token.branch()].error).to.equal('not first');
    expect(clickMoves.length).to.equal(0);
  });

  it("cancels confirm", () => {
    const store = getGameStore(starterGameWithConfirm);

    updateStore(store, 2, {tokens: 4});
    let state = store.getState();
    const token = state.game.board.first(Token)!;
    const clickMoves = state.boardSelections[token.branch()].clickMoves;
    state.selectElement(clickMoves, token);
    state = store.getState();

    expect(history.length).to.equal(0);
    expect(state.selected.length).to.equal(1);
    expect(state.pendingMoves?.[0].name).to.equal('take');
    expect(state.boardPrompt).to.equal('Choose a token');

    state.selectMove();
    state = store.getState();

    expect(history.length).to.equal(0);
    expect(state.game.board.first('mat')!.all(Token).length).to.equal(0);
    expect(state.game.board.first('pool')!.all(Token).length).to.equal(4);
  });

  it("continues compound move", () => {
    const store = getGameStore(starterGameWithCompoundMove);

    updateStore(store, 2, {tokens: 4});
    let state = store.getState();
    let token = state.game.board.first(Token)!;
    const clickMoves = state.boardSelections[token.branch()].clickMoves;
    state.selectElement(clickMoves, token);
    state = store.getState();
    token = state.game.board.first(Token)!;

    expect(history.length).to.equal(0);
    expect(state.selected.length).to.equal(0);
    expect(state.pendingMoves?.[0].name).to.equal('take');
    expect(state.pendingMoves?.[0].args.token).to.equal(token);
    expect(state.pendingMoves?.[0].requireExplicitSubmit).to.be.false;
    expect(state.pendingMoves?.[0].selections[0].type).to.equal('choices');
    expect(state.boardPrompt).to.be.undefined; // falls thru to form since no board moves

    state.selectMove(state.pendingMoves?.[0], {a: 1});
    expect(history.length).to.equal(1);
    expect(state.game.board.first('mat')!.all(Token).length).to.equal(1);
    expect(state.game.board.first('pool')!.all(Token).length).to.equal(3);
  });

  it("places pieces", () => {
    const store = getGameStore(starterGameWithTiles);

    updateStore(store, 2, {tokens: 4});
    let state = store.getState();
    let token = state.game.board.first(Token)!;
    const clickMoves = state.boardSelections[token.branch()].clickMoves;
    state.selectElement(clickMoves, token);
    state = store.getState();

    state.setPlacement({ column: 2, row: 2 });
    token = state.game.board.first(Token)!;

    expect(history.length).to.equal(0);
    expect(state.pendingMoves?.[0].selections[0].type).to.equal('place');
    expect(token.column).to.equal(2);
    expect(token.row).to.equal(2);

    state.selectPlacement({ column: 2, row: 2 });
    expect(history.length).to.equal(1);
    expect(history[0].name).to.equal('take');
    expect(history[0].args.__placement__).to.deep.equal([2, 2]);
    expect(state.game.board.first('mat')!.all(Token).length).to.equal(1);
    expect(state.game.board.first('pool')!.all(Token).length).to.equal(3);
  });

  it("places pieces with confirm", () => {
    const store = getGameStore(starterGameWithTilesConfirm);

    updateStore(store, 2, {tokens: 4});
    let state = store.getState();
    let token = state.game.board.first(Token)!;
    const clickMoves = state.boardSelections[token.branch()].clickMoves;
    state.selectElement(clickMoves, token);
    state = store.getState();

    state.setPlacement({ column: 2, row: 2 });
    state.selectPlacement({ column: 2, row: 2 });

    state = store.getState();
    token = state.game.board.first(Token)!;

    expect(history.length).to.equal(0);
    expect(state.pendingMoves?.[0].selections[0].type).to.equal('place');
    expect(state.pendingMoves?.[0].requireExplicitSubmit).to.be.true;
    expect(token.column).to.equal(2);
    expect(token.row).to.equal(2);
    expect(state.game.board.first('mat')!.all(Token).length).to.equal(1); // ghost piece
    expect(state.game.board.first('pool')!.all(Token).length).to.equal(4);
  });

  it("continues compound place piece", () => {
    const store = getGameStore(starterGameWithTilesCompound);

    updateStore(store, 2, {tokens: 4});
    let state = store.getState();
    let token = state.game.board.first(Token)!;
    const clickMoves = state.boardSelections[token.branch()].clickMoves;
    state.selectElement(clickMoves, token);
    state = store.getState();

    state.setPlacement({ column: 2, row: 2 });
    state.selectPlacement({ column: 2, row: 2 });
    state = store.getState();

    expect(history.length).to.equal(0);
    expect(state.pendingMoves?.[0].args.token).to.equal(token);
    expect(state.pendingMoves?.[0].args.__placement__).to.deep.equal([2, 2]);
    expect(state.pendingMoves?.[0].requireExplicitSubmit).to.be.false;
    expect(state.pendingMoves?.[0].selections[0].type).to.equal('choices');
    expect(state.boardPrompt).to.be.undefined; // falls thru to form since no board moves

    state.selectMove(state.pendingMoves?.[0], {a: 1});
    expect(history.length).to.equal(1);
    expect(state.game.board.first('mat')!.all(Token).length).to.equal(1);
    expect(state.game.board.first('pool')!.all(Token).length).to.equal(3);
  });
});

function getGameStore(gameCreator: (game: Game) => void) {
  const store = createGameStore();
  const setup = createGame(Player, Board, gameCreator);
  store.getState().setSetup(setup);
  return store;
}

function updateStore(store: ReturnType<typeof createGameStore>, players: number, settings: Record<string, any>) {
  const { setup, updateState } = store.getState();

  const playerAttrs = times(players, p => ({
    id: String(p),
    name: String(p),
    position: p,
    host: p === 1,
    color: '',
    avatar: '',
    tokens: 0
  }));

  // initial state
  const game = setup!({
    players: playerAttrs,
    settings,
    rseed: 'rseed',
  })

  game.play();

  let state = (game as Game<Player, Board>).getPlayerStates()[0].state;
  if (state instanceof Array) state = state[state.length - 1];

  updateState({
    type: 'gameUpdate',
    state,
    position: 1,
    currentPlayers: game.players.currentPosition
  });
}
