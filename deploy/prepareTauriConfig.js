/* eslint-disable no-null/no-null */
export default function prepareTauriConfig() {
  const config = {
    build: {
      frontendDist: process.env.BASE_URL,
      devUrl: null,
    },
    bundle: {
      windows: {},
    },
    identifier: 'org.telegram.TelegramAir',
  };

  if (process.env.WITH_UPDATER === 'true') {
    config.plugins = {
      updater: {
        dialog: false,
        endpoints: [process.env.UPDATER_GIST_URL],
        pubkey: process.env.UPDATER_PUBLIC_KEY,
      },
    };

    config.bundle.createUpdaterArtifacts = true;
  }

  if (process.env.KEYPAIR_ALIAS) {
    // eslint-disable-next-line @stylistic/max-len
    config.bundle.windows.signCommand = `smctl.exe sign --keypair-alias=${process.env.KEYPAIR_ALIAS} --simple --input %1`;
  }

  return config;
}
