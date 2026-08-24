import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;

export async function GET(request: Request) {
    try {
        if (!bucket) {
            console.error("[API_FILES_GET] S3_BUCKET não configurado.");

            return new NextResponse(
                "Bucket S3 não configurado.",
                { status: 500 }
            );
        }

        const { searchParams } = new URL(request.url);
        const key = searchParams.get("key");

        if (!key) {
            return new NextResponse(
                "Chave do arquivo ausente.",
                { status: 400 }
            );
        }

        console.log("[API_FILES_GET] Buscando arquivo:", key);

        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const response = await storage.send(command);

        if (!response.Body) {
            console.error(
                "[API_FILES_GET] Arquivo não possui Body:",
                key
            );

            return new NextResponse(
                "Arquivo não encontrado.",
                { status: 404 }
            );
        }

        /*
         * O SDK da AWS pode retornar diferentes tipos de Body
         * dependendo do ambiente.
         *
         * No Node.js, transformToWebStream() transforma o Body
         * em uma ReadableStream compatível com NextResponse.
         */
        const body = response.Body.transformToWebStream();

        const contentType =
            response.ContentType ||
            "application/octet-stream";

        const headers = new Headers();

        headers.set(
            "Content-Type",
            contentType
        );

        /*
         * Se o S3 souber o tamanho do arquivo,
         * enviamos também para o navegador.
         */
        if (
            typeof response.ContentLength === "number"
        ) {
            headers.set(
                "Content-Length",
                response.ContentLength.toString()
            );
        }

        /*
         * Permite que imagens, vídeos etc. sejam
         * carregados pelo navegador.
         */
        headers.set(
            "Cache-Control",
            "public, max-age=31536000, immutable"
        );

        /*
         * Permite que o navegador faça Range Requests.
         *
         * Isso é especialmente importante para vídeos.
         */
        headers.set(
            "Accept-Ranges",
            "bytes"
        );

        /*
         * Content-Disposition inline permite que o navegador
         * visualize imagens, PDFs e vídeos em vez de forçar
         * download.
         */
        headers.set(
            "Content-Disposition",
            `inline; filename*=UTF-8''${encodeURIComponent(
                key.split("/").pop() || "arquivo"
            )}`
        );

        return new NextResponse(
            body,
            {
                status: 200,
                headers,
            }
        );
    } catch (error: any) {
        console.error(
            "[API_FILES_GET] Erro ao carregar arquivo:",
            {
                message: error?.message,
                name: error?.name,
                code: error?.code,
            }
        );

        /*
         * Arquivo inexistente no S3
         */
        if (
            error?.name === "NoSuchKey" ||
            error?.code === "NoSuchKey"
        ) {
            return new NextResponse(
                "Arquivo não encontrado.",
                { status: 404 }
            );
        }

        return new NextResponse(
            "Erro ao carregar arquivo.",
            { status: 500 }
        );
    }
}