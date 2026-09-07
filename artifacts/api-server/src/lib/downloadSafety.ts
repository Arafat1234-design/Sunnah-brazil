import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = MAX_DOWNLOAD_BYTES;

const PDF_HEADER = Buffer.from("%PDF-");
const ZIP_HEADER = Buffer.from("PK");
const MOBI_HEADER = Buffer.from("BOOKMOBI");

export class UnsafeDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeDownloadError";
    Object.setPrototypeOf(this, UnsafeDownloadError.prototype);
  }
}

export function normalizeManagedObjectPath(value: string): string | null {
  if (value.startsWith("/objects/")) return value;
  if (value.startsWith("/api/storage/objects/")) {
    return value.slice("/api/storage".length);
  }
  return null;
}

export function isManagedObjectUrl(value: string | null | undefined): boolean {
  return Boolean(value && normalizeManagedObjectPath(value));
}

function hasPrefix(buffer: Buffer, prefix: Buffer): boolean {
  return buffer.subarray(0, prefix.length).equals(prefix);
}

function assertWithinLimit(buffer: Buffer): void {
  if (buffer.length === 0 || buffer.length > MAX_DOWNLOAD_BYTES) {
    throw new UnsafeDownloadError("The file size is outside the safe limit");
  }
}

function assertBookSignature(fileType: string, source: Buffer): void {
  assertWithinLimit(source);

  if (fileType === "PDF" && !hasPrefix(source, PDF_HEADER)) {
    throw new UnsafeDownloadError("The file is not a valid PDF");
  }

  if (fileType === "EPUB" && !hasPrefix(source, ZIP_HEADER)) {
    throw new UnsafeDownloadError("The file is not a valid EPUB archive");
  }

  if (
    fileType === "MOBI" &&
    (source.length < 68 || !source.subarray(60, 68).equals(MOBI_HEADER))
  ) {
    throw new UnsafeDownloadError("The file is not a valid MOBI book");
  }

  if (fileType === "TXT" && source.includes(0)) {
    throw new UnsafeDownloadError("The text file contains binary data");
  }
}

/**
 * Rewrites PDFs with MuPDF before they leave the server. This removes
 * encryption, drops the structure tree, sanitizes content streams, and
 * gives the browser a fresh PDF instead of the original upload.
 */
export async function sanitizePdf(source: Buffer): Promise<Buffer> {
  assertBookSignature("PDF", source);

  const workDir = await mkdtemp(join(tmpdir(), "openshelf-pdf-"));
  const inputPath = join(workDir, "input.pdf");
  const outputPath = join(workDir, "safe.pdf");

  try {
    await writeFile(inputPath, source, { mode: 0o600 });
    const sanitizer = process.env.PDF_SANITIZER_BIN || "mutool";

    await execFileAsync(
      sanitizer,
      [
        "clean",
        "-gggg",
        "-s",
        "-D",
        "--structure=drop",
        inputPath,
        outputPath,
      ],
      {
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );

    const safePdf = await readFile(outputPath);
    assertBookSignature("PDF", safePdf);

    const { stdout } = await execFileAsync(
      process.env.PDFINFO_BIN || "pdfinfo",
      [outputPath],
      {
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    if (/JavaScript:\s+yes/i.test(stdout)) {
      throw new UnsafeDownloadError("The PDF contains active JavaScript");
    }

    return safePdf;
  } catch (error) {
    if (error instanceof UnsafeDownloadError) throw error;
    throw new UnsafeDownloadError(
      "The PDF could not be safely validated and was blocked",
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function prepareBookContent(
  fileType: string,
  source: Buffer,
): Promise<{ output: Buffer; extension: string; contentType: string }> {
  const normalizedType = fileType.toUpperCase();

  if (normalizedType === "PDF") {
    return {
      output: await sanitizePdf(source),
      extension: "pdf",
      contentType: "application/pdf",
    };
  }

  assertBookSignature(normalizedType, source);

  if (normalizedType === "TXT") {
    return {
      output: textToPdf(source.toString("utf8")),
      extension: "pdf",
      contentType: "application/pdf",
    };
  }

  if (normalizedType === "EPUB") {
    return {
      output: source,
      extension: "epub",
      contentType: "application/epub+zip",
    };
  }

  if (normalizedType === "MOBI") {
    return {
      output: source,
      extension: "mobi",
      contentType: "application/x-mobipocket-ebook",
    };
  }

  throw new UnsafeDownloadError("This book format is not supported");
}

export function assertMp4Signature(source: Buffer): void {
  assertWithinLimit(source);
  if (source.length < 12 || source.subarray(4, 8).toString("ascii") !== "ftyp") {
    throw new UnsafeDownloadError("The video is not a valid MP4 file");
  }
}

function textToPdf(text: string): Buffer {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").flatMap((line) => {
    if (!line) return [""];
    const wrapped: string[] = [];
    let remaining = line;
    while (remaining.length > 96) {
      const breakAt = remaining.lastIndexOf(" ", 96);
      const splitAt = breakAt > 20 ? breakAt : 96;
      wrapped.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    wrapped.push(remaining);
    return wrapped;
  });
  const pageLines = 52;
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(lines.length / pageLines)) },
    (_, index) => lines.slice(index * pageLines, (index + 1) * pageLines),
  );
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );
  const pageIds: number[] = [];

  for (const page of pages) {
    const pageId = addObject("");
    const content = [
      "BT",
      "/F1 10 Tf",
      "54 760 Td",
      "12 TL",
      ...page.map(
        (line, index) =>
          `(${pdfEscape(line)}) Tj${index === page.length - 1 ? "" : " T*"}`,
      ),
      "ET",
    ].join("\n");
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
    );
    objects[pageId - 1] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const chunks = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
  const offsets = [0];
  let length = Buffer.byteLength(chunks[0], "binary");
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(chunk);
    length += Buffer.byteLength(chunk, "binary");
  });
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  chunks.push(
    `${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  );
  return Buffer.from(chunks.join(""), "binary");
}

function pdfEscape(value: string): string {
  return value
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/([\\()])/g, "\\$1");
}