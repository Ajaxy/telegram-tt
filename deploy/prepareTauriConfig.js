/* eslint-disable no-null/no-null */
export default function prepareTauriConfig() {
  const config = {
    build: {
      frontendDist: process.env.BASE_URL,
      devUrl: null,
    },
  };

  if (process.env.WITH_UPDATER === 'true') {
    config.plugins = {
      updater: {
        dialog: false,
        endpoints: [process.env.UPDATER_GIST_URL],
        pubkey: process.env.UPDATER_PUBLIC_KEY,
      },
    };

    config.bundle = {
      createUpdaterArtifacts: true,
    };
  }

  return config;
}
