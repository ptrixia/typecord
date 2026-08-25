import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

export interface LinkPreviewEmbed {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  color?: string;
  image?: string;
  thumbnail?: string;
}

const MAX_LINKS = 3;
const MAX_HTML_SIZE = 1_500_000;
const REQUEST_TIMEOUT = 5000;
const MAX_REDIRECTS = 3;

export function extractLinks(content: string): string[] {
  const matches =
    content.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];

  const normalized = matches
    .map((url) =>
      url.replace(/[),.!?;:'"]+$/g, ""),
    )
    .filter(Boolean);

  return [...new Set(normalized)].slice(
    0,
    MAX_LINKS,
  );
}

function isPublicIp(address: string) {
  if (!ipaddr.isValid(address)) {
    return false;
  }

  const parsed = ipaddr.process(address);

  return parsed.range() === "unicast";
}

async function validateUrl(
  rawUrl: string,
): Promise<URL> {
  const url = new URL(rawUrl);

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new Error(
      "Protocolo não permitido.",
    );
  }

  if (url.username || url.password) {
    throw new Error(
      "Credenciais na URL não são permitidas.",
    );
  }

  const hostname =
    url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost")
  ) {
    throw new Error(
      "Endereço privado não permitido.",
    );
  }

  const addresses = await lookup(
    hostname,
    {
      all: true,
    },
  );

  if (!addresses.length) {
    throw new Error(
      "Host não encontrado.",
    );
  }

  for (const address of addresses) {
    if (!isPublicIp(address.address)) {
      throw new Error(
        "Endereço privado não permitido.",
      );
    }
  }

  return url;
}

function resolveUrl(
  value: string | undefined,
  baseUrl: string,
): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(
      value,
      baseUrl,
    ).toString();
  } catch {
    return undefined;
  }
}

function normalizeColor(
  color?: string,
): string {
  if (
    color &&
    /^#[0-9a-f]{6}$/i.test(color)
  ) {
    return color;
  }

  if (
    color &&
    /^#[0-9a-f]{3}$/i.test(color)
  ) {
    const [r, g, b] =
      color.slice(1).split("");

    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return "#5865F2";
}

async function readHtmlResponse(
  response: Response,
): Promise<string> {
  const contentLength = Number(
    response.headers.get(
      "content-length",
    ) ?? 0,
  );

  if (
    contentLength &&
    contentLength > MAX_HTML_SIZE
  ) {
    throw new Error(
      "Página muito grande.",
    );
  }

  const reader =
    response.body?.getReader();

  if (!reader) {
    return "";
  }

  const decoder =
    new TextDecoder();

  let received = 0;
  let html = "";

  while (true) {
    const {
      value,
      done,
    } = await reader.read();

    if (done) {
      break;
    }

    received += value.byteLength;

    if (
      received > MAX_HTML_SIZE
    ) {
      await reader.cancel();

      throw new Error(
        "Página muito grande.",
      );
    }

    html += decoder.decode(
      value,
      {
        stream: true,
      },
    );
  }

  html += decoder.decode();

  return html;
}

async function fetchHtml(
  initialUrl: string,
): Promise<{
  html: string;
  finalUrl: string;
}> {
  let currentUrl = initialUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount++
  ) {
    await validateUrl(currentUrl);

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
        await fetch(currentUrl, {
          signal:
            controller.signal,

          redirect: "manual",

          headers: {
            Accept:
              "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",

            "User-Agent":
              "Mozilla/5.0 (compatible; TypecordPreview/1.0)",
          },

          cache: "no-store",
        });

      if (
        response.status >= 300 &&
        response.status < 400
      ) {
        const location =
          response.headers.get(
            "location",
          );

        if (!location) {
          throw new Error(
            "Redirecionamento inválido.",
          );
        }

        currentUrl =
          new URL(
            location,
            currentUrl,
          ).toString();

        continue;
      }

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`,
        );
      }

      const contentType =
        response.headers
          .get("content-type")
          ?.toLowerCase() ?? "";

      if (
        !contentType.includes(
          "text/html",
        ) &&
        !contentType.includes(
          "application/xhtml+xml",
        )
      ) {
        throw new Error(
          "O endereço não é uma página HTML.",
        );
      }

      const html =
        await readHtmlResponse(
          response,
        );

      return {
        html,
        finalUrl: currentUrl,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(
    "Muitos redirecionamentos.",
  );
}

export async function getLinkPreview(
  rawUrl: string,
): Promise<LinkPreviewEmbed | null> {
  try {
    const {
      html,
      finalUrl,
    } = await fetchHtml(
      rawUrl,
    );

    const $ =
      cheerio.load(html);

    function property(
      name: string,
    ) {
      return $(
        `meta[property="${name}"]`,
      )
        .first()
        .attr("content")
        ?.trim();
    }

    function metaName(
      name: string,
    ) {
      return $(
        `meta[name="${name}"]`,
      )
        .first()
        .attr("content")
        ?.trim();
    }

    const title =
      property("og:title") ||
      metaName(
        "twitter:title",
      ) ||
      $("title")
        .first()
        .text()
        .trim() ||
      undefined;

    const description =
      property(
        "og:description",
      ) ||
      metaName(
        "twitter:description",
      ) ||
      metaName("description") ||
      undefined;

    const siteName =
      property(
        "og:site_name",
      ) ||
      new URL(
        finalUrl,
      ).hostname.replace(
        /^www\./i,
        "",
      );

    const image =
      property("og:image") ||
      property(
        "og:image:secure_url",
      ) ||
      metaName(
        "twitter:image",
      ) ||
      metaName(
        "twitter:image:src",
      );

    const canonical =
      property("og:url") ||
      $(
        'link[rel="canonical"]',
      )
        .first()
        .attr("href");

    const themeColor =
      metaName("theme-color");

    const resolvedUrl =
      resolveUrl(
        canonical,
        finalUrl,
      ) ?? finalUrl;

    const resolvedImage =
      resolveUrl(
        image,
        finalUrl,
      );

    if (
      !title &&
      !description &&
      !resolvedImage
    ) {
      return null;
    }

    return {
      url: resolvedUrl,

      title:
        title
          ?.replace(
            /\s+/g,
            " ",
          )
          .trim()
          .slice(0, 256),

      description:
        description
          ?.replace(
            /\s+/g,
            " ",
          )
          .trim()
          .slice(0, 1000),

      siteName:
        siteName
          ?.replace(
            /\s+/g,
            " ",
          )
          .trim()
          .slice(0, 128),

      image:
        resolvedImage,

      color:
        normalizeColor(
          themeColor,
        ),
    };
  } catch (error) {
    console.warn(
      "[LINK_PREVIEW]",
      rawUrl,
      error instanceof Error
        ? error.message
        : error,
    );

    return null;
  }
}

export async function getLinkPreviews(
  content: string,
): Promise<LinkPreviewEmbed[]> {
  const links =
    extractLinks(content);

  if (!links.length) {
    return [];
  }

  const results =
    await Promise.allSettled(
      links.map(
        getLinkPreview,
      ),
    );

  const previews: LinkPreviewEmbed[] =
    [];

  for (const result of results) {
    if (
      result.status ===
        "fulfilled" &&
      result.value
    ) {
      previews.push(
        result.value,
      );
    }
  }

  return previews;
}