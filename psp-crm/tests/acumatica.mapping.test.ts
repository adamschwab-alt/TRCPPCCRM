import { describe, it, expect } from 'vitest';
import { datasetFromRecords } from '../src/lib/adapters/mapping';

// Two real rows pulled from the live Acumatica inquiry
// "PSP-Sales Profitability Analysis Detailed" (?$top=2&$format=json).
// This locks the live-feed field mapping so a column rename upstream can't
// silently zero out the coverage metrics.
const SAMPLE: Record<string, unknown>[] = [
  {
    Type: 'INV',
    InvoiceNbr: '000345',
    Released: true,
    Status: 'Closed',
    Subaccount: '10',
    Date: '2022-07-18T00:00:00',
    NetSale: '566.0700',
    Quantity: '0.000000',
    Cost: '0.00000',
    Margin: '566.070000000',
    Margin_2: '100.0000000',
    Completed: true,
    SONbr: null,
    SOType: null,
    ItemClass: null,
    ItemClass_2: null,
    InventoryID: null,
    InventoryDescription: '33126 - Open document balance from QB as of 12/31/2023',
    Customer: 'UNIREN022',
    CustomerClass: 'Dealer',
    CustomerClass_2: 'DEALER',
    Customer_2: 'United Rentals - Denver, CO',
    SalespersonID: 'BC        ',
    SalesPers: 'Brandon Christian',
    State: 'CO',
    Account: '40000     ',
    Description: 'Sales_Aluminum Products',
    City: 'Denver',
    PostPeriod: '072022',
    ParentCustomerID: 'UNIREN000',
    ParentCustomerName: 'United Rentals',
    ReferenceNbr: '000345',
    LineNbr: 1,
    Type_2: 'Invoice',
    InventoryID_2: null,
    CustomerID: 'UNIREN022',
    AddressID: 278,
    ClassID: null,
  },
  {
    Type: 'CRM',
    InvoiceNbr: '000343',
    Released: true,
    Status: 'Open',
    Subaccount: '00',
    Date: '2022-09-06T00:00:00',
    NetSale: '-609.0000',
    Quantity: '0.000000',
    Cost: '0.00000',
    Margin: '-609.000000000',
    Margin_2: '100.0000000',
    Completed: true,
    SONbr: null,
    SOType: null,
    ItemClass: null,
    ItemClass_2: null,
    InventoryID: null,
    InventoryDescription: 'JE-2028 - Open document balance from QB as of 12/31/2023',
    Customer: 'UNIREN080',
    CustomerClass: 'Dealer',
    CustomerClass_2: 'DEALER',
    Customer_2: 'United Rentals - Savage, MN',
    SalespersonID: 'RH        ',
    SalesPers: 'Ross Hawks',
    State: 'MN',
    Account: '40000     ',
    Description: 'Sales_Aluminum Products',
    City: 'Savage',
    PostPeriod: '092022',
    ParentCustomerID: 'UNIREN000',
    ParentCustomerName: 'United Rentals',
    ReferenceNbr: '000343',
    LineNbr: 1,
    Type_2: 'Credit Memo',
    InventoryID_2: null,
    CustomerID: 'UNIREN080',
    AddressID: 266,
    ClassID: null,
  },
];

describe('Acumatica "Sales Profitability Analysis Detailed" mapping', () => {
  const ds = datasetFromRecords(SAMPLE);

  it('rolls every row up to the parent account, not the branch', () => {
    expect(ds.accounts.map((a) => a.name)).toEqual(['United Rentals']);
  });

  it('keeps each ship-to as its own branch under the account', () => {
    expect(ds.branches.map((b) => b.name).sort()).toEqual([
      'United Rentals - Denver, CO',
      'United Rentals - Savage, MN',
    ]);
    expect(ds.branches.every((b) => b.account_name === 'United Rentals')).toBe(true);
  });

  it('maps the core money/identity/people fields off the right columns', () => {
    const t = ds.transactions.find((x) => x.invoice_nbr === '000345')!;
    expect(t.account_name).toBe('United Rentals');
    expect(t.branch_name).toBe('United Rentals - Denver, CO');
    expect(t.sales_person).toBe('Brandon Christian'); // clean name, not the "BC" code
    expect(t.net_sale).toBeCloseTo(566.07, 2);
    expect(t.date).toBe('2022-07-18');
    expect(t.state).toBe('CO');
    expect(t.city).toBe('Denver');
    expect(t.status).toBe('Closed');
  });

  it('preserves credit memos as negative net sales', () => {
    const cm = ds.transactions.find((x) => x.invoice_nbr === '000343')!;
    expect(cm.net_sale).toBeCloseTo(-609, 2);
    expect(cm.status).toBe('Open');
  });

  it('derives product line from the GL account description ("Sales_Aluminum Products")', () => {
    // This is the metric-critical assertion: without it every row falls to
    // "Other" and the Aluminum/Steel white-space split collapses.
    expect(ds.transactions.every((t) => t.product_line === 'Aluminum')).toBe(true);
  });
});
