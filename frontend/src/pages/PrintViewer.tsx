import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { booksApi } from '../api/books';
import printJS from 'print-js';

interface PageFile {
  id: string;
  page_number: number;
}

export default function SecureBookViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pages, setPages] = useState<PageFile[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  const loadPages = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await booksApi.listPageFiles(id);
      const fileList: PageFile[] = data.files || [];
      setPages(fileList);

      const urls: Record<string, string> = {};
      await Promise.all(fileList.map(async (pf) => {
        try {
          const resp = await booksApi.getFile(pf.id);
          urls[pf.id] = URL.createObjectURL(resp.data as Blob);
        } catch { }
      }));
      setImageUrls(urls);
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
      await booksApi.logPrintSession({ book_id: id, copies });
      setPrintMsg('Preparing print...');
      const printableUrls = pages.map(p => imageUrls[p.id]).filter(Boolean);
      printJS({
        printable: printableUrls,
        type: 'image',
        style: '@media print { img { page-break-after: always; } }',
        header: `Book Print - ${copies} copy/copies`,
        onError: () => { setPrintMsg('Print failed or cancelled'); },
      });
      setPrintMsg('Print dialog opened. Please select a physical printer.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Print failed';
      setPrintMsg(msg);
    } finally {
      setPrinting(false);
    }
  }, [id, pages, imageUrls, copies]);

  const handleCancelPrint = () => setShowPrintDialog(false);

  return (
    <div
      className="flex flex-col h-[calc(100vh-8rem)]"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
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

      <div ref={containerRef} className="flex-1 bg-gray-100 rounded-xl border border-gray-200 overflow-y-auto relative">
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
                {imageUrls[page.id] ? (
                  <img
                    src={imageUrls[page.id]}
                    alt={`Page ${page.page_number}`}
                    className="w-full max-w-[800px] shadow-xl rounded-lg"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{ pointerEvents: 'none', userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
                  />
                ) : (
                  <div className="w-full aspect-[3/4] bg-gray-200 rounded-lg flex items-center justify-center">
                    <p className="text-xs text-gray-400">Loading page {page.page_number}...</p>
                  </div>
                )}
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
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 font-medium">Please select a physical printer. Saving as PDF is not permitted.</p>
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
