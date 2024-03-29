import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'

await esbuild.build({
  entryPoints: ['./src/index.ts'],
  assetNames: '[name]',
  bundle: true,
  format: 'esm',
  outdir: 'dist/ui/assets/',
  loader: {
    '.ogg': 'dataurl',
    '.jpg': 'file',
  },
  sourcemap: 'inline',
  plugins: [sassPlugin()],
})

await esbuild.build({
  entryPoints: ['./src/components/d6/index.ts'],
  assetNames: '[name]',
  bundle: true,
  format: 'esm',
  outdir: 'dist/components/d6/assets/',
  loader: {
    '.ogg': 'copy',
  },
  sourcemap: 'inline',
  plugins: [sassPlugin()],
})
