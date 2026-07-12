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

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Image fetch failed:', (err as Error).message);
    return null;
  }
}

export default function SecureBookViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pages, setPages] = useState<PageFile[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
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

  const handlePrint = useCallback(async () => {
    if (!id) return;

    const confirmed = window.confirm(
      'Click OK to open the system print dialog.\n\n' +
      'IMPORTANT: Please select a physical printer (USB/WiFi). ' +
      'Saving as PDF is monitored and each page is watermarked with your identity.'
    );
    if (!confirmed) return;

    const copiesInput = prompt('How many copies? (1-10)', '1');
    const safeCopies = Math.max(1, Math.min(10, parseInt(copiesInput || '1', 10) || 1));

    setIsPrinting(true);
    setPrintMsg('Logging print session...');

    try {
      const { data } = await booksApi.logPrintSession({ book_id: id, copies: safeCopies });
      const bookshopName: string = data.bookshop_name || 'Unknown';

      setPrintMsg('Fetching pages...');
      const rawUrls = pages.map(p => getTokenUrl(p.id));
      const results = await Promise.allSettled(rawUrls.map(url => fetchAsBase64(url)));
      const validImages: string[] = [];
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value !== null) {
          validImages.push(r.value);
        }
      });

      if (validImages.length === 0) {
        throw new Error('Failed to load any pages. Please try again.');
      }

      setPrintMsg('Preparing print pages...');

      const now = new Date();
      const dateStr = now.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      const watermarkText = `CONFIDENTIAL - ${bookshopName} - ${dateStr} - DO NOT DISTRIBUTE`;

      let pagesHTML = '';
      for (let c = 0; c < safeCopies; c++) {
        validImages.forEach((base64) => {
          pagesHTML += `
    <div class="print-page">
      <img src="${base64}" class="book-image" />
      <div class="watermark-container">
        <span class="watermark">${watermarkText}</span>
        <span class="watermark">${watermarkText}</span>
        <span class="watermark">${watermarkText}</span>
      </div>
    </div>`;
        });
      }

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow!.document;

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow!.focus();
          iframe.contentWindow!.print();
          setIsPrinting(false);
          setPrintMsg('');
        }, 300);
      };

      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print Book</title>
  <style>
    @page { margin: 0; size: A4; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-page { page-break-after: always; }
    }
    body { margin: 0; padding: 0; background: white; }
    .print-page {
      width: 210mm;
      height: 297mm;
      position: relative;
      overflow: hidden;
      background: white;
    }
    .book-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .watermark-container {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 9999;
    }
    .watermark {
      position: absolute;
      font-size: 3rem;
      font-weight: 900;
      color: rgba(255, 0, 0, 0.3);
      white-space: nowrap;
      transform: translate(-50%, -50%) rotate(-45deg);
    }
    .watermark:nth-child(1) { top: 20%; left: 10%; }
    .watermark:nth-child(2) { top: 50%; left: 50%; }
    .watermark:nth-child(3) { top: 80%; left: 20%; }
  </style>
</head>
<body>${pagesHTML}</body>
</html>`);
      doc.close();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 10000);
    } catch (err: unknown) {
      setIsPrinting(false);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as Error).message || 'Print failed';
      setPrintMsg(msg);
    }
  }, [id, pages]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            &larr; Back
          </button>
          <h1 className="text-lg font-bold text-gray-900">Secure Book Viewer</h1>
          {pages.length > 0 && (
            <span className="text-xs text-gray-400 ml-1">{pages.length} page{pages.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <button
          onClick={handlePrint}
          disabled={isPrinting || pages.length === 0}
          className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isPrinting ? 'Processing...' : 'Print Book'}
        </button>
      </div>

      {printMsg && (
        <div className={`mx-6 mt-3 px-4 py-2 rounded-lg text-sm print:hidden ${
          printMsg.toLowerCase().includes('failed') || printMsg.toLowerCase().includes('error')
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {printMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto" onContextMenu={(e) => e.preventDefault()}>
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading book pages...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-6">
              <p className="text-red-600 font-medium mb-1">Unable to load book</p>
              <p className="text-sm text-gray-500">{error}</p>
              <p className="text-xs text-gray-400 mt-2">Make sure the book has pages and you have access.</p>
            </div>
          </div>
        )}
        {!loading && pages.length > 0 && (
          <div className="py-6 px-4">
            {pages.map((page) => (
              <div
                key={page.id}
                className="w-full max-w-[800px] mx-auto mb-6 bg-white rounded-lg shadow-md overflow-hidden"
                style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              >
                <img
                  src={getTokenUrl(page.id)}
                  alt={`Page ${page.page_number}`}
                  className="w-full h-auto"
                  draggable="false"
                  style={{ userSelect: 'none', WebkitUserDrag: 'none', pointerEvents: 'none' } as React.CSSProperties}
                  onDragStart={(e) => e.preventDefault()}
                />
              </div>
            ))}
          </div>
        )}
        {!loading && pages.length === 0 && !error && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">No pages found for this book.</p>
          </div>
        )}
      </div>

      {isPrinting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl p-8 shadow-2xl mx-4 max-w-sm w-full">
            <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-700 font-semibold text-center">Processing book pages...</p>
            <p className="text-sm text-gray-400 mt-2 text-center">{printMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
