import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { printApi } from '../api/print';

export default function PrintViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showShopDialog, setShowShopDialog] = useState(false);
  const [bookshopId, setBookshopId] = useState('');
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!id) return;
    const role = localStorage.getItem('userRole');
    const token = localStorage.getItem('accessToken');
    if (!token) { setError('Not authenticated'); setLoading(false); return; }

    if (role === 'admin') {
      setShowShopDialog(true);
      return;
    }

    setLoading(false);
    const url = `/api/print/${id}/view?token=${encodeURIComponent(token)}`;
    setPdfUrl(url);
  }, [id]);

  const handleShopConfirm = () => {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('userRole');
    if (!id || !token) return;

    let url = `/api/print/${id}/view?token=${encodeURIComponent(token)}`;
    if (role === 'admin' && bookshopId) {
      url += `&bookshop_id=${encodeURIComponent(bookshopId)}`;
    }
    setShowShopDialog(false);
    setLoading(false);
    setPdfUrl(url);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && ['s', 'S'].includes(e.key)) || e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'I', 'j', 'J'].includes(e.key))) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      setPrintMsg(`Print session logged: ${data.session.copies} copy/copies`);
      if (iframeRef.current) {
        iframeRef.current.contentWindow?.print();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Print recording failed';
      setPrintMsg(msg);
    } finally {
      setPrinting(false);
    }
  }, [id, copies, bookshopId]);

  const handleCancelPrint = () => {
    setShowPrintDialog(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] select-none print-notice" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">&larr; Back</button>
          <h1 className="text-lg font-bold text-gray-900 mt-1">Secure PDF Viewer</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrintClick} disabled={printing || !pdfUrl} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
            {printing ? 'Recording...' : 'Print'}
          </button>
        </div>
      </div>

      {printMsg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${printMsg.includes('failed') || printMsg.includes('blocked') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {printMsg}
        </div>
      )}

      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading watermarked PDF...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center px-6">
              <p className="text-red-600 font-medium mb-1">Unable to load PDF</p>
              <p className="text-sm text-gray-500">{error}</p>
              <p className="text-xs text-gray-400 mt-2">Make sure the book has a PDF uploaded and you have access.</p>
            </div>
          </div>
        )}
        {pdfUrl && (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full"
            title="Secure PDF Viewer"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        )}
      </div>

      {showShopDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Bookshop Selection</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enter a Bookshop ID to view analytics for that shop, or leave empty for admin preview.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bookshop ID (optional)</label>
              <input
                type="text"
                value={bookshopId}
                onChange={(e) => setBookshopId(e.target.value)}
                placeholder="Leave empty for admin preview"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowShopDialog(false); navigate(-1); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleShopConfirm} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
                View PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrintDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleCancelPrint}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Confirm Print</h3>
            <p className="text-sm text-gray-500 mb-4">
              This action will be recorded. Watermarks will appear on every page.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of copies</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(1000, Number(e.target.value))))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCancelPrint} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmPrint} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
                Confirm & Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
