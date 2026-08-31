import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

const schema = z.object({
  deviceId: z.string().trim().min(8).max(128),
  label: z.string().trim().max(128).optional(),
  publicKey: z.string().trim().min(100).max(16_384),
});

function fingerprint(publicKey: string) {
  return createHash("sha256").update(publicKey).digest("hex");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "Não autorizado." }, { status: 401 });

  const devices = await db.userDeviceKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      deviceId: true,
      label: true,
      fingerprint: true,
      revokedAt: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    devices: devices.map((device) => ({
      ...device,
      revokedAt: device.revokedAt?.toISOString() ?? null,
      lastSeenAt: device.lastSeenAt.toISOString(),
      createdAt: device.createdAt.toISOString(),
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "Não autorizado." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "Chave de dispositivo inválida." }, { status: 400 });
  const device = await db.userDeviceKey.upsert({
    where: { userId_deviceId: { userId: user.id, deviceId: parsed.data.deviceId } },
    create: {
      userId: user.id,
      deviceId: parsed.data.deviceId,
      label: parsed.data.label || null,
      publicKey: parsed.data.publicKey,
      fingerprint: fingerprint(parsed.data.publicKey),
    },
    update: {
      label: parsed.data.label || null,
      publicKey: parsed.data.publicKey,
      fingerprint: fingerprint(parsed.data.publicKey),
      revokedAt: null,
      lastSeenAt: new Date(),
    },
  });

  // Mantém compatibilidade com clientes antigos enquanto a migração de dispositivos é concluída.
  await db.user.update({ where: { id: user.id }, data: { e2eePublicKey: parsed.data.publicKey } });
  await db.platformLog.create({ data: { level: "security", event: "account.e2ee.device_register", userId: user.id, metadata: { deviceId: device.deviceId, fingerprint: device.fingerprint } } });
  return NextResponse.json({ success: true, device: { id: device.id, deviceId: device.deviceId, fingerprint: device.fingerprint } });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "Não autorizado." }, { status: 401 });
  const deviceId = new URL(request.url).searchParams.get("deviceId")?.trim() ?? "";
  if (deviceId.length < 8 || deviceId.length > 128) return NextResponse.json({ success: false, message: "Dispositivo inválido." }, { status: 400 });
  const result = await db.userDeviceKey.updateMany({ where: { userId: user.id, deviceId }, data: { revokedAt: new Date() } });
  if (result.count) await db.platformLog.create({ data: { level: "security", event: "account.e2ee.device_revoke", userId: user.id, metadata: { deviceId } } });
  return NextResponse.json({ success: true });
}
