interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export default function Pagination({ page, totalPages, total, limit, onPageChange, onLimitChange }: PaginationProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
      <p className="text-sm text-gray-500">{total} total items</p>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Per page:</label>
        <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-sm">
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">Prev</button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const start = Math.max(1, page - 2);
          const p = start + i;
          if (p > totalPages) return null;
          return (
            <button key={p} onClick={() => onPageChange(p)} className={`px-3 py-1 border border-gray-300 rounded text-sm ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-gray-50'}`}>{p}</button>
          );
        })}
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50">Next</button>
      </div>
    </div>
  );
}
