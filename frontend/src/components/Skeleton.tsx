interface SkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export default function Skeleton({ rows = 5, cols = 5, className = '' }: SkeletonProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse w-16" /></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
