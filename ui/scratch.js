UI
- \ author defines UI separate from board? madness lies this way. try with no custom zoom first, maybe react-pinch-zoom
- \ scale/scroll board
- layout ratios
- author defines sidebar placement?


board layout
- UI elements have reasonable defaults
- HTML/SVG
- stack/free/spread layouts describe how pieces lay out
- spread-x/y is this really all you need? stack is just limit-display?
- grid? #x, #y, compress x/y
- spread and grid used for spaces as well
- scrollable?
- layout responsive
- layout changes based on game and user
- dupe space names imply identical in a row
- small functions, not big json/xml blobs
- isometric or hex: v1, v2 (hex v3 = v2 - v1)
- space declare how its children spaces are distributed if unspecified? or just make a good guess based on # of spaces and ignore mixed?
- playermat.first(mine), playermat.all(mine: false), playermat.first(player: {left: 1})
- can elements contain a mix of space+piece? yes if layout rules are independent, overlapping

/*
   Every containing element has a layout strategy. Each layout() declaration on
   that space creates a new layout strategy. Each item placed inside the
   containing element uses one strategy, finding the first that applies, order
   by specific to general, first declared to last.  Each strategy operates
   independently of one another and may therefore overlap.
*/                                                                                                                                        

// method on element(s) to define how items within are distributed
Element/ElementCollection.layout(
  // to which items does this layout strategy apply, e.g. Space, Piece, etc sort by (a,b => a instanceof b)!!
  Class / name / Element / ElementCollection,
  {
    // define area within the container where items will be placed (default {margin: 0})
    margin(n or {t,b,l,r}) // absolute
    - or -
    area: {x,y,w,h} // relative

    // define distribution of cells needed within area (default fluid: { rows: {min: 1}, columns: {min: 1} })

    // fluid, grid expands as more items are added:
    // [   ] [X X] [X X]
    // [ X ] [   ] [X X]
    // [   ] [X X] [X X]

    // fixed, grid size is fixed
    // [X  ] [XXX] [XXX]
    // [   ] [X  ] [XXX]
    // [   ] [   ] [   ]
    
    rows: n | {min?, max?}
    columns: n | {min?, max?}
    horizontalAngle: number // default 0
    verticalAngle: number // default 90
    - or -
    slots: [ {x, y, w, h},... ] // relative

    // define how items resize in their cells (default 'retain')
    // retain: items keep their size no matter what, possibly flowing outside their area and overlapping with others
    // fill: items stretch to fill their space
    // contain: items keep their size but will shrink if insufficient space
    sizing: 'retain' | 'fill' | 'contain'

    // gap between cells. if 'fill' or 'contain' this gap is maintained
    gap: n | {x, y} // absolute

    // if 'fill' or 'contain' (default true)
    keepAspectRatio: boolean

    // hapharzardly arranged (default false)
    hapharzard: boolean,

    // how items order themselves on the grid (default 'square')
    direction: 'ltr' | 'rtl' | 'rtl-btt' | 'ltr-btt' | 'square'

    // whether free movement allowed (default false)
    free: boolean

    // determines overlap of this layout with others (default 0)
    zIndex: n
  }
)

// individual items can specify their relative position, overriding their container's layout strategy
Element.position({x, y})

// desired normal absolute size. if kayout strategy is 'fill' or 'contain' this size may be altered
Element/ElementCollection.size({w, h})

map.position({ top: 0, left: 0 }).size({ width: 100, height: 50 })
resources.layout(
  board.all(ResourceSpace, {resource: 'coal'}),
  {
    area: {
      top: 50, left: 0, height: 10, width: 100
    },
    fixed: {
      rows: 1,
      columns: 16
    }
  }
);

deck.layout(Card, { size: { width: 90, height: 90 } })

  powergridboard
  map
  country...
          resources
  resourceSpace...
          powerplants
  deck
  playerMat...

          addSpace(Space, name, attrs)
  addGrid(rows, cols, Space, name, attrs)
addRow(n, Space, name, attrs)

create(Piece, name, attrs)
createMany(n, Piece, name, attrs)

layout: setLayout => {
  setLayout('map', {});
  setLayout(PlayerMat, {mine: true}, 


board.layout((players, ratio, device) => {
  board.render({
    map: {
      render: 'svg'
    }
  });
  // common
  if (ratio > 2/3) {
    board.ratio(2/3); // just set a container with vmin, everything else is just %
    board.render({
      map: { top: 10, left: 0, width: 100, height: 10 })
      england: layout,
      france: layout,
      cell: { offsetX: 10, offsetY: 10, width: 10, height: 10 }
      ...
    });
    playermat.all(mine: false).render({
      width: 20, // collectively, error if not all siblings
      height: 20,
      offsetLeft: 10
      fillWidth: 100
    });
    // fixed size, fixed gap
    spreadLeft: { margin: 1 }
    // fixed size, spread to fill
    spreadLeft: { fill: 100 }
    // spread size, fixed gap?, to fill
    maxWidth: 20 
    spreadLeft: { fill: 100 }

  } else {
    return {
      map: layout,
      england: layout,
      france: layout,
      ...
    }
  }
  })

PM, PM, PM
===MAP====
==========
==========
resources=
powerplant
-tableau--
