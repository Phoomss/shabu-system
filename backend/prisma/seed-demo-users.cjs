require('dotenv/config');

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

const demoUsers = [
  { username: 'demo_owner', fullName: 'Demo Owner', role: 'OWNER' },
  { username: 'demo_manager', fullName: 'Demo Manager', role: 'MANAGER' },
  { username: 'demo_staff', fullName: 'Demo Staff', role: 'STAFF' },
  { username: 'demo_kitchen', fullName: 'Demo Kitchen', role: 'KITCHEN' },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const password = process.env.DEMO_USER_PASSWORD;
  const resetExistingPasswords = process.env.DEMO_RESET_PASSWORDS === 'true';

  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  if (!password || password.length < 8) {
    throw new Error('Set DEMO_USER_PASSWORD to at least 8 characters.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    for (const demoUser of demoUsers) {
      const role = await prisma.role.upsert({
        where: { name: demoUser.role },
        update: {},
        create: { name: demoUser.role },
      });

      const existing = await prisma.user.findUnique({
        where: { username: demoUser.username },
        select: { id: true },
      });

      if (existing) {
        if (resetExistingPasswords) {
          await prisma.user.update({
            where: { username: demoUser.username },
            data: { passwordHash, roleId: role.id, isActive: true },
          });
          console.log(`Updated ${demoUser.username} (${demoUser.role}).`);
        } else {
          console.log(`Skipped ${demoUser.username}: account already exists.`);
        }
        continue;
      }

      await prisma.user.create({
        data: {
          username: demoUser.username,
          fullName: demoUser.fullName,
          roleId: role.id,
          passwordHash,
          isActive: true,
        },
      });
      console.log(`Created ${demoUser.username} (${demoUser.role}).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Could not create demo users:', error);
  process.exitCode = 1;
});
