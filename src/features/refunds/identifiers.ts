export function refundUidFromId(id: string) {
  return `REF-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export function displayRefundUid(uid: string | null, id: string) {
  return uid ?? refundUidFromId(id);
}
