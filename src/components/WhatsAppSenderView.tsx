import React, { useState } from 'react';
import { Member, VoiceType } from '../types';
import {
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Send,
  Users,
  Calendar,
  Clock,
  MapPin,
  Music,
  CheckSquare,
  Square,
} from 'lucide-react';

interface WhatsAppSenderViewProps {
  members: Member[];
  preselectedPhones?: { name: string; phone: string }[];
}

export const WhatsAppSenderView: React.FC<WhatsAppSenderViewProps> = ({
  members,
  preselectedPhones,
}) => {
  const [templateType, setTemplateType] = useState<
    'reminder' | 'song_prep' | 'gladi' | 'followup'
  >('reminder');

  const [dateText, setDateText] = useState('Minggu, 1 November 2026');
  const [timeText, setTimeText] = useState('16.00 - 18.00 WIB');
  const [locationText, setLocationText] = useState('Ruang Latihan Koor / Gereja');
  const [songsText, setSongsText] = useState('Hallelujah Chorus, Ave Verum Corpus, Panis Angelicus');
  const [dressCodeText, setDressCodeText] = useState('Batik / Bebas Rapi');
  const [customNote, setCustomNote] = useState('Mohon hadir tepat waktu untuk pemanasan vokal bersama dirigen.');

  const [selectedVoice, setSelectedVoice] = useState<'Semua' | VoiceType>('Semua');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set(members.map((m) => m.id))
  );

  const [copied, setCopied] = useState(false);

  // Generate Message Text
  const generateMessage = (memberName = '[Nama Anggota]') => {
    if (templateType === 'reminder') {
      return `🎶 *PENGINGAT LATIHAN PADUAN SUARA* 🎶
Halo *${memberName}*, salam damai dan sukacita!

Mengingatkan kembali jadwal latihan rutin kita:
📅 *Hari/Tanggal:* ${dateText}
⏰ *Waktu:* ${timeText}
📍 *Tempat:* ${locationText}
🎼 *Partitur/Lagu:* ${songsText}
👔 *Dress Code:* ${dressCodeText}

📌 *Catatan:* ${customNote}

Kehadiran dan suara Anda sangat berharga untuk kesatuan harmoni paduan suara kita.
Jika berhalangan atau izin, mohon konfirmasi ke koordinator ya. Terima kasih! 🙏✨`;
    }

    if (templateType === 'song_prep') {
      return `🎼 *INFORMASI PARTITUR & MATERI KOOR* 🎼
Halo *${memberName}*!

Berikut materi lagu latihan koor yang akan kita pelajari:
🎼 *Lagu:* ${songsText}
📅 *Sesi Latihan:* ${dateText} (${timeText})
📍 *Tempat:* ${locationText}

Harap mempelajari partitur masing-masing seksi suara (Sopran/Alto/Tenor/Bass) sebelum latihan dimulai.
Terima kasih dan tetap semangat bernyanyi! 🎵`;
    }

    if (templateType === 'gladi') {
      return `🎺 *PEMBERITAHUAN GLADI BERSIH / TUGAS KOOR* 🎺
Halo *${memberName}*!

Dimohon kehadirannya dalam Gladi Bersih:
📅 *Hari/Tanggal:* ${dateText}
⏰ *Waktu:* ${timeText}
📍 *Lokasi:* ${locationText}
👔 *Seragam:* ${dressCodeText}
🎼 *Urutan Lagu:* ${songsText}

Penting: Dimohon hadir 20 menit sebelum gladi untuk penataan posisi berdiri dan mik.
Tuhan memberkati pelayanan kita! 🙏`;
    }

    return `👋 *SAPAAN & FOLLOW-UP ANGGOTA KOOR* 👋
Halo *${memberName}*, semoga kabarnya selalu sehat dan diberkati!

Pengurus dan rekan-rekan paduan suara merindukan kehadiranmu di latihan rutin.
Jadwal berikutnya:
📅 *Tanggal:* ${dateText} (${timeText})
📍 *Tempat:* ${locationText}

Jika ada kendala transportasi, jadwal atau urusan keluarga, jangan sungkan berbagi dengan tim koordinator ya. Sampai jumpa! 🎶❤️`;
  };

  const previewMessage = generateMessage('Budi Santoso');

  const handleCopy = () => {
    navigator.clipboard.writeText(previewMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Filtered members for direct send
  const targetMembers = members.filter((m) => {
    const matchesVoice = selectedVoice === 'Semua' || m.voice === selectedVoice;
    return matchesVoice && m.phone;
  });

  const toggleSelectAll = () => {
    if (selectedMemberIds.size === targetMembers.length) {
      setSelectedMemberIds(new Set());
    } else {
      setSelectedMemberIds(new Set(targetMembers.map((m) => m.id)));
    }
  };

  const toggleSelectMember = (id: string) => {
    const next = new Set(selectedMemberIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMemberIds(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Template Settings & Customizer */}
      <div className="lg:col-span-5 space-y-4">
        {/* Template Selector */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>Pilih Jenis Template Pesan</span>
          </h4>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'reminder', label: 'Pengingat Latihan' },
              { id: 'song_prep', label: 'Materi Partitur' },
              { id: 'gladi', label: 'Gladi Bersih' },
              { id: 'followup', label: 'Follow-up Absen' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateType(t.id as any)}
                className={`py-2 px-3 text-xs font-bold rounded-xl border text-left transition ${
                  templateType === t.id
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/30'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Variables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
          <h4 className="font-bold text-slate-900 text-sm">Informasi Jadwal & Agenda</h4>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Hari / Tanggal Latihan
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dateText}
                  onChange={(e) => setDateText(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Waktu Latihan</label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={timeText}
                  onChange={(e) => setTimeText(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Lokasi Latihan</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Daftar Lagu / Partitur</label>
              <div className="relative">
                <Music className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={songsText}
                  onChange={(e) => setSongsText(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preview & Direct Send */}
      <div className="lg:col-span-7 space-y-4">
        {/* Message Preview Box */}
        <div className="bg-emerald-950 text-emerald-100 p-5 rounded-2xl shadow-md border border-emerald-900/60 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Pratinjau Format WhatsApp
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Pesan'}</span>
            </button>
          </div>

          <div className="p-4 bg-emerald-900/50 rounded-xl border border-emerald-800/50 text-xs font-sans whitespace-pre-wrap leading-relaxed text-emerald-50 max-h-56 overflow-y-auto">
            {previewMessage}
          </div>
          <p className="text-[11px] text-emerald-400/80">
            💡 Tanda bintang (*) otomatis tebal (bold) di aplikasi WhatsApp.
          </p>
        </div>

        {/* Member Recipient List */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                Kirim Pesan Langsung ke Anggota ({targetMembers.length})
              </h4>
              <p className="text-xs text-slate-500">
                Klik tombol WA untuk membuka chat personal dengan pesan otomatis
              </p>
            </div>

            {/* Voice filter */}
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value as any)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white font-semibold"
            >
              <option value="Semua">Semua Suara ({members.length})</option>
              <option value="Sopran">Hanya Sopran</option>
              <option value="Alto">Hanya Alto</option>
              <option value="Tenor">Hanya Tenor</option>
              <option value="Bass">Hanya Bass</option>
            </select>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {targetMembers.map((member) => {
              const personalMsg = generateMessage(member.name);
              const cleanPhone = member.phone.startsWith('0')
                ? '62' + member.phone.slice(1)
                : member.phone.replace(/[^0-9]/g, '');

              const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(personalMsg)}`;

              return (
                <div
                  key={member.id}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center font-mono">
                      {member.voice.substring(0, 1)}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">
                        {member.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {member.phone} • {member.voice}
                      </span>
                    </div>
                  </div>

                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Send className="w-3 h-3" />
                    <span>Kirim WA</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
