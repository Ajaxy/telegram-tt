declare const module: {
  hot?: {
    accept(deps?: string | string[], callback?: () => void): void;
    accept(callback?: () => void): void;
  };
};
