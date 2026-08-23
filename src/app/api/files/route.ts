import { NextResponse } from "next/server";
import { getFileUrl } from "@/lib/storage";

export async function GET(
    req: Request
) {
    try {
        const { searchParams } =
            new URL(req.url);

        const key =
            searchParams.get("key");

        if (!key) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Arquivo não informado",
                },
                { status: 400 }
            );
        }

        const url =
            await getFileUrl(key);

        return NextResponse.json({
            success: true,
            url,
        });
    } catch (error) {
        console.error(
            "[FILE_URL_ERROR]",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível acessar o arquivo",
            },
            { status: 500 }
        );
    }
}