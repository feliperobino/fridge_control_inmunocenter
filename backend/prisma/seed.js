import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: 'ADMIN'
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN'
    }
  });

  // eslint-disable-next-line no-console
  console.log('Seeded admin user', adminEmail);

  for (let i = 1; i <= 4; i++) {
    const name = `Refrigerador_${i}`;
    const slaveId = i;
    await prisma.fridge.upsert({
      where: { modbusSlaveId: slaveId },
      update: {
        name,
        tempMin: 2.0,
        tempMax: 8.0,
        humMin: 20.0,
        humMax: 90.0
      },
      create: {
        name,
        modbusSlaveId: slaveId,
        tempMin: 2.0,
        tempMax: 8.0,
        humMin: 20.0,
        humMax: 90.0
      }
    });

    // eslint-disable-next-line no-console
    console.log('Seeded fridge', name);
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
