import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { AttendanceSession } from '../types';
import { generateSessionPasscode } from '../services/syncService';
import {
  X,
  Share2,
  Copy,
  Check,
  QrCode,
  Download,
  ExternalLink,
  MessageCircle,
  Calendar,
  Sparkles,
  Smartphone,
  Send,
  Maximize2,
  Minimize2,
  Printer,
  Music,
  MapPin,
  Clock,
  ScanLine,
  ShieldCheck,
  RefreshCw,
  KeyRound,
} from 'lucide-react';

interface ShareAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: AttendanceSession[];
  currentSessionId?: string;
  onOpenMobilePreview: () => void;
  onUpdateSession?: (session: AttendanceSession) => void;
}

export const ShareAttendanceModal: React.FC<ShareAttendanceModalProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onOpenMobilePreview,
  onUpdateSession,
}) => {
  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    currentSessionId || sortedSessions[0]?.id || ''
  );
  const [isProjectorMode, setIsProjectorMode] = useState(false);

  useEffect(() => {
    if (currentSessionId) setSelectedSessionId(currentSessionId);
    else if (sortedSessions[0]) setSelectedSessionId(sortedSessions[0].id);
  }, [currentSessionId, isOpen]);

  const activeSession =
    sessions.find((s) => s.id === selectedSessionId) || sortedSessions[0];

  const passcode = activeSession?.passcode || 'SB26';
  const requirePasscode = activeSession?.requirePasscode ?? true;

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Compute absolute shareable URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  // The QR code for display in room embeds the token so members in the room get verified automatically
  const qrTargetUrl = activeSession
    ? `${baseUrl}/?mode=absen&sesi=${encodeURIComponent(activeSession.id)}${requirePasscode && passcode ? `&token=${encodeURIComponent(passcode)}` : ''}`
    : `${baseUrl}/?mode=absen`;

  // Standard share URL (clean link)
  const shareUrl = activeSession
    ? `${baseUrl}/?mode=absen&sesi=${encodeURIComponent(activeSession.id)}`
    : `${baseUrl}/?mode=absen`;

  const handleRegeneratePasscode = () => {
    if (!activeSession) return;
    const newCode = generateSessionPasscode(activeSession.date);
    const updated: AttendanceSession = {
      ...activeSession,
      passcode: newCode,
      requirePasscode: true,
    };
    onUpdateSession?.(updated);
  };

  const handleToggleRequirePasscode = () => {
    if (!activeSession) return;
    const updated: AttendanceSession = {
      ...activeSession,
      requirePasscode: !requirePasscode,
    };
    onUpdateSession?.(updated);
  };

  // WhatsApp invitation text
  const whatsappInvitationText = activeSession
    ? `📢 *ABSENSI LATIHAN PADUAN SUARA* 🎶\n\nHalo rekan-rekan koor,\nSilakan mengisi absensi kehadiran mandiri untuk sesi latihan:\n\n📅 *Tanggal:* ${activeSession.date}\n🏷️ *Agenda:* ${activeSession.title}\n📍 *Lokasi:* ${activeSession.location || 'Ruang Koor'}\n${activeSession.songList ? `🎼 *Lagu:* ${activeSession.songList}\n` : ''}\n👉 *Isi Absensi di HP Anda:* ${shareUrl}\n${requirePasscode ? `🔐 *Kode Hadir Hari Ini:* *${passcode}* (Atau langsung scan QR di proyektor ruangan)\n` : ''}\n_Catatan: Setiap anggota wajib mengisi melalui HP & email masing-masing. Sistem secara ketat menolak pengisian untuk anggota lain (anti-titip absen). Terima kasih!_ 🙏`
    : `📢 *ABSENSI MANDIRI KOOR*\nSilakan isi absensi latihan pribadi melalui link: ${shareUrl}`;

  // Generate high-resolution QR code using qrTargetUrl (contains token)
  useEffect(() => {
    if (!qrTargetUrl) return;
    QRCode.toDataURL(qrTargetUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed generating QR code:', err));
  }, [qrTargetUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(whatsappInvitationText);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_Absensi_${activeSession?.date || 'Koor'}_${activeSession?.title?.replace(/\s+/g, '_') || 'Latihan'}.png`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  // FULLSCREEN PROJECTOR / DISPLAY MODE (Ideal for choir hall display / proyektor)
  if (isProjectorMode) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-between p-6 sm:p-12 overflow-y-auto animate-fade-in">
        {/* Top Controls in Projector Mode */}
        <div className="w-full max-w-4xl flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white">
              <ScanLine className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-blue-400">
                Mode Tayang Layar / Proyektor Latihan
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Scan QR Absensi Kehadiran Koor
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsProjectorMode(false)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Keluar Mode Layar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-rose-600 text-white rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Presentation Card */}
        <div className="my-auto py-8 flex flex-col items-center text-center max-w-2xl w-full">
          {activeSession && (
            <div className="mb-6 space-y-2">
              <span className="inline-block px-4 py-1 rounded-full bg-blue-500/20 text-blue-300 font-mono text-sm font-bold border border-blue-500/30">
                {activeSession.date}
              </span>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                {activeSession.title}
              </h1>
              {activeSession.location && (
                <p className="text-slate-400 text-sm sm:text-base flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span>{activeSession.location}</span>
                </p>
              )}
              {activeSession.songList && (
                <p className="text-indigo-300 text-sm font-semibold flex items-center justify-center gap-2">
                  <Music className="w-4 h-4 text-indigo-400" />
                  <span>Materi Lagu: {activeSession.songList}</span>
                </p>
              )}
            </div>
          )}

          {/* Large Sharp QR Code */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl border-4 border-blue-500/30 flex flex-col items-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Absensi Sesi Latihan"
                className="w-64 h-64 sm:w-80 sm:h-80 object-contain rounded-xl"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-slate-400 font-bold">
                Membuat Kode QR...
              </div>
            )}
            <div className="mt-4 px-4 py-1.5 rounded-full bg-blue-50 text-blue-800 text-xs font-extrabold flex items-center gap-1.5">
              <ScanLine className="w-4 h-4 text-blue-600" />
              <span>Arahkan Kamera HP ke QR Ini untuk Absen</span>
            </div>

            {requirePasscode && passcode && (
              <div className="mt-4 w-full p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-200/80 flex items-center justify-center text-amber-800 shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700">
                      Kode Ruangan Latihan Hari Ini (Anti-Titip Absen)
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono tracking-widest text-amber-900">
                      {passcode}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 text-left sm:text-right">
                  <span className="font-semibold">Otomatis terisi jika scan QR di atas.</span>
                  <div className="text-[10px] text-slate-500">
                    Anggota di luar ruangan tanpa kode tidak bisa titip absen.
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-slate-300 text-sm max-w-md">
            Anggota yang sudah pernah scan sebelumnya <strong>tidak perlu mengetik ulang data diri</strong>, cukup 1-klik pilih status hadir!
          </p>
        </div>

        {/* Bottom Switcher */}
        <div className="w-full max-w-md flex items-center justify-center gap-3 text-xs text-slate-400">
          <span>Pilih Sesi Lain:</span>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-white/10 text-white rounded-xl px-3 py-1.5 border border-white/20 text-xs font-semibold focus:outline-hidden"
          >
            {sortedSessions.map((s) => (
              <option key={s.id} value={s.id} className="text-slate-900">
                {s.date} - {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/90 flex items-center justify-between bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base leading-tight">
                Kode QR & Link Absensi Sesi Latihan
              </h2>
              <p className="text-[11px] text-blue-100">
                Setiap sesi memiliki QR unik untuk discan anggota lewat kamera HP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-xs text-slate-600">
          {/* Session Selector */}
          <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200/80 space-y-2">
            <label className="block text-xs font-bold text-blue-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Pilih Sesi Latihan:</span>
              </span>
              <span className="text-[10px] text-blue-600 font-mono font-normal">
                {sortedSessions.length} Sesi Terjadwal
              </span>
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              {sortedSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date} — {s.title} ({s.location || 'Ruang Koor'})
                </option>
              ))}
            </select>

            {activeSession && (
              <div className="text-[11px] text-slate-600 pt-1 border-t border-blue-200/60 flex flex-wrap gap-x-4 gap-y-1">
                <span>📍 <strong>Lokasi:</strong> {activeSession.location || 'Ruang Latihan Koor'}</span>
                {activeSession.songList && (
                  <span>🎼 <strong>Lagu:</strong> {activeSession.songList}</span>
                )}
              </div>
            )}
          </div>

          {/* QR Code Presentation Box */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0 text-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Absensi ${activeSession?.title || 'Sesi'}`}
                  className="w-40 h-40 sm:w-44 sm:h-44 object-contain mx-auto rounded-lg"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-slate-400">
                  Membuat QR...
                </div>
              )}
              <span className="text-[10px] text-slate-500 block mt-1.5 font-bold font-mono">
                Scan via Kamera HP
              </span>
            </div>

            <div className="space-y-3 text-center sm:text-left flex-1">
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] mb-1">
                  QR UNIK AKTIF
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  {activeSession?.title || 'Sesi Latihan Koor'}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Anggota cukup arahkan kamera HP ke QR ini. Setelah pernah absen sekali, profil mereka otomatis diingat sehingga saat scan lagi tinggal pilih status hadir!
                </p>
              </div>

              {/* QR Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => setIsProjectorMode(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                  title="Tayangkan QR ukuran penuh di layar TV atau proyektor ruangan koor"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Mode Layar Proyektor</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-2xs"
                  title="Unduh gambar PNG untuk dicetak atau dibagikan"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Unduh QR</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-xs transition flex items-center gap-1"
                  title="Cetak lembar QR absensi"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cetak</span>
                </button>
              </div>
            </div>
          </div>

          {/* Direct Link Box */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-xs">Link Akses Langsung Sesi Ini:</span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Link Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 select-all overflow-x-auto">
              <span className="truncate">{shareUrl}</span>
            </div>
          </div>

          {/* Dynamic Daily Passcode Control (Anti-Titip Absen) */}
          <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                <div className="w-7 h-7 rounded-lg bg-amber-200 flex items-center justify-center text-amber-900">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <span>Kode Validasi Kehadiran Sesi</span>
                  <span className="block text-[10px] text-amber-700 font-normal">
                    Mekanisme Anti-Titip Absen dari luar ruangan latihan
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegeneratePasscode}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs"
                  title="Buat kode acak baru untuk sesi ini"
                >
                  <RefreshCw className="w-3 h-3 text-amber-600" />
                  <span>Acak Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(passcode);
                    setCopiedPasscode(true);
                    setTimeout(() => setCopiedPasscode(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs"
                >
                  {copiedPasscode ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-amber-200">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-amber-100/90 text-amber-950 font-mono text-xl font-black rounded-lg tracking-widest border border-amber-300">
                  {passcode}
                </div>
                <div className="text-[11px] text-slate-600">
                  <div className="font-semibold text-slate-800">
                    {requirePasscode ? 'Wajib Dimasukkan Anggota' : 'Opsional (Tidak Diwajibkan)'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Kode ini otomatis tersemat dalam QR proyektor
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={requirePasscode}
                  onChange={handleToggleRequirePasscode}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>Wajibkan Kode</span>
              </label>
            </div>

            <div className="text-[10px] text-amber-800 leading-relaxed bg-amber-100/60 p-2.5 rounded-lg border border-amber-200/50 flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Keamanan Anti-Titip Absen:</strong> Anggota yang hadir langsung di ruangan dan memindai QR proyektor akan otomatis lolos verifikasi tanpa mengetik kode. Anggota yang mencoba absen dari rumah harus tahu kode 4 digit ini dari pengurus di ruangan latihan.
              </span>
            </div>
          </div>

          {/* WhatsApp Broadcast Invitation Text */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Format Pesan Grup WhatsApp Koor:</span>
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                {copiedMessage ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pesan Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Pesan WA</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-2xl p-3 text-[11px] text-slate-700 whitespace-pre-line font-sans leading-relaxed max-h-36 overflow-y-auto">
              {whatsappInvitationText}
            </div>

            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                whatsappInvitationText
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Kirim Langsung ke Grup WhatsApp Paduan Suara</span>
            </a>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenMobilePreview();
            }}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs transition flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Pratinjau Layar HP Anggota</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
