import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { booksApi } from '../api/books';

interface PageFile {
  id: string;
  page_number: number;
}

function getTokenUrl(fileId: string): string {
  const token = localStorage.getItem('accessToken') || '';
  return `/api/books/files/${fileId}?token=${encodeURIComponent(token)}`;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('accessToken') || '';
  return { Authorization: `Bearer ${token}` };
}

async function fetchAsBase64(url: string): Promise<string> {
  const response = await fetch(url, { headers: getAuthHeaders() });
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const PRINT_BLOCKER_ID = 'print-blocker';
const PRINT_FRAME_ID = 'print-frame';

function injectPrintBlocker() {
  const existing = document.getElementById(PRINT_BLOCKER_ID);
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = PRINT_BLOCKER_ID;
  style.textContent = `@media print { html { display: none !important; } }`;
  document.documentElement.appendChild(style);
}

function removePrintBlocker() {
  document.getElementById(PRINT_BLOCKER_ID)?.remove();
}

function cleanupFrame(iframe: HTMLIFrameElement) {
  if (document.body.contains(iframe)) document.body.removeChild(iframe);
  removePrintBlocker();
}

export default function SecureBookViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pages, setPages] = useState<PageFile[]>([]);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printMsg, setPrintMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    loadPages();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || e.key === 'PrintScreen') {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'u', 'j', 'i'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return;
      }
    };
    const handler = (e: Event) => e.preventDefault();
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handler);
    document.addEventListener('copy', handler);
    document.addEventListener('cut', handler);
    document.addEventListener('selectstart', handler);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handler);
      document.removeEventListener('copy', handler);
      document.removeEventListener('cut', handler);
      document.removeEventListener('selectstart', handler);
    };
  }, []);

  const loadPages = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await booksApi.listPageFiles(id);
      setPages(data.files || []);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load book');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintClick = () => {
    if (!id) return;
    setShowPrintDialog(true);
    setPrintMsg('');
  };

  const handleConfirmPrint = useCallback(async () => {
    if (!id) return;
    setPrinting(true);
    setIsProcessing(true);
    setPrintMsg('');
    setShowPrintDialog(false);
    try {
      const safeCopies = Math.max(1, Math.min(10, copies));
      const { data } = await booksApi.logPrintSession({ book_id: id, copies: safeCopies });
      const bookshopName: string = data.bookshop_name || 'Unknown';
      const now = new Date();
      const dateStr = now.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateOnly = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const watermarkText = `CONFIDENTIAL - ${bookshopName} - ${dateStr} - DO NOT DISTRIBUTE`;

      setPrintMsg('Fetching pages...');
      const rawUrls = pages.map(p => getTokenUrl(p.id));
      const results = await Promise.allSettled(rawUrls.map(fetchAsBase64));
      const base64Images: string[] = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          base64Images.push(r.value);
        } else {
          console.warn(`Page ${i + 1} skipped — failed to convert:`, r.reason);
        }
      });

      if (base64Images.length === 0) {
        throw new Error('Failed to load any pages. Please try again.');
      }

      setPrintMsg('Preparing secure print...');

      let pagesHTML = '';
      for (let c = 0; c < safeCopies; c++) {
        for (const base64 of base64Images) {
          pagesHTML += `
          <div class="page-container">
            <img src="${base64}" class="page-image" />
            <div class="watermark-grid">
              <span class="wm wm-1">${watermarkText}</span>
              <span class="wm wm-2">${watermarkText}</span>
              <span class="wm wm-3">${watermarkText}</span>
              <span class="wm wm-4">${watermarkText}</span>
              <span class="wm wm-5">${watermarkText}</span>
              <span class="wm wm-6">${watermarkText}</span>
            </div>
            <div class="red-border">UNAUTHORIZED COPY - ${bookshopName} - ${dateOnly}</div>
          </div>`;
        }
      }

      const fullHtml = `<!DOCTYPE html>
<html>
<head>
<style>
  @page { margin: 0; size: A4; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white !important; }
  .page-container {
    position: relative;
    width: 210mm;
    height: 297mm;
    page-break-after: always;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 3px solid red;
    box-sizing: border-box;
  }
  .page-container:last-child { page-break-after: auto; }
  .page-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    opacity: 0.75;
    user-select: none;
  }
  .watermark-grid {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none;
    z-index: 9999;
  }
  .wm {
    position: absolute;
    font-size: 2.5rem;
    font-weight: 900;
    color: rgba(255, 0, 0, 0.35);
    transform: rotate(-35deg);
    white-space: nowrap;
    user-select: none;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
  }
  .wm-1 { top: 10%; left: -10%; }
  .wm-2 { top: 30%; left: 20%; }
  .wm-3 { top: 50%; left: -5%; }
  .wm-4 { top: 70%; left: 25%; }
  .wm-5 { top: 20%; left: 50%; }
  .wm-6 { top: 80%; left: 45%; }
  .red-border {
    position: absolute;
    bottom: 5px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.9rem;
    font-weight: bold;
    color: red;
    background: yellow;
    padding: 2px 8px;
    z-index: 10000;
    white-space: nowrap;
  }
</style>
</head>
<body>${pagesHTML}</body>
</html>`;

      injectPrintBlocker();

      const iframe = document.createElement('iframe');
      iframe.id = PRINT_FRAME_ID;
      iframe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
      iframe.srcdoc = fullHtml;
      document.body.appendChild(iframe);

      await new Promise<void>((resolve, reject) => {
        iframe.onload = () => resolve();
        iframe.onerror = () => reject(new Error('Print frame failed to load'));
        setTimeout(() => resolve(), 15000);
      });

      iframe.contentWindow!.focus();

      try {
        if (!iframe.contentWindow!.document.execCommand('print', false, undefined)) {
          iframe.contentWindow!.print();
        }
      } catch {
        iframe.contentWindow!.print();
      }

      setIsProcessing(false);
      setPrintMsg('Print dialog opened. Please select a physical printer (USB/WiFi/Bluetooth). Saving as PDF is monitored and watermarked.');

      iframe.contentWindow!.addEventListener('afterprint', () => {
        cleanupFrame(iframe);
      });
      setTimeout(() => {
        cleanupFrame(iframe);
      }, 15000);
    } catch (err: unknown) {
      setIsProcessing(false);
      removePrintBlocker();
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Print failed';
      setPrintMsg(msg);
    } finally {
      setPrinting(false);
    }
  }, [id, pages, copies]);

  const handleCancelPrint = () => setShowPrintDialog(false);

  return (
    <div
      className="flex flex-col h-[calc(100vh-8rem)]"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 print:hidden">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">&larr; Back</button>
          <h1 className="text-lg font-bold text-gray-900 mt-1">Secure Book Viewer</h1>
          {pages.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{pages.length} page{pages.length > 1 ? 's' : ''}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrintClick} disabled={printing || isProcessing || pages.length === 0} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
            {printing ? 'Printing...' : 'Print Book'}
          </button>
        </div>
      </div>

      {printMsg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm print:hidden ${printMsg.includes('failed') || printMsg.includes('cancelled') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {printMsg}
        </div>
      )}

      <div className="flex-1 bg-gray-100 rounded-xl border border-gray-200 overflow-y-auto relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading book pages...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center px-6">
              <p className="text-red-600 font-medium mb-1">Unable to load book</p>
              <p className="text-sm text-gray-500">{error}</p>
              <p className="text-xs text-gray-400 mt-2">Make sure the book has pages and you have access.</p>
            </div>
          </div>
        )}
        {!loading && pages.length > 0 && (
          <div className="flex flex-col items-center gap-4 py-6 px-4">
            {pages.map((page) => (
              <div key={page.id} className="w-full max-w-[800px] relative">
                <img
                  src={getTokenUrl(page.id)}
                  alt={`Page ${page.page_number}`}
                  className="w-full max-w-[800px] shadow-xl rounded-lg"
                  draggable="false"
                  style={{ pointerEvents: 'none', userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
                  onDragStart={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                />
                <div
                  className="absolute inset-0 z-10"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                />
              </div>
            ))}
          </div>
        )}
        {!loading && pages.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400">No pages found for this book.</p>
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl p-8 shadow-2xl mx-4 max-w-sm w-full">
            <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-700 font-semibold text-center">Processing book pages...</p>
            <p className="text-sm text-gray-400 mt-2 text-center">{printMsg}</p>
          </div>
        </div>
      )}

      {showPrintDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleCancelPrint}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Confirm Print</h3>
            <p className="text-sm text-gray-500 mb-2">This action will be recorded for billing purposes.</p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 font-medium">WARNING: Please select a physical printer (USB/WiFi/Bluetooth). Saving as PDF is monitored and watermarked with your identity.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of copies</label>
              <input type="number" min={1} max={10} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(10, Number(e.target.value))))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancelPrint} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleConfirmPrint} disabled={printing || isProcessing} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
                {printing ? 'Processing...' : 'Confirm & Print'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
