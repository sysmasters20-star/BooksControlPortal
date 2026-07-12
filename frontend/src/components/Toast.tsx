import { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: 'bg-emerald-50 text-emerald-700 border-emerald-200', error: 'bg-red-50 text-red-700 border-red-200', info: 'bg-blue-50 text-blue-700 border-blue-200' };
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border shadow-lg ${colors[type]}`}>
      <div className="flex items-center gap-2">
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 font-bold">&times;</button>
      </div>
    </div>
  );
}
