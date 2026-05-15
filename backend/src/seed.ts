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
};

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
