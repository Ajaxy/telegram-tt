

export const updateOriginWithBranch = (origin: string) => {
  const urlParams = new URLSearchParams(window.location.search);
  const branch = urlParams.get("branch");

  if (!branch) return origin;

  const url = new URL(origin);
  url.hostname = `${branch}.${url.hostname}`;
  return url.toString();
};
