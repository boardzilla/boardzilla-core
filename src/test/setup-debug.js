globalThis.document={
  createElement:() => {},
  createTextNode: ()=>{},
  head: {
    appendChild:() => ({appendChild:() => {}})
  }
};
