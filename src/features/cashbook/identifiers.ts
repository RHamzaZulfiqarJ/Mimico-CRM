export function cashbookUidFromId(id: string) {
  return `CASH-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export function displayCashbookUid(uid: string | null, id: string) {
  return uid ?? cashbookUidFromId(id);
}
