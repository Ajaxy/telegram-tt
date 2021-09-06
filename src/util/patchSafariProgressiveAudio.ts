/*
 * Thanks to Ace Monkey for this mind-blowing patch.
 */

export function patchSafariProgressiveAudio(audioEl: HTMLAudioElement) {
  if (audioEl.dataset.patchedForSafari) {
    return;
  }

  audioEl.addEventListener('play', () => {
    const t = audioEl.currentTime;

    audioEl.dataset.patchForSafariInProgress = 'true';
    function onProgress() {
      if (!audioEl.buffered.length) {
        return;
      }
      audioEl.currentTime = audioEl.duration - 1;
      audioEl.addEventListener('progress', () => {
        delete audioEl.dataset.patchForSafariInProgress;
        audioEl.currentTime = t;
        if (audioEl.paused && !audioEl.dataset.preventPlayAfterPatch) {
          audioEl.play();
        }
      }, { once: true });

      audioEl.removeEventListener('progress', onProgress);
    }

    audioEl.addEventListener('progress', onProgress);
  }, { once: true });

  audioEl.dataset.patchedForSafari = 'true';
}

export function isSafariPatchInProgress(audioEl: HTMLAudioElement) {
  return Boolean(audioEl.dataset.patchForSafariInProgress);
}
