// let allControls: Record<string, {moves: PendingMove<Player>[], style: CSSProperties}> = {};

// //....

// for (const control of Object.keys(allControls)) {
//   if (!(control in layouts)) {
//     setTimeout(() => {
//       if (allControls[control]?.style.opacity === 0) {
//         delete allControls[control];
//       }
//     }, 400);
//     layouts[control] = allControls[control];
//     layouts[control].style = {
//       ...layouts[control].style,
//       transition: 'opacity .2s, filter .2s, transform .4s',
//       opacity: 0,
//       filter: 'blur(2em)',
//       transform: 'translate(-40vw, 0)',
//     };
//   }
// }
// allControls = {...layouts};
// return layouts;
