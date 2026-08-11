type TLottieClass = typeof import('./TLottie').default;

let promise: Promise<TLottieClass> | undefined;
let tlottie: TLottieClass | undefined;

// Time for the main interface to completely load
const LOTTIE_LOAD_DELAY = 3000;

export async function ensureTLottie() {
  if (!promise) {
    promise = import('./TLottie').then((module) => module.default);
    tlottie = await promise;
  }

  return promise;
}

export function getTLottie() {
  return tlottie;
}

setTimeout(ensureTLottie, LOTTIE_LOAD_DELAY);
