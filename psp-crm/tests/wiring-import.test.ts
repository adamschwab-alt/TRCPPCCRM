import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWiringWorkbook } from '../src/lib/import/wiring-import';

/** Build a minimal workbook mirroring the real Customer Wiring layout. */
function buildWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  const parent: unknown[][] = [];
  parent[12] = ['Customer (entity)', 'Existing/Target', 'Size', 'TTM Revenue', 'GM %', 'Primary State', 'Relationship (1-3)'];
  parent[13] = ['United Rentals', 'Existing', 'A', 19_000_000, 0.57, 'CA', 1];
  parent[14] = ['DP Nicoli', 'Existing', 'B', 3_600_000, 0.58, 'WA', 3];
  parent[15] = ['No Rating Co', 'Existing', 'C', 1_000_000, 0.6, 'TX', null];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(parent), 'Customer Wiring');

  const branch: unknown[][] = [];
  const bh = Array(31).fill(null);
  bh[0] = 'Customer (branch)'; bh[1] = 'Parent '; bh[9] = 'Relationship (1-3)';
  bh[24] = 'Assigned Rep'; bh[25] = 'Contact 1'; bh[26] = 'Email 1';
  bh[27] = 'Contact 2'; bh[28] = 'Email 2'; bh[29] = 'Contact 3'; bh[30] = 'Email 3';
  branch[12] = bh;
  const row = Array(31).fill(null);
  row[0] = 'DP Nicoli - Wilsonville, OR'; row[1] = 'DP Nicoli'; row[9] = 2;
  row[24] = 'Maria Novoa'; row[25] = 'Jeri Cameron'; row[26] = 'j@dpnicoli.com';
  row[27] = 'Kyle Lewis'; row[28] = null;
  branch[13] = row;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(branch), 'Customer Wiring - Branch');

  const region: unknown[][] = [];
  const rh = Array(11).fill(null);
  rh[0] = 'Branch (key — matches wiring tab)'; rh[5] = 'Region'; rh[6] = 'Coverage Contact (INPUT)';
  rh[7] = 'Title (INPUT)'; rh[8] = 'Email (INPUT)';
  region[3] = rh;
  const rr = Array(11).fill(null);
  rr[0] = 'x'; rr[5] = 'United Rentals — West'; rr[6] = 'Pat Regional'; rr[7] = 'District Mgr'; rr[8] = 'pat@ur.com';
  region[4] = rr;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(region), 'Region Map');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('customer wiring workbook parser', () => {
  const parsed = parseWiringWorkbook(buildWorkbook());

  it('reads parent-tab ratings, skipping unrated rows', () => {
    expect(parsed.parentRatings).toEqual([
      { account: 'United Rentals', rating: 1 },
      { account: 'DP Nicoli', rating: 3 },
    ]);
  });

  it('reads branch rows with rep and multiple contacts (email optional)', () => {
    expect(parsed.branchRows).toHaveLength(1);
    const b = parsed.branchRows[0];
    expect(b.branchName).toBe('DP Nicoli - Wilsonville, OR');
    expect(b.parentName).toBe('DP Nicoli');
    expect(b.assignedRep).toBe('Maria Novoa');
    expect(b.contacts).toEqual([
      { name: 'Jeri Cameron', email: 'j@dpnicoli.com' },
      { name: 'Kyle Lewis', email: null },
    ]);
  });

  it('reads region roster contacts and derives the parent account from the region name', () => {
    expect(parsed.regionContacts).toEqual([
      { accountPrefix: 'United Rentals', name: 'Pat Regional', title: 'District Mgr', email: 'pat@ur.com' },
    ]);
  });
});
