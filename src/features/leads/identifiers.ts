const leadPrefix = "LEAD-";

export function leadUidFromId(id: string) {
  const compactId = id.replaceAll("-", "").toUpperCase();
  return `${leadPrefix}${compactId.slice(0, 12)}`;
}

export function displayLeadUid(uid: string | null, id: string) {
  return uid?.trim() || leadUidFromId(id);
}
