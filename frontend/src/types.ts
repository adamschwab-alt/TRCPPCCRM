export type Role = "ADMIN" | "LEADERSHIP" | "ESTIMATOR" | "PM" | "READ_ONLY";

export interface User {
  id: number;
  username: string;
  fullName: string;
  email?: string | null;
  role: Role;
  mustChangePwd?: boolean;
  isActive?: boolean;
}

export interface Invitation {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
  invitedBy?: { id: number; fullName: string } | null;
}

export const STAGES = [
  "LEAD",
  "REVIEWING_ITB",
  "GO_NO_GO",
  "ESTIMATING",
  "BID_SUBMITTED",
  "AWAITING_DECISION",
  "WON",
  "LOST",
  "NO_BID",
  "WITHDRAWN",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  LEAD: "Lead",
  REVIEWING_ITB: "Reviewing ITB",
  GO_NO_GO: "Go/No-Go",
  ESTIMATING: "Estimating",
  BID_SUBMITTED: "Bid Submitted",
  AWAITING_DECISION: "Awaiting Decision",
  WON: "Won",
  LOST: "Lost",
  NO_BID: "No Bid",
  WITHDRAWN: "Withdrawn",
};

export const STAGE_COLOR: Record<Stage, string> = {
  LEAD: "bg-gray-200 text-gray-800",
  REVIEWING_ITB: "bg-blue-100 text-blue-800",
  GO_NO_GO: "bg-yellow-100 text-yellow-800",
  ESTIMATING: "bg-indigo-100 text-indigo-800",
  BID_SUBMITTED: "bg-purple-100 text-purple-800",
  AWAITING_DECISION: "bg-orange-100 text-orange-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
  NO_BID: "bg-gray-100 text-gray-700",
  WITHDRAWN: "bg-gray-100 text-gray-500",
};

export interface Opportunity {
  id: number;
  projectNumber: string;
  projectName: string;
  customerName: string;
  customerId?: number | null;
  customerType: string;
  projectType: string;
  region: string;
  scopeOfWork: string[];
  estimatedValueCents: string | number;
  actualValueCents?: string | number | null;
  winningBidCents?: string | number | null;
  bidMarginPct: number;
  expectedMarginPct?: number | null;
  bidDueDate?: string | null;
  estimatedStartDate?: string | null;
  estimatedDurationMonths?: number | null;
  stage: Stage;
  bondingRequired: boolean;
  bondAmountCents?: string | number | null;
  estimatorId?: number | null;
  estimator?: { id: number; fullName: string } | null;
  pmId?: number | null;
  pm?: { id: number; fullName: string } | null;
  source?: string | null;
  competitive: boolean;
  lastLook: boolean;
  lossReason?: string | null;
  winningBidder?: string | null;
  noBidReason?: string | null;
  goNoGoScore?: number | null;
  backlogStatus: "ACTIVE" | "COMPLETE" | "ON_HOLD" | "CANCELLED";
  stageChangedAt: string;
  bidSubmittedAt?: string | null;
  decidedAt?: string | null;
  notes?: Note[];
  stageHistory?: any[];
  goNoGoDecisions?: any[];
}

export interface Note {
  id: number;
  body: string;
  createdAt: string;
  author: { id: number; fullName: string };
}

export interface Customer {
  id: number;
  companyName: string;
  primaryContact?: string | null;
  phone?: string | null;
  email?: string | null;
  customerType: string;
  tier: "PLATINUM" | "GOLD" | "SILVER" | "NEW";
  lastLook: boolean;
  ownerId?: number | null;
  owner?: { id: number; fullName: string } | null;
  notes?: string | null;
  totalProjects: number;
  wonProjects: number;
  winRate: number;
  totalRevenueCents: string | number;
  lastBidDate?: string | null;
  lastProjectDate?: string | null;
}
