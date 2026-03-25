import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── CONFIG ─────────────────────────────────────────────────────────────────
// Fill in before running in production. Can also be passed as env vars:
//   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=yourpassword npm run db:seed
const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? "REPLACE_ME@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "REPLACE_ME_min8chars";
const ADMIN_NAME     = process.env.SEED_ADMIN_NAME     ?? "Dispatcher";

// Board date: defaults to Monday 2026-03-30 (field test day).
// Override with SEED_BOARD_DATE=YYYY-MM-DD if running on a different day.
const BOARD_DATE_STR = process.env.SEED_BOARD_DATE ?? "2026-03-30";
// ───────────────────────────────────────────────────────────────────────────

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

const TECH_NAMES = [
  "Andy", "Ant", "Brandon", "Chris", "Collin", "Cole", "Daniel", "Dom",
  "Elijah", "Ethan", "Jacob", "Jeff", "Joe", "Josh", "Juan", "Kiet",
  "Kevin", "Meech", "Micah", "Mike", "Ray", "Sid", "William", "Tino", "Tim",
];

// Board entries for BOARD_DATE — assignment and optional note
const BOARD_ENTRIES: { name: string; assignment: string; note?: string }[] = [
  { name: "Andy",    assignment: "FRL" },
  { name: "Ant",     assignment: "BET" },
  { name: "Brandon", assignment: "PARTS" },
  { name: "Chris",   assignment: "ASH",  note: "Starting 7:30" },
  { name: "Collin",  assignment: "OTN" },
  { name: "Cole",    assignment: "SCP" },
  { name: "Daniel",  assignment: "FCH" },
  { name: "Dom",     assignment: "ARL" },
  { name: "Elijah",  assignment: "GE" },
  { name: "Ethan",   assignment: "GWU" },
  { name: "Jacob",   assignment: "83" },
  { name: "Jeff",    assignment: "TEN" },
  { name: "Joe",     assignment: "CCH" },
  { name: "Josh",    assignment: "CCH" },
  { name: "Juan",    assignment: "PST" },
  { name: "Kiet",    assignment: "FRL" },
  { name: "Kevin",   assignment: "RWF" },
  { name: "Meech",   assignment: "ARL" },
  { name: "Micah",   assignment: "SSP" },
  { name: "Mike",    assignment: "OUT" },
  { name: "Ray",     assignment: "GE" },
  { name: "Sid",     assignment: "PST" },
  { name: "William", assignment: "83" },
  { name: "Tino",    assignment: "SCP" },
  { name: "Tim",     assignment: "GWU" },
];

async function main() {
  // Validate config before touching the DB
  if (ADMIN_EMAIL === "REPLACE_ME@example.com" || ADMIN_PASSWORD === "REPLACE_ME_min8chars") {
    console.error(
      "\n✗ Admin credentials not set.\n" +
      "  Run with: SEED_ADMIN_EMAIL=you@email.com SEED_ADMIN_PASSWORD=yourpassword npm run db:seed\n"
    );
    process.exit(1);
  }
  if (ADMIN_PASSWORD.length < 8) {
    console.error("✗ SEED_ADMIN_PASSWORD must be at least 8 characters.\n");
    process.exit(1);
  }

  console.log("Seeding production database...\n");

  // ── WIPE ──
  await prisma.aIInteraction.deleteMany();
  await prisma.note.deleteMany();
  await prisma.boardEntry.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.smsMessage.deleteMany();
  await prisma.scheduleEntry.deleteMany();
  await prisma.job.deleteMany();
  await prisma.technician.deleteMany();
  await prisma.user.deleteMany();
  console.log("  Cleared existing data.");

  // ── ADMIN USER ──
  const adminHash = await hash(ADMIN_PASSWORD, 12);
  await prisma.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      role: "ADMIN",
      active: true,
    },
  });
  console.log(`  Created admin: ${ADMIN_EMAIL}`);

  // ── TECHNICIANS ──
  const techMap: Record<string, string> = {}; // name -> id

  for (let i = 0; i < TECH_NAMES.length; i++) {
    const tech = await prisma.technician.create({
      data: {
        name: TECH_NAMES[i],
        phone: "",
        status: "ACTIVE",
        active: true,
      },
    });
    techMap[TECH_NAMES[i]] = tech.id;
  }
  console.log(`  Created ${TECH_NAMES.length} technicians.`);

  // ── BOARD ENTRIES ──
  const boardDate = parseLocalDate(BOARD_DATE_STR);

  let order = 0;
  for (const entry of BOARD_ENTRIES) {
    const techId = techMap[entry.name];
    if (!techId) {
      console.warn(`  Warning: tech "${entry.name}" not found, skipping board entry.`);
      continue;
    }
    await prisma.boardEntry.create({
      data: {
        technicianId: techId,
        date: boardDate,
        assignment: entry.assignment,
        note: entry.note ?? null,
        status: entry.assignment === "OUT" ? "OUT" : "ASSIGNED",
        orderIndex: order++,
      },
    });
  }
  console.log(`  Created ${BOARD_ENTRIES.length} board entries for ${BOARD_DATE_STR}.`);

  console.log("\n✓ Seed complete.");
  console.log(`  Board date : ${BOARD_DATE_STR}`);
  console.log(`  Login      : ${ADMIN_EMAIL}`);
  console.log("  Role       : ADMIN\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\n✗ Seed failed:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
