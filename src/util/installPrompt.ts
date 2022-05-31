import { getActions } from '../global';

let promptInstall: () => Promise<void>;

export function setupBeforeInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e: any) => {
    promptInstall = async () => {
      e.prompt();
      const userChoice = await e.userChoice;
      const isInstalled = userChoice.outcome === 'accepted';

      if (!isInstalled) return;
      getActions().setInstallPrompt({ canInstall: false });
    };
    getActions().setInstallPrompt({ canInstall: true });
  });
}

export function getPromptInstall() {
  return promptInstall;
}
