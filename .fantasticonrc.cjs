module.exports = {
  inputDir: './src/assets/font-icons',
  outputDir: './src/styles',
  name: 'icons',
  fontTypes: ['woff2', 'woff'],
  assetTypes: ['css', 'scss', 'ts'],
  tag: '',
  normalize: true,
  templates: {
    scss: './dev/icons.scss.hbs',
    css: './dev/icons.css.hbs',
  },
  formatOptions: {
    ts: {
      types: ['literalId'],
      singleQuotes: true,
      literalIdName: 'FontIconName',
    },
  },
  pathOptions: {
    ts: './src/types/icons/font.ts',
  },
};
