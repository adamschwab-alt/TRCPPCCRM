import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "Redland2026!";

const USERS: Array<{ username: string; fullName: string; role: Role; email: string }> = [
  { username: "chad.munz", fullName: "Chad Munz", role: "LEADERSHIP", email: "chad@redlandcompany.com" },
  { username: "pinky.munz", fullName: "Pinky Munz", role: "LEADERSHIP", email: "pinky@redlandcompany.com" },
  { username: "david.merring", fullName: "David Merring", role: "ESTIMATOR", email: "david.merring@redlandcompany.com" },
  { username: "jon.hegler", fullName: "Jon Hegler (Finance)", role: "READ_ONLY", email: "jon.hegler@redlandcompany.com" },
  { username: "eddie", fullName: "Eddie (BD)", role: "READ_ONLY", email: "eddie@redlandcompany.com" },
  { username: "estimator2", fullName: "Estimator 2", role: "ESTIMATOR", email: "estimator2@redlandcompany.com" },
  { username: "estimator3", fullName: "Estimator 3", role: "ESTIMATOR", email: "estimator3@redlandcompany.com" },
  { username: "estimator4", fullName: "Estimator 4", role: "ESTIMATOR", email: "estimator4@redlandcompany.com" },
  { username: "pm1", fullName: "PM 1", role: "PM", email: "pm1@redlandcompany.com" },
  { username: "pm2", fullName: "PM 2", role: "PM", email: "pm2@redlandcompany.com" },
  { username: "pm3", fullName: "PM 3", role: "PM", email: "pm3@redlandcompany.com" },
  { username: "adam.schwab", fullName: "Adam Schwab (PPC)", role: "ADMIN", email: "adam@palmpeakcapital.com" },
];

const DROPDOWNS: Record<string, string[]> = {
  region: [
    "SE Florida",
    "SW Florida",
    "Orlando",
    "Tampa",
    "Jacksonville",
    "FL Panhandle",
    "Georgia",
    "South Carolina",
    "Texas",
    "North Carolina",
    "Other",
  ],
  project_type: [
    "Industrial",
    "Commercial",
    "Mixed Use",
    "Infrastructure",
    "Government",
    "Aviation",
    "Residential",
    "Other",
  ],
  scope_of_work: [
    "Surveying",
    "Earthwork",
    "Clearing & Grubbing",
    "Drainage",
    "Water",
    "Sewer",
    "Erosion Control",
    "Layout",
    "Paving",
    "Value Engineering",
    "Pre-Construction Services",
    "Other",
  ],
  loss_reason: [
    "Price",
    "Relationship",
    "Scope Capability",
    "Bonding",
    "Schedule",
    "Other",
  ],
  no_bid_reason: [
    "Capacity",
    "Low Margin",
    "Wrong Scope",
    "Geographic",
    "Bonding",
    "Customer Relationship",
    "Other",
  ],
  customer_type: ["GC", "Developer", "Government", "Owner-Direct"],
  source: [
    "Repeat Customer",
    "Referral",
    "Public Bid Board",
    "Proactive Outreach",
    "Negotiated",
    "Last Look",
  ],
};

const SETTINGS: Record<string, string> = {
  module_dashboard_enabled: "true",
  module_go_no_go_enabled: "true",
  module_bid_analytics_enabled: "true",
  module_estimator_workload_enabled: "true",
  module_customer_mgmt_enabled: "true",
  module_backlog_enabled: "true",
  estimator_capacity_threshold: "5",
  default_bid_margin_pct: "6",
  go_no_go_threshold_david: "5000000",
  go_no_go_threshold_chad: "15000000",
  weight_margin: "25",
  weight_customer: "20",
  weight_geo: "15",
  weight_scope_risk: "15",
  weight_resource: "10",
  weight_bond_risk: "5",
  weight_strategic: "10",
  allow_self_signup: "false",
  app_base_url: "",
  require_2fa_admin: "false",
  password_min_length: "8",
  password_require_mixed: "false",
  // Rotting thresholds (days) — when an opportunity in this stage hasn't seen
  // activity for this many days, it shows up as "stale" on the pipeline.
  rot_LEAD: "21",
  rot_REVIEWING_ITB: "5",
  rot_GO_NO_GO: "3",
  rot_ESTIMATING: "7",
  rot_BID_SUBMITTED: "7",
  rot_AWAITING_DECISION: "14",
  rot_WON: "60",
  rot_LOST: "0",
  rot_NO_BID: "0",
  rot_WITHDRAWN: "0",
  polite_loss_enabled: "true",
  polite_loss_template: "Thanks again for the opportunity to bid on this project. Congratulations on the award and we appreciate the chance to put numbers together for you. Please keep us in mind for the next one — we'd love another shot.\n\n— The Redland Company",
};

const BOARDS = [
  { slug: "main", name: "Main Pipeline", color: "#8B1A1A", sortOrder: 0 },
  { slug: "public", name: "Public / DOT", color: "#2D2D2D", sortOrder: 1 },
  { slug: "negotiated", name: "Negotiated / Last-Look", color: "#C9A84C", sortOrder: 2 },
  { slug: "private", name: "Private Repeat", color: "#6e1414", sortOrder: 3 },
];

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const u of USERS) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { email: u.email },
      create: {
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        passwordHash: hash,
        mustChangePwd: true,
      },
    });
  }

  for (const [category, values] of Object.entries(DROPDOWNS)) {
    for (let i = 0; i < values.length; i++) {
      await prisma.dropdownOption.upsert({
        where: { category_value: { category, value: values[i] } },
        update: { sortOrder: i, isActive: true },
        create: { category, value: values[i], sortOrder: i },
      });
    }
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  for (const b of BOARDS) {
    await prisma.pipelineBoard.upsert({
      where: { slug: b.slug },
      update: { name: b.name, color: b.color, sortOrder: b.sortOrder },
      create: b,
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
