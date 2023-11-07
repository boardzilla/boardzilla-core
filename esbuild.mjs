import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'

await esbuild.build({
  entryPoints: ['./ui/assets'],
  bundle: true,
  outfile: 'dist/ui/assets/index.js',
  loader: { '.ogg': 'dataurl' },
  plugins: [sassPlugin({
    "type": "style"
  })],
})