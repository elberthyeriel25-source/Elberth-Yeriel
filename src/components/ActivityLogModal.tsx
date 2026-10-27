import React from 'react';
import { ActivityLogItem } from '../types';
import { History, X, Clock, User, CheckCircle2, Trash2 } from 'lucide-react';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLogItem[];
  onClearLogs: () => void;
}

export const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base">Riwayat Perubahan & Sinkronisasi</h3>
              <p className="text-xs text-slate-400">
                Log aktivitas real-time lintas tab & kolaborator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100 text-xs">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <History className="w-8 h-8 mx-auto text-slate-300 mb-1" />
              <p className="font-semibold text-xs">Belum ada riwayat aktivitas</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="pt-2.5 first:pt-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">{log.action}</span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{log.timestamp}</span>
                  </div>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">{log.details}</p>
                <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                  <User className="w-3 h-3" />
                  <span>Oleh: {log.user}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">{logs.length} riwayat tercatat</span>
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button
                type="button"
                onClick={onClearLogs}
                className="px-3 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                Bersihkan Riwayat
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-lg"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
