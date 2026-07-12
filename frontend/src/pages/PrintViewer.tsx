import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { printApi } from '../api/print';

export default function PrintViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    printApi.viewWatermarked(id)
      .then((response) => {
        const blob = response.data as Blob;
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load PDF');
      })
      .finally(() => setLoading(false));

    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [id]);

  const handlePrint = async () => {
    if (!id) return;
    setPrinting(true);
    setPrintMsg('');
    try {
      const { data } = await printApi.countPrint(id, { copies });
      setPrintMsg(`Session logged: ${data.session.copies} copy/copies (Session: ${data.session.session_token?.substring(0, 8)}...)`);
    } catch (err: unknown) {
      setPrintMsg((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Print recording failed');
    } finally {
      setPrinting(false);
    }
  };

  const handleBrowserPrint = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.print();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">&larr; Back</button>
          <h1 className="text-lg font-bold text-gray-900 mt-1">PDF Viewer</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Copies:</label>
            <input type="number" min={1} max={1000} value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <button onClick={handleBrowserPrint} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Print</button>
          <button onClick={handlePrint} disabled={printing} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
            {printing ? 'Logging...' : 'Log Print'}
          </button>
        </div>
      </div>

      {printMsg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${printMsg.includes('failed') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
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
              <p className="text-red-600 font-medium mb-1">Error</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </div>
        )}
        {pdfUrl && (
          <iframe ref={iframeRef} src={pdfUrl} className="w-full h-full" title="PDF Viewer" />
        )}
      </div>
    </div>
  );
}
