import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

type AutoModDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      message: string;
      ruleId: string;
      ruleName: string;
    };

type AutoModContext = {
  guildId: string;
  channelId: string;
  userId: string;
  memberId: string;
  content: string;
};

const URL_RE = /https?:\/\/[^\s<>()]+/gi;
const INVITE_RE = /\b(discord\.gg|discord(?:app)?\.com\/invite|bit\.ly|tinyurl\.com|t\.me|wa\.me)\b/i;

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function capsRatio(value: string) {
  const letters = [...value].filter((char) => /\p{L}/u.test(char));
  if (letters.length < 12) return 0;
  const upper = letters.filter((char) => char === char.toLocaleUpperCase("pt-BR")).length;
  return upper / letters.length;
}

function hasSpamPattern(content: string) {
  return /(.)\1{9,}/u.test(content) || /(.{2,12})\1{5,}/u.test(content);
}

async function hitFloodBucket(guildId: string, userId: string, threshold: number) {
  const limit = threshold > 0 ? threshold : 6;
  const key = `typecord:automod:flood:${guildId}:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 8);
  return count > limit;
}

async function applyRuleAction(
  rule: {
    id: string;
    guildId: string;
    name: string;
    actionType: string;
    durationSeconds: number | null;
    reason: string | null;
  },
  context: AutoModContext,
) {
  const reason = rule.reason || `AutoMod: ${rule.name}`;
  const expiresAt =
    rule.actionType === "TIMEOUT"
      ? new Date(Date.now() + Math.max(rule.durationSeconds ?? 600, 60) * 1000)
      : null;

  await db.$transaction([
    db.moderationAction.create({
      data: {
        guildId: rule.guildId,
        targetUserId: context.userId,
        moderatorId: null,
        type: rule.actionType === "TIMEOUT" ? "TIMEOUT" : "WARNING",
        reason,
        expiresAt,
      },
    }),
    db.auditLog.create({
      data: {
        guildId: rule.guildId,
        actorId: context.userId,
        action: rule.actionType === "TIMEOUT" ? "AUTOMOD_TIMEOUT" : "AUTOMOD_WARN",
        targetId: context.userId,
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          reason,
          expiresAt: expiresAt?.toISOString() ?? null,
        },
      },
    }),
  ]);
}

export async function evaluateGuildMessageAutoMod(
  context: AutoModContext,
): Promise<AutoModDecision> {
  const content = context.content.trim();
  if (!content) return { allowed: true };

  const [member, rules] = await Promise.all([
    db.member.findUnique({
      where: { id: context.memberId },
      select: {
        roles: { select: { id: true } },
        guild: { select: { ownerId: true } },
      },
    }),
    db.autoModRule.findMany({
      where: { guildId: context.guildId, enabled: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        guildId: true,
        name: true,
        triggerType: true,
        actionType: true,
        keywords: true,
        exemptRoleIds: true,
        exemptChannelIds: true,
        threshold: true,
        durationSeconds: true,
        reason: true,
      },
    }),
  ]);

  if (!member || member.guild.ownerId === context.userId) {
    return { allowed: true };
  }

  const roleIds = new Set(member.roles.map((role) => role.id));
  const normalized = normalizeText(content);

  for (const rule of rules) {
    if (rule.exemptChannelIds.includes(context.channelId)) continue;
    if (rule.exemptRoleIds.some((roleId) => roleIds.has(roleId))) continue;

    let matched = false;

    if (rule.triggerType === "BLOCKED_WORD") {
      matched = rule.keywords.some((keyword) => {
        const value = normalizeText(keyword);
        return value.length > 0 && normalized.includes(value);
      });
    } else if (rule.triggerType === "SUSPICIOUS_LINK") {
      matched = URL_RE.test(content) && INVITE_RE.test(content);
      URL_RE.lastIndex = 0;
    } else if (rule.triggerType === "CAPS_LOCK") {
      matched = capsRatio(content) >= (rule.threshold > 0 ? rule.threshold / 100 : 0.72);
    } else if (rule.triggerType === "SPAM") {
      matched = hasSpamPattern(content);
    } else if (rule.triggerType === "FLOOD") {
      matched = await hitFloodBucket(context.guildId, context.userId, rule.threshold);
    }

    if (!matched) continue;

    if (rule.actionType === "WARN" || rule.actionType === "TIMEOUT") {
      await applyRuleAction(rule, context);
    }

    return {
      allowed: false,
      message: `Mensagem bloqueada pelo AutoMod: ${rule.name}.`,
      ruleId: rule.id,
      ruleName: rule.name,
    };
  }

  return { allowed: true };
}
