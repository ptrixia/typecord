import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    HeadBucketCommand,
    CreateBucketCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.S3_ENDPOINT!;
const bucket = process.env.S3_BUCKET!;

export const storage = new S3Client({
    region: "us-east-1",

    endpoint,

    forcePathStyle: true,

    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
    },
});

export async function ensureBucket() {
    try {
        await storage.send(
            new HeadBucketCommand({
                Bucket: bucket,
            })
        );

        return;
    } catch {
        console.log(
            `[STORAGE] Bucket "${bucket}" não existe. Criando...`
        );
    }

    await storage.send(
        new CreateBucketCommand({
            Bucket: bucket,
        })
    );
}

export async function getFileUrl(
    key: string
) {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });

    return await getSignedUrl(
        storage,
        command,
        {
            expiresIn: 60 * 60,
        }
    );
}