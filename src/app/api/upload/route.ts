import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentUser } from "@/lib/current-user";
import { storage } from "@/lib/storage";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return new NextResponse("Não autorizado", {
                status: 401,
            });
        }

        const data = await req.formData();
        const file = data.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Nenhum arquivo enviado",
                },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O arquivo não pode ultrapassar 25 MB.",
                },
                { status: 413 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const extension = file.name.includes(".")
            ? "." + file.name.split(".").pop()
            : "";

        const objectName =
            `attachments/${new Date().getFullYear()}/${crypto.randomUUID()}${extension}`;

        await storage.send(
            new PutObjectCommand({
                Bucket: process.env.S3_BUCKET!,
                Key: objectName,
                Body: buffer,
                ContentType:
                    file.type ||
                    "application/octet-stream",
                ContentLength: file.size,
            })
        );

        return NextResponse.json({
            success: true,

            /*
             * IMPORTANTE:
             * não mandamos uma URL pública do MinIO.
             */
            key: objectName,

            name: file.name,
            size: file.size,

            contentType:
                file.type ||
                "application/octet-stream",
        });
    } catch (error) {
        console.error("[UPLOAD_ERROR]", error);

        return NextResponse.json(
            {
                success: false,
                message: "Erro interno no upload",
            },
            { status: 500 }
        );
    }
}