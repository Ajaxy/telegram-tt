export default function (api) {
  api.cache(true);

  const isTest = process.env.APP_ENV === 'test';
  const isMocked = Boolean(process.env.APP_MOCKED_CLIENT);

  const presets = [
    '@babel/typescript',
    '@babel/preset-env',
    '@babel/preset-react',
  ];

  const plugins = [
    ...(isTest && !isMocked ? ['babel-plugin-transform-import-meta'] : []),
  ];

  return {
    presets,
    plugins,
  };
}
