import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'

await esbuild.build({
  entryPoints: ['./src/ui/assets'],
  assetNames: '[name]',
  bundle: true,
  format: 'esm',
  outfile: 'dist/ui/assets/index.js',
  loader: {
    '.ogg': 'dataurl',
    '.jpg': 'file',
  },
  sourcemap: 'inline',
  plugins: [sassPlugin()],
})
