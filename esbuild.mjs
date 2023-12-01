import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['./src/ui/assets'],
  bundle: true,
  format: 'esm',
  outdir: 'dist/ui/assets',
  loader: {
    '.ogg': 'file',
    ".jpg": "file",
    ".scss": "file"
  },
})
