import React, { useState } from 'react';
import { KeyRound, ShieldCheck, X, Check, AlertCircle } from 'lucide-react';
import { getStoredAdminPin, setStoredAdminPin } from '../services/authService';

interface AdminPinSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPinSettingsModal: React.FC<AdminPinSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const activePin = getStoredAdminPin();
    if (currentPin.trim() !== activePin) {
      setMessage({ type: 'error', text: 'PIN Lama tidak sesuai.' });
      return;
    }

    if (newPin.trim().length < 3) {
      setMessage({ type: 'error', text: 'PIN Baru minimal 3 karakter (huruf/angka).' });
      return;
    }

    if (newPin.trim() !== confirmPin.trim()) {
      setMessage({ type: 'error', text: 'Konfirmasi PIN Baru tidak sama.' });
      return;
    }

    const saved = setStoredAdminPin(newPin.trim());
    if (saved) {
      setMessage({ type: 'success', text: 'PIN Pengurus berhasil diperbarui!' });
      setTimeout(() => {
        onClose();
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setMessage(null);
      }, 1200);
    } else {
      setMessage({ type: 'error', text: 'Gagal menyimpan PIN baru.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-sm">Ganti PIN Pengurus</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {message && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {message.type === 'success' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">PIN Lama</label>
            <input
              type="text"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              placeholder="Masukkan PIN saat ini"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              PIN Baru <span className="font-normal text-slate-400">(huruf & angka, min 3 karakter)</span>
            </label>
            <input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Ketik PIN baru (contoh: koor24 atau 5678)"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Ulangi PIN Baru</label>
            <input
              type="text"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Ketik ulang PIN baru persis"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan PIN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
