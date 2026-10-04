const clientPrefix = "CLIENT-";

export function clientUidFromId(id: string) {
  return `${clientPrefix}${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export function displayClientUid(uid: string | null, id: string) {
  return uid?.trim() || clientUidFromId(id);
}
