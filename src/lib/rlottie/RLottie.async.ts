type RLottieClass = typeof import('./RLottie').default;

let promise: Promise<RLottieClass> | undefined;
let RLottie: RLottieClass;

// Time for the main interface to completely load
const LOTTIE_LOAD_DELAY = 3000;

export async function ensureRLottie() {
  if (!promise) {
    promise = import('./RLottie').then((module) => module.default);
    RLottie = await promise;
  }

  return promise;
}

export function getRLottie() {
  return RLottie;
}

setTimeout(ensureRLottie, LOTTIE_LOAD_DELAY);
