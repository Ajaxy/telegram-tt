export default function (api) {
  api.cache(true);

  const presets = [
    '@babel/typescript',
    '@babel/preset-env',
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
        importSource: '@teact',
      },
    ],
  ];

  return {
    presets,
  };
}
