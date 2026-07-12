import puppeteer from 'puppeteer';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import type { WatermarkConfig } from '../types/index.js';

let browser: puppeteer.Browser | null = null;

async function getBrowser(): Promise<puppeteer.Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
  }
  return browser;
}

export async function getPageCount(pdfBuffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(pdfBuffer);
  return doc.getPageCount();
}

export async function renderPage(
  pdfBuffer: Buffer,
  pageNum: number,
  totalPages: number,
  watermark: WatermarkConfig,
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer);
  const page = doc.getPages()[pageNum - 1];
  const { width, height } = page.getSize();

  const watermarkText = `${watermark.bookshopName} | ${watermark.date} | Session: ${watermark.sessionId} | Copy ${watermark.copyNum}`;
  const fontSize = Math.min(width, height) * 0.04;

  for (let row = -2; row < 3; row++) {
    for (let col = -2; col < 3; col++) {
      page.drawText(watermarkText, {
        x: width * 0.3 + col * width * 0.5,
        y: height * 0.5 + row * height * 0.4,
        size: fontSize,
        color: rgb(0.25, 0.25, 0.25),
        opacity: 0.15,
        rotate: degrees(-35),
      });
    }
  }

  const footerText = `${watermark.bookshopName} | ${watermark.date} | ${watermark.sessionId}${watermark.ip ? ' | IP: ' + watermark.ip : ''}`;
  page.drawText(footerText, {
    x: 50,
    y: 20,
    size: 6,
    color: rgb(0.5, 0.5, 0.5),
    opacity: 0.8,
  });

  const watermarkedPdf = await doc.save();

  const br = await getBrowser();
  const puppeteerPage = await br.newPage();

  const pdfBase64 = Buffer.from(watermarkedPdf).toString('base64');
  const dataUrl = `data:application/pdf;base64,${pdfBase64}`;

  const scale = 1.5;
  await puppeteerPage.setViewport({
    width: Math.round((width * scale) / 72 * 96),
    height: Math.round((height * scale) / 72 * 96),
    deviceScaleFactor: 2,
  });

  await puppeteerPage.goto(dataUrl, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));

  const screenshot = await puppeteerPage.screenshot({ type: 'png', fullPage: true });
  await puppeteerPage.close();

  return Buffer.from(screenshot);
}

export async function generatePrintPdf(
  pdfBuffer: Buffer,
  watermark: WatermarkConfig,
  copies: number,
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (let copy = 1; copy <= copies; copy++) {
    for (const page of pages) {
      const { width, height } = page.getSize();
      const text = `${watermark.bookshopName} | ${watermark.date} | Session: ${watermark.sessionId} | Copy ${watermark.copyNum}-${copy}`;
      const fontSize = Math.min(width, height) * 0.035;

      for (let row = -2; row < 3; row++) {
        for (let col = -2; col < 3; col++) {
          page.drawText(text, {
            x: width * 0.3 + col * width * 0.5,
            y: height * 0.5 + row * height * 0.4,
            size: fontSize,
            color: rgb(0.25, 0.25, 0.25),
            opacity: 0.15,
            rotate: degrees(-35),
          });
        }
      }

      const pageIdx = pages.indexOf(page) + 1;
      page.drawText(`#${watermark.sessionId}-${copy}-P${pageIdx}`, {
        x: width - 120,
        y: 20,
        size: 6,
        color: rgb(0.4, 0.4, 0.4),
        opacity: 0.9,
      });
    }
  }

  doc.setTitle(`${watermark.bookshopName} - Print Session ${watermark.sessionId}`);
  doc.setAuthor(watermark.bookshopName);
  doc.setSubject(`Generated on ${watermark.date} | Copy ${watermark.copyNum}`);
  doc.setKeywords(['book', 'print', watermark.sessionId, watermark.bookshopName]);

  const result = await doc.save();
  return Buffer.from(result);
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
