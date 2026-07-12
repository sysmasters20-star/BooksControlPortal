import { useEffect, useState, useRef, useCallback } from 'react';
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
  const [totalPages, setTotalPages] = useState(0);
  const [bookshopName, setBookshopName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loadedPages, setLoadedPages] = useState<Record<number, string>>({});
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        return;
      }
      if ((e.ctrlKey || e.metaKey) && CTRL_COMBOS.has(e.key.toLowerCase())) {
        e.preventDefault();
        return;
      }
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();
    const handleCut = (e: ClipboardEvent) => e.preventDefault();
    const handleSelectStart = (e: Event) => e.preventDefault();
    const handleWheel = (e: WheelEvent) => e.preventDefault();
    const handleTouchStart = (e: TouchEvent) => e.preventDefault();
    const handleTouchMove = (e: TouchEvent) => e.preventDefault();

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(loadedPages).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const loadMetadata = async (shopId?: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (shopId) params.bookshop_id = shopId;
      const { data } = await printApi.viewWatermarked(id, params);
      setTotalPages(data.totalPages);
      setBookshopName(data.bookshopName);
      setSessionId(data.sessionId);
      setMetadataLoaded(true);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load book');
    } finally {
      setLoading(false);
    }
  };

  const loadPage = useCallback(async (pageNum: number) => {
    if (!id || !sessionId || loadedPages[pageNum] || loadingPages.has(pageNum)) return;
    setLoadingPages(prev => new Set(prev).add(pageNum));
    try {
      const response = await printApi.getPage(id, pageNum, { sessionId });
      const blobUrl = URL.createObjectURL(response.data as Blob);
      setLoadedPages(prev => ({ ...prev, [pageNum]: blobUrl }));
    } catch {
      // silently fail for individual pages
    } finally {
      setLoadingPages(prev => {
        const next = new Set(prev);
        next.delete(pageNum);
        return next;
      });
    }
  }, [id, sessionId, loadedPages, loadingPages]);

  useEffect(() => {
    if (!metadataLoaded || !totalPages) return;
    const visiblePages = [1, 2, 3];
    visiblePages.forEach(p => { if (p <= totalPages) loadPage(p); });
  }, [metadataLoaded, totalPages, loadPage]);

  useEffect(() => {
    if (!metadataLoaded || !totalPages) return;
    const handleScroll = () => {
      if (!containerRef.current) return;
      const { scrollTop, clientHeight } = containerRef.current;
      const pageHeight = 800;
      const startPage = Math.max(1, Math.floor(scrollTop / pageHeight) - 1);
      const endPage = Math.min(totalPages, Math.ceil((scrollTop + clientHeight) / pageHeight) + 2);
      for (let i = startPage; i <= endPage; i++) {
        if (!loadedPages[i] && !loadingPages.has(i)) {
          loadPage(i);
        }
      }
    };
    const container = containerRef.current;
    container?.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [metadataLoaded, totalPages, loadedPages, loadingPages, loadPage]);

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
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      setPrintMsg('Print dialog opened. Please select a physical printer.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 print:hidden">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">&larr; Back</button>
          <h1 className="text-lg font-bold text-gray-900 mt-1">Secure PDF Viewer</h1>
          {totalPages > 0 && <p className="text-xs text-gray-400 mt-0.5">{totalPages} page{totalPages > 1 ? 's' : ''}</p>}
          {bookshopName && <p className="text-xs text-gray-400">Watermark: {bookshopName}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrintClick} disabled={printing || totalPages === 0} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
            {printing ? 'Printing...' : 'Print'}
          </button>
        </div>
      </div>

      {printMsg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm print:hidden ${printMsg.includes('failed') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {printMsg}
        </div>
      )}

      <div ref={containerRef} className="flex-1 bg-gray-100 rounded-xl border border-gray-200 overflow-y-auto relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading watermarked book...</p>
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
        {metadataLoaded && totalPages > 0 && (
          <div className="flex flex-col items-center gap-4 py-6 px-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <div key={pageNum} className="w-full max-w-[800px] relative">
                {!loadedPages[pageNum] && (
                  <div className="w-full aspect-[3/4] bg-gray-200 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-1" />
                      <p className="text-xs text-gray-400">Loading page {pageNum}...</p>
                    </div>
                  </div>
                )}
                {loadedPages[pageNum] && (
                  <img
                    src={loadedPages[pageNum]}
                    alt={`Page ${pageNum}`}
                    className="w-full max-w-[800px] shadow-xl rounded-lg"
                    draggable={false}
                  />
                )}
              </div>
            ))}
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
            <p className="text-sm text-gray-500 mb-2">This action will be recorded. Watermarks will appear on every page.</p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 font-medium">Please select a physical printer. Saving as PDF is not permitted and is logged.</p>
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
