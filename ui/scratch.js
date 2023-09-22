addSpace(Space, name, attrs)
addGrid(rows, cols, Space, name, attrs)
addRow(n, Space, name, attrs)

create(Piece, name, attrs)
createMany(n, Piece, name, attrs)

layout((ratio, device) => {
  if (ratio > 2/3) {
    return {
      map: { render: 'svg', top: 10, left: 0, width: 100, height: 10 }
      england: layout,
      france: layout,
      cell: { offsetX: 10, offsetY: 10, width: 10, height: 10 }
      ...
    }
  } else {
    return {
      map: layout,
      england: layout,
      france: layout,
      ...
    }
  }
})
