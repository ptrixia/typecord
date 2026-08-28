import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LinkPreviewRequest {
  content?: string;
}

interface MessageEmbedData {
  url?: string;
  title?: string;
  description?: string;
  siteName?: string;
  color?: string;
  image?: string;
  thumbnail?: string;
}

const URL_REGEX =
  /https?:\/\/[^\s<>"'`]+/gi;

const DIRECT_IMAGE_REGEX =
  /\.(?:png|jpe?g|gif|webp|avif)(?:[?#].*)?$/i;

const MAX_URLS = 5;
const MAX_HTML_SIZE = 1_500_000;
const REQUEST_TIMEOUT = 7_000;

function cleanText(
  value?: string | null,
) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function decodeHtmlEntities(
  value?: string | null,
) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const value = Number(code);

      if (!Number.isFinite(value)) {
        return _;
      }

      return String.fromCharCode(value);
    });
}

function normalizeUrl(
  value: string | undefined,
  baseUrl: string,
) {
  if (!value) {
    return undefined;
  }

  try {
    const decodedValue = decodeHtmlEntities(value);

    if (!decodedValue) {
      return undefined;
    }

    return new URL(
      decodedValue,
      baseUrl,
    ).toString();
  } catch {
    return undefined;
  }
}

function extractMetaContent(
  html: string,
  attributes: string[],
) {
  for (const attribute of attributes) {
    const escaped =
      attribute.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
        "i",
      ),

      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        "i",
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (match?.[1]) {
        return decodeHtmlEntities(
          match[1],
        );
      }
    }
  }

  return undefined;
}

function extractTitle(
  html: string,
) {
  const ogTitle =
    extractMetaContent(html, [
      "og:title",
      "twitter:title",
    ]);

  if (ogTitle) {
    return cleanText(ogTitle);
  }

  const titleMatch =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    );

  return cleanText(
    decodeHtmlEntities(
      titleMatch?.[1],
    ),
  );
}

function extractDescription(
  html: string,
) {
  return cleanText(
    extractMetaContent(html, [
      "og:description",
      "twitter:description",
      "description",
    ]),
  );
}

function extractSiteName(
  html: string,
  url: string,
) {
  const meta =
    cleanText(
      extractMetaContent(html, [
        "og:site_name",
        "application-name",
      ]),
    );

  if (meta) {
    return meta;
  }

  try {
    return new URL(url)
      .hostname
      .replace(/^www\./i, "");
  } catch {
    return undefined;
  }
}

function extractImage(
  html: string,
  baseUrl: string,
) {
  const image =
    extractMetaContent(html, [
      "og:image",
      "og:image:url",
      "og:image:secure_url",
      "twitter:image",
      "twitter:image:src",
    ]);

  return normalizeUrl(
    image,
    baseUrl,
  );
}

function extractCanonicalUrl(
  html: string,
  baseUrl: string,
) {
  const match =
    html.match(
      /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    ) ??
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i,
    );

  return normalizeUrl(
    match?.[1],
    baseUrl,
  );
}

function isPrivateIpv4(
  address: string,
) {
  const parts =
    address
      .split(".")
      .map(Number);

  if (parts.length !== 4) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 &&
      b === 254) ||
    (a === 172 &&
      b >= 16 &&
      b <= 31) ||
    (a === 192 &&
      b === 168)
  );
}

function isPrivateIpv6(
  address: string,
) {
  const normalized =
    address.toLowerCase();

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith(
      "fe80:",
    )
  );
}

function isPrivateIp(
  address: string,
) {
  const version =
    net.isIP(address);

  if (version === 4) {
    return isPrivateIpv4(
      address,
    );
  }

  if (version === 6) {
    return isPrivateIpv6(
      address,
    );
  }

  return false;
}

async function isSafeExternalUrl(
  rawUrl: string,
) {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    return false;
  }

  const hostname =
    url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(
      ".localhost",
    )
  ) {
    return false;
  }

  if (
    net.isIP(hostname) &&
    isPrivateIp(hostname)
  ) {
    return false;
  }

  try {
    const addresses =
      await dns.lookup(
        hostname,
        {
          all: true,
        },
      );

    if (
      addresses.some(
        ({ address }) =>
          isPrivateIp(address),
      )
    ) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

async function fetchPage(
  url: string,
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT,
    );

  try {
    const response =
      await fetch(url, {
        method: "GET",

        redirect: "follow",

        cache: "no-store",

        headers: {
          Accept:
            "text/html,application/xhtml+xml,image/avif,image/webp,image/apng,*/*;q=0.8",

          "User-Agent":
            "Mozilla/5.0 (compatible; TypecordBot/1.0; +https://typecord.app)",
        },

        signal:
          controller.signal,
      });

    if (!response.ok) {
      return null;
    }

    const finalUrl =
      response.url || url;

    if (
      !(await isSafeExternalUrl(
        finalUrl,
      ))
    ) {
      return null;
    }

    const contentType =
      response.headers
        .get("content-type")
        ?.toLowerCase() ??
      "";

    if (
      contentType.startsWith(
        "image/",
      )
    ) {
      return {
        type: "image" as const,
        url: finalUrl,
      };
    }

    if (
      !contentType.includes(
        "text/html",
      ) &&
      !contentType.includes(
        "application/xhtml+xml",
      )
    ) {
      return null;
    }

    const contentLength =
      Number(
        response.headers.get(
          "content-length",
        ) ?? 0,
      );

    if (
      contentLength >
      MAX_HTML_SIZE
    ) {
      return null;
    }

    const reader =
      response.body?.getReader();

    if (!reader) {
      return null;
    }

    const decoder =
      new TextDecoder();

    let html = "";
    let total = 0;

    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      total +=
        value.byteLength;

      if (
        total >
        MAX_HTML_SIZE
      ) {
        await reader.cancel();
        return null;
      }

      html +=
        decoder.decode(
          value,
          {
            stream: true,
          },
        );
    }

    html +=
      decoder.decode();

    return {
      type: "html" as const,
      url: finalUrl,
      html,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function createEmbed(
  rawUrl: string,
): Promise<MessageEmbedData | null> {
  if (
    !(await isSafeExternalUrl(
      rawUrl,
    ))
  ) {
    return null;
  }

  if (
    DIRECT_IMAGE_REGEX.test(
      rawUrl,
    )
  ) {
    return {
      url: rawUrl,
      image: rawUrl,
    };
  }

  const result =
    await fetchPage(rawUrl);

  if (!result) {
    return null;
  }

  if (
    result.type === "image"
  ) {
    return {
      url: result.url,
      image: result.url,
    };
  }

  const {
    html,
    url: finalUrl,
  } = result;

  const canonicalUrl =
    extractCanonicalUrl(
      html,
      finalUrl,
    ) ?? finalUrl;

  const title =
    extractTitle(html);

  const description =
    extractDescription(html);

  const siteName =
    extractSiteName(
      html,
      finalUrl,
    );

  const image =
    extractImage(
      html,
      finalUrl,
    );

  if (
    !title &&
    !description &&
    !image
  ) {
    return null;
  }

  return {
    url: canonicalUrl,
    title,
    description,
    siteName,
    image,
  };
}

function extractUrls(
  content: string,
) {
  const matches =
    content.match(
      URL_REGEX,
    ) ?? [];

  return Array.from(
    new Set(
      matches.map((url) =>
        url.replace(
          /[),.;!?]+$/g,
          "",
        ),
      ),
    ),
  ).slice(
    0,
    MAX_URLS,
  );
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request
        .json()
        .catch(
          () => null,
        )) as LinkPreviewRequest | null;

    const content =
      typeof body?.content ===
      "string"
        ? body.content.trim()
        : "";

    if (!content) {
      return NextResponse.json({
        success: true,
        embeds: [],
      });
    }

    if (
      /\[GIF\b/i.test(
        content,
      )
    ) {
      return NextResponse.json({
        success: true,
        embeds: [],
      });
    }

    const urls =
      extractUrls(content);

    if (
      urls.length === 0
    ) {
      return NextResponse.json({
        success: true,
        embeds: [],
      });
    }

    const results =
      await Promise.allSettled(
        urls.map(
          createEmbed,
        ),
      );

    const embeds =
      results
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<MessageEmbedData | null> =>
            result.status ===
            "fulfilled",
        )
        .map(
          (result) =>
            result.value,
        )
        .filter(
          (
            embed,
          ): embed is MessageEmbedData =>
            embed !== null,
        );

    return NextResponse.json({
      success: true,
      embeds,
    });
  } catch (error) {
    console.error(
      "[LINK_PREVIEW_API]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        embeds: [],
        message:
          "Não foi possível gerar a prévia do link.",
      },
      {
        status: 500,
      },
    );
  }
}