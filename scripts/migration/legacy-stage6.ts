import {
  parseMongoExport,
  type MongoDocument,
  type RejectedRecord,
} from "./legacy-stage3";
import { mongoId } from "./legacy-stage4";

export { mongoId, parseMongoExport };
export type { MongoDocument };

type ApprovalStatus = "UNDER_PROCESS" | "ACCEPTED" | "REJECTED";
type CashDirection = "IN" | "OUT";

export type PlannedSale = {
  legacyMongoId: string;
  leadLegacyMongoId?: string;
  staffLegacyProfileId?: string;
  uid?: string;
  staffName?: string;
  clientName?: string;
  paymentType?: string;
  referenceNumber?: string;
  netPrice?: string;
  receivedAmount?: string;
  profit?: string;
  createdAt: string;
  updatedAt?: string;
};

export type PlannedCashbookEntry = {
  legacyMongoId: string;
  leadLegacyMongoId?: string;
  projectLegacyMongoId?: string;
  staffLegacyProfileId?: string;
  uid?: string;
  direction: CashDirection;
  branch?: string;
  staffName?: string;
  clientName?: string;
  remarks?: string;
  paymentType?: string;
  referenceNumber?: string;
  amount: string;
  occurredAt: string;
  createdAt: string;
  updatedAt?: string;
};

export type PlannedVoucher = {
  legacyMongoId: string;
  allocatedToLegacyProfileId?: string;
  projectLegacyMongoId?: string;
  approvalLegacyMongoId?: string;
  uid?: string;
  issuingDate?: string;
  dueDate?: string;
  branch?: string;
  clientName?: string;
  cnic?: string;
  phone?: string;
  email?: string;
  type?: string;
  cheque?: string;
  propertyType?: string;
  area?: string;
  total?: string;
  paid?: string;
  remaining?: string;
  note?: string;
  status: ApprovalStatus;
  createdAt: string;
  updatedAt?: string;
};

export type PlannedRefund = {
  legacyMongoId: string;
  leadLegacyMongoId?: string;
  requestedByLegacyProfileId?: string;
  approvalLegacyMongoId?: string;
  legacyNotificationId?: string;
  uid?: string;
  branch?: string;
  amount: string;
  clientName: string;
  cnic?: string;
  phone: string;
  reason: string;
  status: ApprovalStatus;
  decidedAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type PlannedDeductionPolicy = {
  legacyMongoId: string;
  lateArrivals: number;
  halfDays: number;
  daysOff: number;
  effectiveFrom: string;
  createdAt: string;
  updatedAt?: string;
};

export type PlannedPayrollTranscript = {
  legacyMongoId: string;
  profileLegacyMongoId?: string;
  uid?: string;
  employeeName: string;
  designation?: string;
  phone?: string;
  payPeriodStart: string;
  salaryType?: string;
  totalSalary?: string;
  lateArrivals?: number;
  halfDays?: number;
  daysOff?: number;
  amountPerDayOff?: string;
  netSalary?: string;
  createdAt: string;
  updatedAt?: string;
};

export type FinanceTotals = Record<
  | "salesNetPrice"
  | "salesReceivedAmount"
  | "salesProfit"
  | "cashIn"
  | "cashOut"
  | "voucherTotal"
  | "voucherPaid"
  | "voucherRemaining"
  | "refundAmount"
  | "payrollGross"
  | "payrollNet",
  string
>;

export type Stage6Plan = {
  sales: PlannedSale[];
  cashbookEntries: PlannedCashbookEntry[];
  vouchers: PlannedVoucher[];
  refunds: PlannedRefund[];
  deductionPolicies: PlannedDeductionPolicy[];
  payrollTranscripts: PlannedPayrollTranscript[];
  totals: FinanceTotals;
  rejected: RejectedRecord[];
  warnings: string[];
  sourceCounts: Record<
    "sales" | "cashbooks" | "vouchers" | "refunds" | "deductions" | "transcripts",
    number
  >;
};

export type Stage6BuildOptions = {
  knownProfileLegacyIds?: ReadonlySet<string>;
  knownLeadLegacyIds?: ReadonlySet<string>;
  knownProjectLegacyIds?: ReadonlySet<string>;
  staffLegacyIdByName?: ReadonlyMap<string, string | null>;
  leadAssigneesById?: ReadonlyMap<string, readonly string[]>;
};

function isDocument(value: unknown): value is MongoDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function supplied(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function date(value: unknown): string | undefined {
  let candidate = value;
  if (isDocument(candidate) && "$date" in candidate) candidate = candidate.$date;
  if (isDocument(candidate) && "$numberLong" in candidate) candidate = candidate.$numberLong;
  if (typeof candidate !== "string" && typeof candidate !== "number") return undefined;
  const normalized = typeof candidate === "string" && /^-?\d{11,}$/.test(candidate)
    ? Number(candidate)
    : candidate;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function dateOnly(value: unknown): string | undefined {
  const candidate = text(value);
  if (!candidate) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(candidate);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return undefined;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function money(value: unknown, allowNegative = false): string | undefined {
  if (!supplied(value)) return undefined;
  const candidate = text(value);
  if (!candidate || !/^-?\d{1,16}(?:\.\d{1,2})?$/.test(candidate)) return undefined;
  if (!allowNegative && candidate.startsWith("-")) return undefined;
  const [whole, fraction = ""] = candidate.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

function cents(value: string) {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction] = unsigned.split(".");
  const amount = BigInt(whole) * BigInt(100) + BigInt(fraction);
  return negative ? -amount : amount;
}

function fromCents(value: bigint) {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}

function nonNegativeInteger(value: unknown): number | undefined {
  if (!supplied(value)) return undefined;
  const candidate = typeof value === "number" ? value : Number(text(value));
  return Number.isInteger(candidate) && candidate >= 0 && candidate <= 2_147_483_647
    ? candidate
    : undefined;
}

function status(value: unknown): ApprovalStatus | undefined {
  const normalized = text(value)?.toLowerCase().replaceAll(/[^a-z]/g, "");
  return ({
    underprocess: "UNDER_PROCESS",
    pending: "UNDER_PROCESS",
    accepted: "ACCEPTED",
    approved: "ACCEPTED",
    rejected: "REJECTED",
    declined: "REJECTED",
  } as Record<string, ApprovalStatus>)[normalized ?? ""];
}

function direction(value: unknown): CashDirection | undefined {
  const normalized = text(value)?.toLowerCase();
  if (normalized === "in") return "IN";
  if (normalized === "out") return "OUT";
  return undefined;
}

function reject(
  rejected: RejectedRecord[],
  collection: string,
  document: MongoDocument,
  reason: string,
) {
  rejected.push({ collection, legacyMongoId: mongoId(document._id), reason });
}

function uniqueId(
  seen: Set<string>,
  collection: string,
  document: MongoDocument,
  rejected: RejectedRecord[],
) {
  const id = mongoId(document._id);
  if (!id) {
    reject(rejected, collection, document, "Missing MongoDB _id.");
    return undefined;
  }
  if (seen.has(id)) {
    reject(rejected, collection, document, `Duplicate legacy ID: ${id}.`);
    return undefined;
  }
  seen.add(id);
  return id;
}

function claimUid(
  uidSet: Set<string>,
  collection: string,
  document: MongoDocument,
  rejected: RejectedRecord[],
) {
  const uid = text(document.uid);
  if (!uid) return undefined;
  const key = uid.toLowerCase();
  if (uidSet.has(key)) {
    reject(rejected, collection, document, `Duplicate uid: ${uid}.`);
    return null;
  }
  uidSet.add(key);
  return uid;
}

function timestamps(
  collection: string,
  document: MongoDocument,
  rejected: RejectedRecord[],
) {
  const createdAt = date(document.createdAt);
  const updatedAt = date(document.updatedAt);
  if (!createdAt) {
    reject(rejected, collection, document, "Missing or invalid createdAt timestamp.");
    return undefined;
  }
  if (supplied(document.updatedAt) && !updatedAt) {
    reject(rejected, collection, document, "Invalid updatedAt timestamp.");
    return undefined;
  }
  return { createdAt, updatedAt };
}

export function staffLookupKey(value: string) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function staffReference(
  name: string | undefined,
  collection: string,
  id: string,
  options: Stage6BuildOptions,
  warnings: string[],
) {
  if (!name || !options.staffLegacyIdByName) return undefined;
  const match = options.staffLegacyIdByName.get(staffLookupKey(name));
  if (match === null) {
    warnings.push(`${collection}:${id} staff name ${name} is ambiguous; the profile link will be unset.`);
    return undefined;
  }
  if (!match) {
    warnings.push(`${collection}:${id} staff name ${name} was not found; the profile link will be unset.`);
    return undefined;
  }
  return match;
}

function optionalReference(
  value: unknown,
  known: ReadonlySet<string> | undefined,
  label: string,
  collection: string,
  document: MongoDocument,
  rejected: RejectedRecord[],
) {
  const id = mongoId(value);
  if (id && known && !known.has(id)) {
    reject(rejected, collection, document, `${label} ${id} is missing from its reference export.`);
    return null;
  }
  return id;
}

const monthNumbers: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function payPeriod(value: unknown, createdAt: string) {
  const candidate = text(value);
  if (!candidate) return undefined;
  const numeric = /^(\d{4})-(\d{1,2})$/.exec(candidate);
  if (numeric) {
    const month = Number(numeric[2]);
    return month >= 1 && month <= 12
      ? `${numeric[1]}-${String(month).padStart(2, "0")}-01`
      : undefined;
  }
  const namedWithYear = /^([a-z]+)\s+(\d{4})$/i.exec(candidate);
  if (namedWithYear) {
    const month = monthNumbers[namedWithYear[1].toLowerCase()];
    return month ? `${namedWithYear[2]}-${String(month).padStart(2, "0")}-01` : undefined;
  }
  const month = monthNumbers[candidate.toLowerCase()];
  if (!month) return undefined;
  const created = new Date(createdAt);
  const createdMonth = created.getUTCMonth() + 1;
  const year = month > createdMonth ? created.getUTCFullYear() - 1 : created.getUTCFullYear();
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function approvalData(document: MongoDocument) {
  return isDocument(document.data) ? document.data : undefined;
}

function approvalMatches(
  approvals: MongoDocument[],
  type: "voucher" | "refund",
  predicate: (data: MongoDocument) => boolean,
) {
  return approvals.filter((document) =>
    text(document.type)?.toLowerCase() === type
    && Boolean(approvalData(document) && predicate(approvalData(document)!)));
}

function totalsFor(plan: Omit<Stage6Plan, "totals">): FinanceTotals {
  const sum = (values: Array<string | undefined>) => fromCents(
    values.reduce((total, value) => total + (value ? cents(value) : BigInt(0)), BigInt(0)),
  );
  return {
    salesNetPrice: sum(plan.sales.map((item) => item.netPrice)),
    salesReceivedAmount: sum(plan.sales.map((item) => item.receivedAmount)),
    salesProfit: sum(plan.sales.map((item) => item.profit)),
    cashIn: sum(plan.cashbookEntries.filter((item) => item.direction === "IN").map((item) => item.amount)),
    cashOut: sum(plan.cashbookEntries.filter((item) => item.direction === "OUT").map((item) => item.amount)),
    voucherTotal: sum(plan.vouchers.map((item) => item.total)),
    voucherPaid: sum(plan.vouchers.map((item) => item.paid)),
    voucherRemaining: sum(plan.vouchers.map((item) => item.remaining)),
    refundAmount: sum(plan.refunds.map((item) => item.amount)),
    payrollGross: sum(plan.payrollTranscripts.map((item) => item.totalSalary)),
    payrollNet: sum(plan.payrollTranscripts.map((item) => item.netSalary)),
  };
}

export function buildStage6Plan(
  collections: {
    sales?: MongoDocument[];
    cashbooks?: MongoDocument[];
    vouchers?: MongoDocument[];
    refunds?: MongoDocument[];
    deductions?: MongoDocument[];
    transcripts?: MongoDocument[];
    approvals?: MongoDocument[];
  },
  options: Stage6BuildOptions = {},
): Stage6Plan {
  const rejected: RejectedRecord[] = [];
  const warnings: string[] = [];
  const sales: PlannedSale[] = [];
  const cashbookEntries: PlannedCashbookEntry[] = [];
  const vouchers: PlannedVoucher[] = [];
  const refunds: PlannedRefund[] = [];
  const deductionPolicies: PlannedDeductionPolicy[] = [];
  const payrollTranscripts: PlannedPayrollTranscript[] = [];
  const seenIds = {
    sales: new Set<string>(), cashbooks: new Set<string>(), vouchers: new Set<string>(),
    refunds: new Set<string>(), deductions: new Set<string>(), transcripts: new Set<string>(),
  };
  const seenUids = {
    sales: new Set<string>(), cashbooks: new Set<string>(), vouchers: new Set<string>(),
    refunds: new Set<string>(), transcripts: new Set<string>(),
  };
  const approvals = collections.approvals ?? [];
  const claimedApprovalIds = new Set<string>();

  for (const document of collections.sales ?? []) {
    const id = uniqueId(seenIds.sales, "sales", document, rejected);
    if (!id) continue;
    const uid = claimUid(seenUids.sales, "sales", document, rejected);
    if (uid === null) continue;
    const mappedTimestamps = timestamps("sales", document, rejected);
    if (!mappedTimestamps) continue;
    const leadLegacyMongoId = optionalReference(document.leadId, options.knownLeadLegacyIds, "Lead", "sales", document, rejected);
    if (leadLegacyMongoId === null) continue;
    const netPrice = money(document.netPrice);
    const receivedAmount = money(document.receivedAmount);
    const sourceProfit = money(document.profit, true);
    if (supplied(document.netPrice) && !netPrice) { reject(rejected, "sales", document, "Invalid netPrice."); continue; }
    if (supplied(document.receivedAmount) && !receivedAmount) { reject(rejected, "sales", document, "Invalid receivedAmount."); continue; }
    if (supplied(document.profit) && !sourceProfit) { reject(rejected, "sales", document, "Invalid profit."); continue; }
    const calculatedProfit = netPrice && receivedAmount
      ? fromCents(cents(receivedAmount) - cents(netPrice))
      : undefined;
    if (sourceProfit && calculatedProfit && sourceProfit !== calculatedProfit) {
      reject(rejected, "sales", document, `Profit ${sourceProfit} does not equal receivedAmount - netPrice (${calculatedProfit}).`);
      continue;
    }
    const staffName = text(document.staff);
    sales.push({
      legacyMongoId: id,
      leadLegacyMongoId,
      staffLegacyProfileId: staffReference(staffName, "sales", id, options, warnings),
      uid,
      staffName,
      clientName: text(document.clientName),
      paymentType: text(document.paymentType),
      referenceNumber: text(document.number),
      netPrice,
      receivedAmount,
      profit: calculatedProfit ?? sourceProfit,
      ...mappedTimestamps,
    });
  }

  for (const document of collections.cashbooks ?? []) {
    const id = uniqueId(seenIds.cashbooks, "cashbooks", document, rejected);
    if (!id) continue;
    const uid = claimUid(seenUids.cashbooks, "cashbooks", document, rejected);
    if (uid === null) continue;
    const mappedTimestamps = timestamps("cashbooks", document, rejected);
    if (!mappedTimestamps) continue;
    const mappedDirection = direction(document.type);
    const amount = money(document.amount);
    if (!mappedDirection) { reject(rejected, "cashbooks", document, "Missing or unsupported cash direction."); continue; }
    if (!amount || cents(amount) <= BigInt(0)) { reject(rejected, "cashbooks", document, "Amount must be a positive two-decimal value."); continue; }
    const leadLegacyMongoId = optionalReference(document.leadId, options.knownLeadLegacyIds, "Lead", "cashbooks", document, rejected);
    if (leadLegacyMongoId === null) continue;
    const projectLegacyMongoId = optionalReference(document.project, options.knownProjectLegacyIds, "Project", "cashbooks", document, rejected);
    if (projectLegacyMongoId === null) continue;
    const staffName = text(document.staff);
    cashbookEntries.push({
      legacyMongoId: id,
      leadLegacyMongoId,
      projectLegacyMongoId,
      staffLegacyProfileId: staffReference(staffName, "cashbooks", id, options, warnings),
      uid,
      direction: mappedDirection,
      branch: text(document.branch),
      staffName,
      clientName: text(document.clientName),
      remarks: text(document.remarks),
      paymentType: text(document.top),
      referenceNumber: text(document.number),
      amount,
      occurredAt: mappedTimestamps.createdAt,
      ...mappedTimestamps,
    });
  }

  for (const document of collections.vouchers ?? []) {
    const id = uniqueId(seenIds.vouchers, "vouchers", document, rejected);
    if (!id) continue;
    const uid = claimUid(seenUids.vouchers, "vouchers", document, rejected);
    if (uid === null) continue;
    const mappedTimestamps = timestamps("vouchers", document, rejected);
    if (!mappedTimestamps) continue;
    const mappedStatus = status(document.status ?? "underProcess");
    if (!mappedStatus) { reject(rejected, "vouchers", document, "Unsupported voucher status."); continue; }
    const allocatedToLegacyProfileId = optionalReference(document.allocatedTo, options.knownProfileLegacyIds, "Profile", "vouchers", document, rejected);
    if (allocatedToLegacyProfileId === null) continue;
    const projectLegacyMongoId = optionalReference(document.project, options.knownProjectLegacyIds, "Project", "vouchers", document, rejected);
    if (projectLegacyMongoId === null) continue;
    const issuingDate = dateOnly(document.issuingDate);
    const dueDate = dateOnly(document.dueDate);
    if (supplied(document.issuingDate) && !issuingDate) { reject(rejected, "vouchers", document, "Invalid issuingDate."); continue; }
    if (supplied(document.dueDate) && !dueDate) { reject(rejected, "vouchers", document, "Invalid dueDate."); continue; }
    const total = money(document.total);
    const paid = money(document.paid);
    const sourceRemaining = money(document.remained);
    if (supplied(document.total) && !total) { reject(rejected, "vouchers", document, "Invalid total."); continue; }
    if (supplied(document.paid) && !paid) { reject(rejected, "vouchers", document, "Invalid paid amount."); continue; }
    if (supplied(document.remained) && !sourceRemaining) { reject(rejected, "vouchers", document, "Invalid remained amount."); continue; }
    const calculatedRemaining = total && paid ? fromCents(cents(total) - cents(paid)) : undefined;
    if (calculatedRemaining && cents(calculatedRemaining) < BigInt(0)) {
      reject(rejected, "vouchers", document, "Paid amount exceeds the voucher total.");
      continue;
    }
    if (sourceRemaining && calculatedRemaining && sourceRemaining !== calculatedRemaining) {
      reject(rejected, "vouchers", document, `Remaining ${sourceRemaining} does not equal total - paid (${calculatedRemaining}).`);
      continue;
    }
    const matches = uid
      ? approvalMatches(approvals, "voucher", (data) => text(data.uid)?.toLowerCase() === uid.toLowerCase())
      : [];
    if (matches.length > 1) {
      reject(rejected, "vouchers", document, `Multiple voucher approvals match uid ${uid}.`);
      continue;
    }
    const approvalLegacyMongoId = matches.length === 1 ? mongoId(matches[0]._id) : undefined;
    if (approvalLegacyMongoId && claimedApprovalIds.has(approvalLegacyMongoId)) {
      reject(rejected, "vouchers", document, `Approval ${approvalLegacyMongoId} is already matched to another finance record.`);
      continue;
    }
    if (approvalLegacyMongoId) claimedApprovalIds.add(approvalLegacyMongoId);
    if (matches.length === 1 && status(matches[0].status ?? "underProcess") !== mappedStatus) {
      warnings.push(`vouchers:${id} approval status differs; apply will synchronize it to ${mappedStatus}.`);
    }
    vouchers.push({
      legacyMongoId: id,
      allocatedToLegacyProfileId,
      projectLegacyMongoId,
      approvalLegacyMongoId,
      uid,
      issuingDate,
      dueDate,
      branch: text(document.branch),
      clientName: text(document.clientName),
      cnic: text(document.CNIC),
      phone: text(document.phone),
      email: text(document.email)?.toLowerCase(),
      type: text(document.type),
      cheque: text(document.cheque),
      propertyType: text(document.propertyType),
      area: text(document.area),
      total,
      paid,
      remaining: calculatedRemaining ?? sourceRemaining,
      note: text(document.note),
      status: mappedStatus,
      ...mappedTimestamps,
    });
  }

  for (const document of collections.refunds ?? []) {
    const id = uniqueId(seenIds.refunds, "refunds", document, rejected);
    if (!id) continue;
    const uid = claimUid(seenUids.refunds, "refunds", document, rejected);
    if (uid === null) continue;
    const mappedTimestamps = timestamps("refunds", document, rejected);
    if (!mappedTimestamps) continue;
    const mappedStatus = status(document.status ?? "underProcess");
    const amount = money(document.amount);
    const clientName = text(document.clientName);
    const phone = text(document.phone);
    const reason = text(document.reason);
    if (!mappedStatus) { reject(rejected, "refunds", document, "Unsupported refund status."); continue; }
    if (!amount || cents(amount) <= BigInt(0)) { reject(rejected, "refunds", document, "Amount must be a positive two-decimal value."); continue; }
    if (!clientName || !phone || !reason) { reject(rejected, "refunds", document, "Missing clientName, phone, or reason."); continue; }
    const leadLegacyMongoId = optionalReference(document.leadId, options.knownLeadLegacyIds, "Lead", "refunds", document, rejected);
    if (leadLegacyMongoId === null) continue;
    const assignees = leadLegacyMongoId ? options.leadAssigneesById?.get(leadLegacyMongoId) ?? [] : [];
    const requestedByLegacyProfileId = assignees.length === 1 ? assignees[0] : undefined;
    if (leadLegacyMongoId && options.leadAssigneesById && assignees.length !== 1) {
      warnings.push(`refunds:${id} requester cannot be inferred from ${assignees.length} lead assignees; it will be unset.`);
    }
    const matches = leadLegacyMongoId
      ? approvalMatches(approvals, "refund", (data) => {
          const approvalLeadId = mongoId(data.leadId);
          const approvalAmount = money(data.amount);
          return approvalLeadId === leadLegacyMongoId
            && approvalAmount === amount
            && staffLookupKey(text(data.clientName) ?? "") === staffLookupKey(clientName);
        })
      : [];
    if (matches.length > 1) {
      reject(rejected, "refunds", document, `Multiple refund approvals match lead ${leadLegacyMongoId}.`);
      continue;
    }
    const approvalLegacyMongoId = matches.length === 1 ? mongoId(matches[0]._id) : undefined;
    if (approvalLegacyMongoId && claimedApprovalIds.has(approvalLegacyMongoId)) {
      reject(rejected, "refunds", document, `Approval ${approvalLegacyMongoId} is already matched to another finance record.`);
      continue;
    }
    if (approvalLegacyMongoId) claimedApprovalIds.add(approvalLegacyMongoId);
    if (matches.length === 1 && status(matches[0].status ?? "underProcess") !== mappedStatus) {
      warnings.push(`refunds:${id} approval status differs; apply will synchronize it to ${mappedStatus}.`);
    }
    refunds.push({
      legacyMongoId: id,
      leadLegacyMongoId,
      requestedByLegacyProfileId,
      approvalLegacyMongoId,
      legacyNotificationId: mongoId(document.notificationId),
      uid,
      branch: text(document.branch),
      amount,
      clientName,
      cnic: text(document.CNIC),
      phone,
      reason,
      status: mappedStatus,
      decidedAt: mappedStatus === "UNDER_PROCESS" ? undefined : mappedTimestamps.updatedAt ?? mappedTimestamps.createdAt,
      ...mappedTimestamps,
    });
  }

  for (const document of collections.deductions ?? []) {
    const id = uniqueId(seenIds.deductions, "deductions", document, rejected);
    if (!id) continue;
    const mappedTimestamps = timestamps("deductions", document, rejected);
    if (!mappedTimestamps) continue;
    const lateArrivals = nonNegativeInteger(document.lateArrivals);
    const halfDays = nonNegativeInteger(document.halfDays);
    const daysOff = nonNegativeInteger(document.dayOffs);
    if (lateArrivals === undefined || halfDays === undefined || daysOff === undefined) {
      reject(rejected, "deductions", document, "Deduction rates must be non-negative integers.");
      continue;
    }
    deductionPolicies.push({
      legacyMongoId: id,
      lateArrivals,
      halfDays,
      daysOff,
      effectiveFrom: mappedTimestamps.createdAt.slice(0, 10),
      ...mappedTimestamps,
    });
  }

  const seenTranscriptPeriods = new Set<string>();
  for (const document of collections.transcripts ?? []) {
    const id = uniqueId(seenIds.transcripts, "transcripts", document, rejected);
    if (!id) continue;
    const uid = claimUid(seenUids.transcripts, "transcripts", document, rejected);
    if (uid === null) continue;
    const mappedTimestamps = timestamps("transcripts", document, rejected);
    if (!mappedTimestamps) continue;
    const employeeName = text(document.employeeName);
    const payPeriodStart = payPeriod(document.salaryMonth, mappedTimestamps.createdAt);
    if (!employeeName || !payPeriodStart) {
      reject(rejected, "transcripts", document, "Missing employeeName or unsupported salaryMonth.");
      continue;
    }
    const profileLegacyMongoId = staffReference(employeeName, "transcripts", id, options, warnings);
    const duplicateKey = `${profileLegacyMongoId ?? staffLookupKey(employeeName)}:${payPeriodStart}`;
    if (seenTranscriptPeriods.has(duplicateKey)) {
      reject(rejected, "transcripts", document, `Duplicate employee pay period: ${employeeName} ${payPeriodStart.slice(0, 7)}.`);
      continue;
    }
    seenTranscriptPeriods.add(duplicateKey);
    const totalSalary = money(document.totalSalary);
    const amountPerDayOff = money(document.amountPerDayOff);
    const netSalary = money(document.netSalary, true);
    if (supplied(document.totalSalary) && !totalSalary) { reject(rejected, "transcripts", document, "Invalid totalSalary."); continue; }
    if (supplied(document.amountPerDayOff) && !amountPerDayOff) { reject(rejected, "transcripts", document, "Invalid amountPerDayOff."); continue; }
    if (supplied(document.netSalary) && !netSalary) { reject(rejected, "transcripts", document, "Invalid netSalary."); continue; }
    const lateArrivals = nonNegativeInteger(document.lateArrivals);
    const halfDays = nonNegativeInteger(document.halfDays);
    const daysOff = nonNegativeInteger(document.dayOffs);
    if (supplied(document.lateArrivals) && lateArrivals === undefined) { reject(rejected, "transcripts", document, "Invalid lateArrivals count."); continue; }
    if (supplied(document.halfDays) && halfDays === undefined) { reject(rejected, "transcripts", document, "Invalid halfDays count."); continue; }
    if (supplied(document.dayOffs) && daysOff === undefined) { reject(rejected, "transcripts", document, "Invalid dayOffs count."); continue; }
    if (!/^\d{4}-\d{1,2}$/.test(text(document.salaryMonth) ?? "") && !/\d{4}/.test(text(document.salaryMonth) ?? "")) {
      warnings.push(`transcripts:${id} inferred pay-period year from createdAt as ${payPeriodStart.slice(0, 4)}.`);
    }
    payrollTranscripts.push({
      legacyMongoId: id,
      profileLegacyMongoId,
      uid,
      employeeName,
      designation: text(document.designation),
      phone: text(document.phone),
      payPeriodStart,
      salaryType: text(document.salaryType),
      totalSalary,
      lateArrivals,
      halfDays,
      daysOff,
      amountPerDayOff,
      netSalary,
      ...mappedTimestamps,
    });
  }

  if (!options.staffLegacyIdByName && (
    sales.some((item) => item.staffName)
    || cashbookEntries.some((item) => item.staffName)
    || payrollTranscripts.length
  )) warnings.push("Identity exports were not supplied; name-based staff links will be verified only as unlinked historical labels.");
  if (!options.knownLeadLegacyIds && (
    sales.some((item) => item.leadLegacyMongoId)
    || cashbookEntries.some((item) => item.leadLegacyMongoId)
    || refunds.some((item) => item.leadLegacyMongoId)
  )) warnings.push("A lead export was not supplied; lead references will be verified only during apply.");
  if (!options.knownProjectLegacyIds && (
    cashbookEntries.some((item) => item.projectLegacyMongoId)
    || vouchers.some((item) => item.projectLegacyMongoId)
  )) warnings.push("A project export was not supplied; project references will be verified only during apply.");
  if (!collections.approvals && (vouchers.length || refunds.length)) {
    warnings.push("approvals.json was not supplied; apply will discover matching approvals or create deterministic reconciliation approvals.");
  }

  const partialPlan = {
    sales,
    cashbookEntries,
    vouchers,
    refunds,
    deductionPolicies,
    payrollTranscripts,
    rejected,
    warnings,
    sourceCounts: {
      sales: collections.sales?.length ?? 0,
      cashbooks: collections.cashbooks?.length ?? 0,
      vouchers: collections.vouchers?.length ?? 0,
      refunds: collections.refunds?.length ?? 0,
      deductions: collections.deductions?.length ?? 0,
      transcripts: collections.transcripts?.length ?? 0,
    },
  };
  return { ...partialPlan, totals: totalsFor(partialPlan) };
}
