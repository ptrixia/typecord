import "dotenv/config";
import { db } from "@/lib/db";
import { dequeueJobEnvelope, requeueJob, type JobName } from "@/lib/jobs";
import { telemetry } from "@/lib/observability";
import { emitToChannel, emitToUser } from "@/lib/realtime/emitter";

const names: JobName[] = ["notification", "file-processing", "message-expiry"];
let stopping = false;
let lastExpirySweep = 0;

async function expireMessages() {
  const now = new Date();
  const [guildMessages, directMessages] = await Promise.all([
    db.message.findMany({ where: { expiresAt: { lte: now }, deleted: false }, select: { id: true, channelId: true } }),
    db.directMessage.findMany({ where: { expiresAt: { lte: now }, deleted: false }, select: { id: true, conversationId: true } }),
  ]);
  const [guild, direct] = await Promise.all([
    db.message.updateMany({ where: { id: { in: guildMessages.map((message) => message.id) } }, data: { deleted: true, content: "" } }),
    db.directMessage.updateMany({ where: { id: { in: directMessages.map((message) => message.id) } }, data: { deleted: true, content: "" } }),
  ]);
  const directByConversation = new Map<string, string[]>();
  for (const message of directMessages) {
    const ids = directByConversation.get(message.conversationId) ?? [];
    ids.push(message.id);
    directByConversation.set(message.conversationId, ids);
  }
  await Promise.allSettled([
    ...guildMessages.map((message) => emitToChannel(message.channelId, "MESSAGE_DELETE", { messageId: message.id, channelId: message.channelId, reason: "expired" })),
    ...[...directByConversation].map(async ([conversationId, messageIds]) => {
      const participants = await db.directConversationParticipant.findMany({ where: { conversationId }, select: { userId: true } });
      return Promise.all(participants.flatMap((participant) => messageIds.map((messageId) => emitToUser(participant.userId, "MESSAGE_DELETE", { conversationId, messageId, reason: "expired" }))));
    }),
  ]);
  lastExpirySweep = Date.now();
  if (guild.count || direct.count) telemetry.info("worker.messages_expired", { guild: guild.count, direct: direct.count });
}

async function processJob(name: JobName) {
  const job = await dequeueJobEnvelope<unknown>(name);
  if (!job) return false;

  try {
    if (name === "message-expiry") {
      await expireMessages();
    }


    telemetry.info("worker.job_completed", { name, jobId: job.id });
  } catch (error) {
    telemetry.error("worker.job_failed", { name, jobId: job.id, message: error instanceof Error ? error.message : String(error) });
    if (job.attempts < 3) {
      await requeueJob(name, job);
    }
  }
  return true;
}

async function run() {
  telemetry.info("worker.started", { queues: names.join(",") });
  while (!stopping) {
    let worked = false;
    if (Date.now() - lastExpirySweep >= 10_000) {
      await expireMessages().catch((error) => telemetry.error("worker.expiry_failed", { message: error instanceof Error ? error.message : String(error) }));
    }
    for (const name of names) worked = (await processJob(name)) || worked;
    if (!worked) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await db.$disconnect();
}

process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });
void run().catch((error) => { telemetry.error("worker.fatal", { message: error instanceof Error ? error.message : String(error) }); process.exitCode = 1; });
