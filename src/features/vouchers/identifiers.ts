export function voucherUidFromId(id: string) {
  return `VCH-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export function displayVoucherUid(uid: string | null, id: string) {
  return uid ?? voucherUidFromId(id);
}
