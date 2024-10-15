export const updateOriginWithBranch = (origin: string) => {
  const urlParams = new URLSearchParams(window.location.search);
  const candidate = urlParams.get("branch") || "";
  const branch = candidate.match(/^([a-z0-9-])+$/i)?.[0]

  if (!branch) return origin;

  const url = new URL(origin);
  url.hostname = `${branch}.${url.hostname}`;
  return url.toString();
};
