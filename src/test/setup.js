globalThis.console.debug = () => {}

globalThis.document={
  createElement:() => {},
  createTextNode: ()=>{},
  head: {
    appendChild:() => ({appendChild:() => {}})
  }
};
