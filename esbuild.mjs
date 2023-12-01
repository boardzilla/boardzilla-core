import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'

await esbuild.build({
  entryPoints: ['./src/ui/assets'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/ui/assets/index.js',
  loader: {
    '.ogg': 'dataurl',
    '.jpg': 'file',
  },
  plugins: [sassPlugin()],
})
