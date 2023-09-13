module.exports = {
  inputDir: './src/assets/font-icons',
  outputDir: './src/styles',
  name: 'icons',
  fontTypes: ['woff2', 'woff'],
  assetTypes: ['scss', 'ts'],
  tag: '',
  // Use a custom Handlebars template
  templates: {
    scss: './dev/icons.scss.hbs'
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
