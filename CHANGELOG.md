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
