# v0.2.10
* Fixed Info and Debug overlays

# v0.2.9
* Removed deprecated index.scss import

# v0.2.8 Stack and Flippable
* Added Stack class for decks within hidden elements and internal moves
* Added Flippable component with back/front and animated flips

# v0.2.7 Animation overhaul
* Overhauled the animation logic that decides how elements move for various
  players, correcting several glitches
* Pieces now animate on to and off of the board, into and out of the bottom of
  decks even if unrendered

# v0.2.6 Subflows
* Subflows allow you to define entire new flows that branch of your main flow,
  e.g. playing a particular Card causes a set of new actions to happen
* Follow-ups are still available but these are now actually just Subflows under
  the hood that automatically perform only a single action
* Some small flow and animation fixes included

# v0.2.5
* Added `action.swap` to allow players to exchange Pieces
* Added `action.reorder` to allow players to reorder a collection of Pieces
* Also made some improvements in the dragging and moving to remove flicker and
  quirkiness

# v0.2.4 Component modules
* Added Component modules. The `D6` class is the first example and it has been
  moved into a separate self-contained import. See
  https://docs.boardzilla.io/game/modules
* It is no longer necessary to include `@boardzilla/core/index.css` in
  `ui/index.tsx`. This line can be removed.
* Added `actionStep.continueIfImpossible` to allow a step to be skipped if no
  actions are valid
* Added `actionStep.repeatUntil` to make a set of actions repeatable until a
  'pass' action
* Added `Player.hiddenAttributes` to make some attributes hidden from other
  players
* Some consistency fixes to prompts.

# v0.2.3
* Board Sizes now accepts more detailed matchers, with a range of "best fit"
  aspect ratios, a setting to choose scrollbars or letterbox and mobile
  orientation fixing
* Show/hide methods moved to Piece only
* Space now has new convenience methods to attach content show/hide event
  handlers
* Space now has "screen" methods to make contents completely invisible to
  players
* Added Test Runner mocks and updatePlayers

# v0.2 Grids
* Added subclasses of `Space` for various grids, including more options for
  square, hex and the brand new PieceGrid. These replace `Space#createGrid`.
* Grids can now be shaped, e.g. to create a hex grid in a square shape
* `PieceGrid` allows the placement and tiling of irregular shapes, with an
  extendible grid that correctly sizes shaped pieces inside it.
* Pieces now have a `setShape` and `setEdges` for adding irregular shapes and
  labelling the cells and edges for the purposes of adjacency.
* Connecting spaces now allows bidirectional distances
* Generics have been given a full rework, removing lots of unnecessary generics
  and making the importing of more game classes more straightfoward and
  extendable.
* `createGameClasses` is gone. `Space` and `Piece` can be imported directly from
  core.
* `Game#registerClasses` is no longer necessary and can be removed.
* `Piece#putInto` now accepts `row`, `column`.
* Now using incremental Typescript compilation for much faster rebuilds
* History reprocessing in development has been completely reworked for much
  better performance
* Added a new associated starter template using PieceGrid and irregular tiles.

# v0.1 Lobby
* Brand new lobby with seating controls, allowing self-seating, async game start
  and better UI.
* renamed `Board` to `Game` and gave this class all exposed API methods that
  were previously in `Game`. `Game` renamed to `GameManager` and intended as an
  internal class.
