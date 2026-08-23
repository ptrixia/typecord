import { NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getCurrentUser } from "@/lib/current-user";

/**
 * ============================================================
 * S3 / STORAGE
 * ============================================================
 */

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION || "us-east-1";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const bucket = process.env.S3_BUCKET;

if (
    !endpoint ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket
) {
    console.error(
        "[S3_CONFIG] Variáveis do S3 não configuradas corretamente."
    );
}

const storage = new S3Client({
    region,

    endpoint,

    /**
     * IMPORTANTE para MinIO e vários storages
     * compatíveis com S3.
     */
    forcePathStyle:
        process.env.S3_FORCE_PATH_STYLE === "true",

    credentials: {
        accessKeyId: accessKeyId || "",
        secretAccessKey: secretAccessKey || "",
    },
});

/**
 * ============================================================
 * GET /api/files/download?key=...
 * ============================================================
 */

export async function GET(req: Request) {
    try {
        /**
         * ------------------------------------------------------
         * AUTENTICAÇÃO
         * ------------------------------------------------------
         */

        const user = await getCurrentUser();

        if (!user) {
            return new NextResponse(
                "Não autorizado",
                {
                    status: 401,
                }
            );
        }

        /**
         * ------------------------------------------------------
         * CONFIGURAÇÃO
         * ------------------------------------------------------
         */

        if (
            !bucket ||
            !endpoint ||
            !accessKeyId ||
            !secretAccessKey
        ) {
            console.error(
                "[S3_CONFIG] Configuração incompleta."
            );

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Storage não configurado corretamente no servidor.",
                },
                {
                    status: 500,
                }
            );
        }

        /**
         * ------------------------------------------------------
         * KEY
         * ------------------------------------------------------
         */

        const { searchParams } =
            new URL(req.url);

        const key =
            searchParams.get("key");

        if (!key) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A chave do arquivo é obrigatória.",
                },
                {
                    status: 400,
                }
            );
        }

        /**
         * ------------------------------------------------------
         * LIMPA A KEY
         * ------------------------------------------------------
         *
         * Exemplo válido:
         *
         * attachments/2026/arquivo.png
         */

        const cleanKey = key
            .replace(/^\/+/, "")
            .replace(/\.\./g, "");

        if (
            !cleanKey ||
            cleanKey.length > 1024
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Chave de arquivo inválida.",
                },
                {
                    status: 400,
                }
            );
        }

        /**
         * ------------------------------------------------------
         * NOME DO ARQUIVO
         * ------------------------------------------------------
         */

        const fileName =
            cleanKey
                .split("/")
                .pop() ||
            "download";

        /**
         * ------------------------------------------------------
         * GERA URL ASSINADA
         * ------------------------------------------------------
         *
         * Não fazemos HeadBucket aqui.
         *
         * O GetObject é o que realmente importa.
         */

        const command =
            new GetObjectCommand({
                Bucket: bucket,

                Key: cleanKey,

                /**
                 * Faz o storage responder como download.
                 */
                ResponseContentDisposition:
                    `attachment; filename="${encodeURIComponent(
                        fileName
                    )}"`,
            });

        const signedUrl =
            await getSignedUrl(
                storage,
                command,
                {
                    expiresIn: 60 * 5,
                }
            );

        /**
         * ------------------------------------------------------
         * RETORNO
         * ------------------------------------------------------
         */

        return NextResponse.json({
            success: true,

            url: signedUrl,

            key: cleanKey,

            name: fileName,

            expiresIn: 300,
        });
    } catch (error: any) {
        console.error(
            "[DOWNLOAD_URL_ERROR]",
            error
        );

        console.error(
            "[DOWNLOAD_URL_ERROR_MESSAGE]",
            error?.message
        );

        console.error(
            "[DOWNLOAD_URL_ERROR_CODE]",
            error?.Code ||
                error?.code
        );

        return NextResponse.json(
            {
                success: false,

                message:
                    error?.message ||
                    "Não foi possível gerar a URL de download.",
            },
            {
                status: 500,
            }
        );
    }
}