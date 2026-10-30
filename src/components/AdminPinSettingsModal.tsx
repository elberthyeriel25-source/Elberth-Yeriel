import React, { useState } from 'react';
import { KeyRound, ShieldCheck, X, Check, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
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
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const activePin = getStoredAdminPin();
    const curTrimmed = currentPin.trim();
    if (curTrimmed !== activePin && curTrimmed.toLowerCase() !== activePin.toLowerCase()) {
      setMessage({ type: 'error', text: 'PIN / Password Lama tidak sesuai.' });
      return;
    }

    const nextPinTrimmed = newPin.trim();
    if (nextPinTrimmed.length < 3) {
      setMessage({ type: 'error', text: 'PIN / Password Baru minimal 3 karakter (huruf/angka).' });
      return;
    }

    if (nextPinTrimmed !== confirmPin.trim()) {
      setMessage({ type: 'error', text: 'Konfirmasi PIN / Password Baru tidak cocok.' });
      return;
    }

    const saved = setStoredAdminPin(nextPinTrimmed);
    if (saved) {
      setMessage({ type: 'success', text: 'PIN / Password Pengurus berhasil diperbarui!' });
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
            <h3 className="font-extrabold text-sm">Ganti PIN / Password Pengurus</h3>
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
          <div className="p-2.5 bg-blue-50/80 border border-blue-200/60 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Bebas gunakan <strong>huruf (a-z)</strong>, <strong>angka (0-9)</strong>, atau kombinasi keduanya (contoh: <em>koor2024</em> atau <em>1234</em>). Password ini otomatis tersinkronisasi ke <strong>seluruh HP & perangkat</strong> via Cloud Database!
            </p>
          </div>

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
            <label className="block font-bold text-slate-700 mb-1">PIN / Password Lama</label>
            <div className="relative">
              <input
                type={showCurrentPin ? 'text' : 'password'}
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Masukkan PIN saat ini"
                required
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPin(!showCurrentPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showCurrentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              PIN / Password Baru <span className="font-normal text-slate-400">(huruf & angka, min 3 karakter)</span>
            </label>
            <div className="relative">
              <input
                type={showNewPin ? 'text' : 'password'}
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Ketik password baru (huruf / angka)"
                required
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNewPin(!showNewPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Ulangi PIN / Password Baru</label>
            <div className="relative">
              <input
                type={showConfirmPin ? 'text' : 'password'}
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Ketik ulang password baru persis"
                required
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
              <span>Simpan Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
