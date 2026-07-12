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

export default function SecureBookViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pages, setPages] = useState<PageFile[]>([]);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
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
    setPrintMsg('');
    setShowPrintDialog(false);
    try {
      const { data } = await booksApi.logPrintSession({ book_id: id, copies });
      const bookshopName: string = data.bookshop_name || 'Unknown';
      const bookshopId: string = data.bookshop_id || '';
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const watermarkText = `${bookshopName} - ID:${bookshopId} - ${dateStr} ${timeStr}`;

      const imageUrls = pages.map(p => getTokenUrl(p.id));

      let bodyHtml = '<style>';
      bodyHtml += '@page { margin: 0; size: A4; }';
      bodyHtml += 'body { margin: 0; padding: 0; }';
      bodyHtml += '.page-container { position: relative; width: 100%; height: 100vh; page-break-after: always; display: flex; justify-content: center; align-items: center; overflow: hidden; }';
      bodyHtml += '.page-container:last-child { page-break-after: auto; }';
      bodyHtml += '.forensic-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 4rem; font-weight: bold; color: rgba(0, 0, 0, 0.15); pointer-events: none; user-select: none; z-index: 9999; white-space: nowrap; }';
      bodyHtml += 'img { max-width: 100%; max-height: 100%; object-fit: contain; user-select: none; }';
      bodyHtml += '</style>';

      for (const url of imageUrls) {
        bodyHtml += '<div class="page-container">';
        bodyHtml += `<img src="${url}" draggable="false" />`;
        bodyHtml += `<div class="forensic-watermark">${watermarkText}</div>`;
        bodyHtml += '</div>';
      }

      setPrintMsg('Preparing secure print...');

      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow!.document;
      doc.open();
      doc.write(bodyHtml);
      doc.close();

      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();

      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);

      setPrintMsg('Print dialog opened. Please select a physical printer.');
    } catch (err: unknown) {
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
          <button onClick={handlePrintClick} disabled={printing || pages.length === 0} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
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

      {showPrintDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleCancelPrint}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Confirm Print</h3>
            <p className="text-sm text-gray-500 mb-2">This action will be recorded for billing purposes.</p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 font-medium">Please select a physical printer. Saving as PDF is not permitted and will embed your identity.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of copies</label>
              <input type="number" min={1} max={1000} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(1000, Number(e.target.value))))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancelPrint} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleConfirmPrint} disabled={printing} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
                {printing ? 'Processing...' : 'Confirm & Print'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
