import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageConfig = {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
};

let cachedConfig: StorageConfig | null = null;
let cachedClient: S3Client | null = null;

export function getStorageConfig(): StorageConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKey = (
    process.env.S3_ACCESS_KEY ?? process.env.S3_ACCESS_KEY_ID
  )?.trim();
  const secretKey = (
    process.env.S3_SECRET_KEY ?? process.env.S3_SECRET_ACCESS_KEY
  )?.trim();
  const region = process.env.S3_REGION?.trim() || "us-east-1";

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error(
      "S3 não configurado. Defina S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY e S3_SECRET_KEY.",
    );
  }

  const parsedEndpoint = new URL(endpoint);
  if (parsedEndpoint.protocol !== "http:" && parsedEndpoint.protocol !== "https:") {
    throw new Error("S3_ENDPOINT precisa usar HTTP ou HTTPS.");
  }

  cachedConfig = {
    endpoint: parsedEndpoint.toString().replace(/\/$/, ""),
    bucket,
    accessKey,
    secretKey,
    region,
  };

  return cachedConfig;
}

export function getStorageClient(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getStorageConfig();

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });

  return cachedClient;
}

export const storage = new Proxy({} as S3Client, {
  get(_target, property) {
    const client = getStorageClient() as unknown as Record<PropertyKey, unknown>;
    const value = client[property];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function isSafeStorageKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= 1024 &&
    !key.startsWith("/") &&
    !key.includes("\\") &&
    !key.includes("\0") &&
    !key.split("/").some((segment) => segment === "..")
  );
}

export async function storageObjectExists(key: string): Promise<boolean> {
  if (!isSafeStorageKey(key)) {
    return false;
  }

  try {
    const { bucket } = getStorageConfig();
    await getStorageClient().send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return true;
  } catch (error: unknown) {
    const name =
      typeof error === "object" && error !== null && "name" in error
        ? String((error as { name?: unknown }).name ?? "")
        : "";

    if (name === "NotFound" || name === "NoSuchKey") {
      return false;
    }

    throw error;
  }
}

export async function ensureBucket() {
  const { bucket } = getStorageConfig();
  const client = getStorageClient();

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function putObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
  contentLength: number;
}) {
  if (!isSafeStorageKey(input.key)) {
    throw new Error("Chave de storage inválida.");
  }

  const { bucket } = getStorageConfig();

  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    }),
  );
}

export async function getObject(key: string) {
  if (!isSafeStorageKey(key)) {
    throw new Error("Chave de storage inválida.");
  }

  const { bucket } = getStorageConfig();

  return getStorageClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

export async function getPrivateSignedUrl(key: string, expiresIn = 300) {
  if (!isSafeStorageKey(key)) {
    throw new Error("Chave de storage inválida.");
  }

  const { bucket } = getStorageConfig();

  return getSignedUrl(
    getStorageClient(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: Math.min(Math.max(expiresIn, 30), 900) },
  );
}
