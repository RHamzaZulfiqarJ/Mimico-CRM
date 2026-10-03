export function payrollUidFromId(id: string) {
  return `PAY-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export function displayPayrollUid(uid: string | null, id: string) {
  return uid ?? payrollUidFromId(id);
}
