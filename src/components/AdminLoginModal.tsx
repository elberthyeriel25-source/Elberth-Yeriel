import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, Eye, EyeOff, X, ShieldAlert, ArrowRight, ShieldCheck } from 'lucide-react';
import { loginAdmin, getStoredAdminPin } from '../services/authService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMessage(null);
      setIsSuccess(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const success = loginAdmin(pin);
    if (success) {
      setIsSuccess(true);
      setTimeout(() => {
        onLoginSuccess();
        onClose();
      }, 600);
    } else {
      setErrorMessage('PIN salah! Silakan periksa kembali PIN Anda.');
      setPin('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-linear-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Lock className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm leading-tight">
                Mode Developer & Pengurus
              </h3>
              <p className="text-[10px] text-blue-200/80">
                Akses khusus kontrol data & manajemen koor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Halaman ini dikunci agar anggota biasa tidak dapat mengubah lembar kerja, menghapus data latihan, atau mengubah sinkronisasi database.
          </p>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">PIN Benar! Membuka panel kontrol...</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Masukkan PIN Pengurus:</span>
              <span className="text-[10px] text-blue-600 font-normal">
                (PIN Bawaan: <strong>1234</strong>)
              </span>
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type={showPin ? 'text' : 'password'}
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                maxLength={32}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Ketik PIN (huruf / angka)..."
                className="w-full pl-10 pr-10 py-2.5 text-center font-mono text-base tracking-widest bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              * Mendukung kombinasi huruf dan angka (bebas kapitalisasi)
            </p>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSuccess}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5"
            >
              <span>Buka Akses</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[10px] text-center text-slate-400 pt-1">
            💡 Anda dapat mengganti PIN ini kapan saja di menu Pengaturan Pengurus.
          </p>
        </form>
      </div>
    </div>
  );
};
