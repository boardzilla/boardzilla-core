globalThis.console.debug = () => {}
globalThis.console.warn = () => {}

globalThis.document={
  createElement:() => {},
  createTextNode: ()=>{},
  head: {
    appendChild:() => ({appendChild:() => {}})
  }
};
