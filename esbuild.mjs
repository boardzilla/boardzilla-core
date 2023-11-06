import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'

await esbuild.build({
  entryPoints: ['index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  loader: { '.ogg': 'base64' },
  plugins: [sassPlugin({
    "type": "style"
  })],
})