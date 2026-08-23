import { PrismaClient } from '@prisma/client';
import { Permissions } from '../lib/permissions';

const db = new PrismaClient();

async function main() {
  const guilds = await db.guild.findMany({ select: { id: true } });
  const permissions = (Permissions.VIEW_CHANNEL | Permissions.SEND_MESSAGES | Permissions.READ_MESSAGE_HISTORY | Permissions.ADD_REACTIONS | Permissions.CONNECT | Permissions.SPEAK).toString();

  for (const guild of guilds) {
    let everyone = await db.role.findFirst({ where: { guildId: guild.id, isDefault: true } });
    if (!everyone) {
      everyone = await db.role.create({
        data: { guildId: guild.id, name: '@everyone', color: '#99aab5', position: 0, permissions, isDefault: true },
      });
    }

    const members = await db.member.findMany({ where: { guildId: guild.id }, include: { roles: { select: { id: true } } } });
    for (const member of members) {
      if (!member.roles.some(role => role.id === everyone!.id)) {
        await db.member.update({ where: { id: member.id }, data: { roles: { connect: { id: everyone.id } } } });
      }
    }

    await db.role.updateMany({ where: { guildId: guild.id, isDefault: false, position: { lt: 1 } }, data: { position: 1 } });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
