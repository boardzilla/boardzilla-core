const tsNode = require('ts-node');

tsNode.register({
  project: './tsconfig.json',
  ignore: ['.*\.scss', '.*\.ogg']
});
