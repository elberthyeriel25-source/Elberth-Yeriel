import React, { useState, useEffect } from 'react';
import { Member, VoiceType } from '../types';
import { X, UserPlus, Save, Check } from 'lucide-react';

interface MemberEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: Member) => void;
  initialData?: Member | null;
  existingIds: string[];
}

export const MemberEditModal: React.FC<MemberEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingIds,
}) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [voice, setVoice] = useState<VoiceType>('Sopran');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setId(initialData.id);
      setName(initialData.name);
      setVoice(initialData.voice);
      setPhone(initialData.phone);
      setEmail(initialData.email || '');
      setNotes(initialData.notes || '');
      setActive(initialData.active);
      setDeviceId(initialData.deviceId);
      setError('');
    } else {
      // Suggest next auto-increment ID like A004, A005
      const numbers = existingIds
        .map((idStr) => {
          const num = parseInt(idStr.replace(/[^0-9]/g, ''), 10);
          return isNaN(num) ? 0 : num;
        })
        .filter((n) => n > 0);
      const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      const suggestedId = `A${String(nextNum).padStart(3, '0')}`;

      setId(suggestedId);
      setName('');
      setVoice('Sopran');
      setPhone('');
      setNotes('');
      setActive(true);
      setError('');
    }
  }, [initialData, isOpen, existingIds]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama Lengkap tidak boleh kosong');
      return;
    }

    const memberId = id.trim() || initialData?.id || `A${Date.now().toString(36).substring(2, 6).toUpperCase()}`;

    // Format phone
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith('62')) {
      formattedPhone = '0' + formattedPhone.substring(2);
    } else if (formattedPhone && !formattedPhone.startsWith('0') && !formattedPhone.startsWith('+')) {
      formattedPhone = '0' + formattedPhone;
    }

    onSave({
      id: memberId,
      name: name.trim(),
      voice,
      phone: formattedPhone,
      email: email.trim().toLowerCase() || undefined,
      verifiedEmail: initialData?.verifiedEmail || (email.trim() ? email.trim().toLowerCase() : undefined),
      deviceId,
      verifiedAt: initialData?.verifiedAt,
      notes: notes.trim(),
      active,
      joinDate: initialData?.joinDate || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    });

    onClose();
  };

  const voiceColors: Record<VoiceType, string> = {
    Sopran: 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100',
    Alto: 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100',
    Tenor: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
    Bass: 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              {initialData ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-base">
                {initialData ? 'Edit Data Anggota Koor' : 'Tambah Anggota Koor Baru'}
              </h3>
              <p className="text-xs text-slate-400">
                Data akan tersinkronisasi otomatis secara real-time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Lengkap *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth: Budi Santoso"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Seksi Suara (SATB) *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['Sopran', 'Alto', 'Tenor', 'Bass'] as VoiceType[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVoice(v)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition flex flex-col items-center gap-1 ${
                    voice === v
                      ? `${voiceColors[v]} ring-2 ring-blue-500/50 shadow-xs font-extrabold`
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{v}</span>
                  {voice === v && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              No WhatsApp (Format: 0812...)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="081234567890"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Digunakan untuk pengingat latihan via WhatsApp
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alamat Email (Verifikasi Mandiri)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="budi@example.com"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              1 email hanya dapat digunakan untuk 1 anggota (Anti-Titip Absen)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan / Posisi Partitur
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="cth: Solo Bariton, jangkauan nada, dll."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
              />
              <span>Status Anggota Aktif</span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs hover:shadow-md transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Simpan & Sinkronkan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
