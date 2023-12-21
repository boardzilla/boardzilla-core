el.was = the last known location. if this exists and does not match current, we have animations to run
- this gets reset by server.game when json hydrates from sql or when client completes a render

previousRenderedElements = key/pos from state render #previousSeq
- can be looked up with el.was if matching #previousSeq
- add movedTo (inverse of was) to prevent re-animating

renderedElements = key/pos from current state render #currSeq
- can be demoted to pRE if new state with Game.was = #currSeq
- if internal processMove demote this and create new one, increment #seq

intermediate animations need full state1,2,3 to position elements
- send deltas
- position only changed regions?
- selectable, zoomable use non-state update style?
  - simply add selectors


      {selection.type === 'choices' && selection.choices && (
        <>
          {(selection.choices instanceof Array ? selection.choices.map(c => ([c, c])) : Object.entries(selection.choices)).map(([k, v]) => (
            <span key={String(serializeArg(k))}>
              <input
                type="radio"
                id={`${selection.name}--${String(serializeArg(k))}`}
                name={selection.name}
                value={String(serializeArg(k))}
              />
              <label htmlFor={`${selection.name}--${String(serializeArg(k))}`}>{humanizeArg(v)}</label>
            </span>
          ))}
        </>
      )}


board layout setup
- initially needs a breakpoint and then setupLayout, then applyLayouts
- on internal processMove, setupLayout & applyLayouts (updateBoard)
- on setState, rerun setupLayout (to cover recreated pieces. could be optimized but this is a cheap call) then applyLayouts (updateBoard)
- on updateBoard, applyLayouts?
- on breakpoint change, clear layouts

p1 -> sC m1 bc(s[]) dF
pC -> s1 m2 bc(p[]) dI
p2 m3 bc([p2])
rC -> tC m4 bc(r[]) dI, bc(t[]) dF
=>
  p1: m1 sC d: sC
pC1: m2 s1 d: s1 ,c
PC2: m2 s1 d: s1, c
...
 p2: m3 c
sC1: m1 c
sC2: m1 c
...
 r1 m4 d: tC, c
   ..

    state'
  moves: [
    [br, br']
...
Game: computedStyles: {el: cS}
props.anims =>
  set wrap and transform
useEffect(anim, [old, new])


layoutAction('power', {})
layoutStep('power', {})
layoutPrompt('power', {})

layoutAction(
  {
    step: 'power',
    prompt: 'power'
  },
  {}
)


UI
\ author defines UI separate from board? madness lies this way. try with no custom zoom first, maybe react-pinch-zoom
\ scale/scroll board
X layout ratios


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
