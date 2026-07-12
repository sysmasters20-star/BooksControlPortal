import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { printApi } from '../api/print';

const BLOCKED_KEYS = new Set([
  'PrintScreen', 'F12',
  'Insert', 'Delete',
]);

const CTRL_COMBOS = new Set(['p', 's', 'u', 'j', 'i', 'c', 'x', 'a']);

export default function PrintViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showShopDialog, setShowShopDialog] = useState(false);
  const [bookshopId, setBookshopId] = useState('');
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState('');
  const [bookshopName, setBookshopName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [screenshotWarning, setScreenshotWarning] = useState(false);

  useEffect(() => {
    if (!id) return;
    const role = localStorage.getItem('userRole');
    if (role === 'admin') { setShowShopDialog(true); return; }
    loadMetadata();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || BLOCKED_KEYS.has(e.key)) {
        e.preventDefault();
        setScreenshotWarning(true);
        setTimeout(() => setScreenshotWarning(false), 2000);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && CTRL_COMBOS.has(e.key.toLowerCase())) {
        e.preventDefault();
        setScreenshotWarning(true);
        setTimeout(() => setScreenshotWarning(false), 2000);
        return;
      }
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();
    const handleCut = (e: ClipboardEvent) => e.preventDefault();
    const handleSelectStart = (e: Event) => e.preventDefault();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('selectstart', handleSelectStart);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (printing) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [printing]);

  const loadMetadata = async (shopId?: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (shopId) params.bookshop_id = shopId;
      const { data } = await printApi.viewWatermarked(id, params);
      setBookshopName(data.bookshopName);
      setSessionId(data.sessionId);
      await loadPdf(id, data.sessionId);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load book');
    } finally {
      setLoading(false);
    }
  };

  const loadPdf = async (bookId: string, sessId: string) => {
    try {
      const response = await printApi.getSessionPdf(bookId, sessId);
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch {
      setError('Failed to load PDF document');
    }
  };

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

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
      const { data } = await printApi.countPrint(id, { copies, bookshop_id: bookshopId || undefined });
      setPrintMsg('Preparing print...');
      const printToken = data.print_token;
      const pdfResponse = await printApi.generatePrintPdf(id, { sessionId, copies, printToken });
      const blob = new Blob([pdfResponse.data as BlobPart], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => { printWindow.print(); };
      }
      setPrintMsg('Print job sent successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Print failed';
      setPrintMsg(msg);
    } finally {
      setPrinting(false);
    }
  }, [id, copies, bookshopId, sessionId]);

  const handleShopConfirm = () => {
    setShowShopDialog(false);
    loadMetadata(bookshopId || undefined);
  };

  const handleCancelPrint = () => setShowPrintDialog(false);

  return (
    <div
      className="flex flex-col h-[calc(100vh-8rem)] anti-capture"
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
    >
      {screenshotWarning && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white text-center py-3 text-sm font-bold animate-pulse">
          Screen capture is not allowed. This action has been logged.
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 print:hidden">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">&larr; Back</button>
          <h1 className="text-lg font-bold text-gray-900 mt-1">Secure PDF Viewer</h1>
          {bookshopName && <p className="text-xs text-gray-400">Watermark: {bookshopName}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrintClick} disabled={printing || !pdfLoaded} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
            {printing ? 'Printing...' : 'Print'}
          </button>
        </div>
      </div>

      {printMsg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm print:hidden ${printMsg.includes('failed') || printMsg.includes('not allowed') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {printMsg}
        </div>
      )}

      <div className="flex-1 bg-gray-100 rounded-xl border border-gray-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading secure document...</p>
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
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Secure PDF Viewer"
            onLoad={() => setPdfLoaded(true)}
            sandbox="allow-same-origin"
            referrerPolicy="no-referrer"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {!loading && !error && !pdfUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400">Preparing document...</p>
          </div>
        )}
      </div>

      {showShopDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Bookshop Selection</h3>
            <p className="text-sm text-gray-500 mb-4">Enter a Bookshop ID to view that shop's watermark, or leave empty for admin preview.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bookshop ID (optional)</label>
              <input type="text" value={bookshopId} onChange={(e) => setBookshopId(e.target.value)} placeholder="Leave empty for admin preview" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowShopDialog(false); navigate(-1); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleShopConfirm} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">View PDF</button>
            </div>
          </div>
        </div>
      )}

      {showPrintDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleCancelPrint}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Confirm Print</h3>
            <p className="text-sm text-gray-500 mb-4">This action will be recorded. Watermarks will appear on every page.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of copies</label>
              <input type="number" min={1} max={1000} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(1000, Number(e.target.value))))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancelPrint} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleConfirmPrint} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">Confirm & Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
