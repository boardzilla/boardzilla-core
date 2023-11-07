import tsNode from 'ts-node';

tsNode.register({
  project: './tsconfig.json',
  ignore: ['.*\.scss', '.*\.ogg']
});
