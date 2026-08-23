import { NextResponse } from "next/server";
import { storage } from "@/lib/storage"; // ajuste o caminho do seu client S3
import { GetObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET!;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return new NextResponse("Chave do arquivo ausente", { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await storage.send(command);

    if (!response.Body) {
      return new NextResponse("Arquivo não encontrado", { status: 404 });
    }

    // Transforma o stream do S3 em um array de bytes para enviar ao cliente
    const byteArray = await response.Body.transformToByteArray();
    const buffer = new ArrayBuffer(byteArray.byteLength);
    new Uint8Array(buffer).set(byteArray);
    const contentType = response.ContentType || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[API_FILES_GET]", error);
    return new NextResponse("Erro ao carregar arquivo", { status: 500 });
  }
}