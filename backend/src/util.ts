// BigInt JSON serialization (Express/JSON.stringify can't handle BigInt by default)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export function toCents(v: number | string | null | undefined): bigint | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) return null;
  return BigInt(Math.round(n * 100));
}

export function fromCents(v: bigint | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return Number(v) / 100;
}

export async function nextProjectNumber(prisma: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRC-${year}-`;
  const last = await prisma.opportunity.findFirst({
    where: { projectNumber: { startsWith: prefix } },
    orderBy: { projectNumber: "desc" },
  });
  let n = 1;
  if (last) {
    const tail = last.projectNumber.split("-")[2];
    const parsed = parseInt(tail, 10);
    if (!Number.isNaN(parsed)) n = parsed + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}
