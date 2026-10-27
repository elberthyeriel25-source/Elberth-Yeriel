import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Member, AttendanceSession, AttendanceStatus, VoiceType } from '../types';
import {
  validateIndonesianPhone,
  validateMemberName,
  validateEmail,
  submitSelfAttendanceAPI,
  getSavedMemberProfile,
  saveMemberProfileLocally,
  clearMemberProfileLocally,
  SavedMemberProfile,
  getDeviceFingerprintId,
} from '../services/syncService';
import { loginAdmin } from '../services/authService';
import confetti from 'canvas-confetti';
import {
  Music,
  CheckCircle2,
  Calendar,
  MapPin,
  Clock,
  Phone,
  User,
  AlertCircle,
  Sparkles,
  Send,
  Lock,
  CalendarDays,
  QrCode,
  ShieldCheck,
  ShieldAlert,
  Mail,
  KeyRound,
  X,
  RefreshCw,
  Info,
  Check,
} from 'lucide-react';

interface MemberAttendancePortalProps {
  members: Member[];
  sessions: AttendanceSession[];
  initialSessionId?: string;
  isAdmin?: boolean;
  onAttendanceSubmitted?: (result: {
    member: Member;
    session: any;
    isNewMember: boolean;
    status: AttendanceStatus;
  }) => void;
  onSwitchToAdmin: () => void;
  onOpenSchedule?: () => void;
}

export const MemberAttendancePortal: React.FC<MemberAttendancePortalProps> = ({
  members,
  sessions,
  initialSessionId,
  isAdmin = false,
  onAttendanceSubmitted,
  onSwitchToAdmin,
  onOpenSchedule,
}) => {
  // Select active session: default to provided session or latest date session
  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const defaultSession =
    sortedSessions.find((s) => s.id === initialSessionId) || sortedSessions[0];

  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    defaultSession?.id || ''
  );

  useEffect(() => {
    if (initialSessionId) {
      setSelectedSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  const activeSession =
    sessions.find((s) => s.id === selectedSessionId) || defaultSession;

  // Returning member profile state from device storage
  const [savedProfile, setSavedProfile] = useState<SavedMemberProfile | null>(() =>
    getSavedMemberProfile()
  );

  // Form states: initialized from saved profile if exists
  const [name, setName] = useState<string>(() => savedProfile?.name || '');
  const [phone, setPhone] = useState<string>(() => savedProfile?.phone || '');
  const [email, setEmail] = useState<string>(() => savedProfile?.email || '');
  const [voice, setVoice] = useState<VoiceType>(() => savedProfile?.voice || 'Sopran');
  const [status, setStatus] = useState<AttendanceStatus>('Hadir');
  const [note, setNote] = useState('');

  // Recognition state
  const [matchedMember, setMatchedMember] = useState<Member | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [securityViolationMessage, setSecurityViolationMessage] = useState<string | null>(null);

  // Success ticket state
  const [submittedData, setSubmittedData] = useState<{
    member: Member;
    session: { id: string; date: string; title: string; location: string };
    status: AttendanceStatus;
    note?: string;
    submittedAt: string;
    isNewMember: boolean;
  } | null>(null);

  // Personal Member Pass / QR Card modal state
  const [showMemberQrPass, setShowMemberQrPass] = useState(false);
  const [memberQrDataUrl, setMemberQrDataUrl] = useState<string>('');

  // Admin Unlock Dialog for legitimate reset (e.g. choir director fixing mistaken device)
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Auto-lookup member when phone or email changes (only if no bound profile yet)
  useEffect(() => {
    if (savedProfile) {
      // Identity is strictly bound to savedProfile
      setName(savedProfile.name);
      setPhone(savedProfile.phone);
      setEmail(savedProfile.email);
      setVoice(savedProfile.voice);
      return;
    }

    const phoneVal = phone.replace(/[^0-9]/g, '');
    const cleanEmail = email.trim().toLowerCase();

    const found = members.find((m) => {
      if (cleanEmail && m.email && m.email.trim().toLowerCase() === cleanEmail) {
        return true;
      }
      if (phoneVal.length >= 9) {
        let normalized = phoneVal;
        if (normalized.startsWith('62')) normalized = '0' + normalized.substring(2);
        else if (!normalized.startsWith('0')) normalized = '0' + normalized;
        const cleanMPhone = m.phone.replace(/[^0-9]/g, '');
        return cleanMPhone === normalized || (cleanMPhone.endsWith(normalized.slice(1)) && cleanMPhone.length >= 9);
      }
      return false;
    });

    if (found) {
      setMatchedMember(found);
      if (!name || name === matchedMember?.name) {
        setName(found.name);
      }
      if (found.voice) {
        setVoice(found.voice);
      }
      if (found.email && !email) {
        setEmail(found.email);
      }
    } else {
      setMatchedMember(null);
    }
  }, [phone, email, members, savedProfile]);

  // Generate Member QR Digital Card whenever name/phone is available
  useEffect(() => {
    if (!name || !phone) return;
    const memberCardData = JSON.stringify({
      app: 'Absensi_Koor_SATB',
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      voice,
      verified: true,
      deviceId: getDeviceFingerprintId(),
      updated: new Date().toISOString().split('T')[0],
    });

    QRCode.toDataURL(memberCardData, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setMemberQrDataUrl(url))
      .catch((e) => console.error(e));
  }, [name, phone, email, voice]);

  // Trigger celebration confetti
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6'],
      });
    } catch {
      // Ignore if confetti is not loaded
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSecurityViolationMessage(null);

    // 1. Validate name
    const nameCheck = validateMemberName(name);
    if (!nameCheck.isValid) {
      setErrorMessage(nameCheck.message);
      return;
    }

    // 2. Validate phone
    const phoneCheck = validateIndonesianPhone(phone);
    if (!phoneCheck.isValid) {
      setErrorMessage(phoneCheck.message);
      return;
    }

    // 3. Validate email
    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      setErrorMessage(emailCheck.message);
      return;
    }

    // 4. Client-side Anti-Proxy verification against bound identity
    if (savedProfile) {
      if (
        savedProfile.name.toLowerCase().trim() !== nameCheck.formatted.toLowerCase().trim() ||
        savedProfile.phone !== phoneCheck.formatted ||
        savedProfile.email.toLowerCase() !== emailCheck.formatted.toLowerCase()
      ) {
        setSecurityViolationMessage(
          `Akses Ditolak: Perangkat Anda telah terikat resmi pada ${savedProfile.name}. Anda tidak diizinkan mengubah nama/email untuk mengisi absensi orang lain (titip absen).`
        );
        return;
      }
    }

    if (!activeSession) {
      setErrorMessage('Tidak ada jadwal sesi latihan yang aktif saat ini.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitSelfAttendanceAPI({
        name: nameCheck.formatted,
        phone: phoneCheck.formatted,
        email: emailCheck.formatted,
        voice,
        status,
        sessionId: activeSession.id,
        note: note.trim() || undefined,
        deviceId: getDeviceFingerprintId(),
      });

      // Save and lock member profile locally on device so identity cannot be forged
      const newProfile: SavedMemberProfile = {
        memberId: result.member.id,
        name: result.member.name,
        phone: result.member.phone,
        email: result.member.email || emailCheck.formatted,
        voice: result.member.voice,
        deviceId: getDeviceFingerprintId(),
        isVerified: true,
        verifiedAt: result.member.verifiedAt || new Date().toISOString(),
        lastSessionId: activeSession.id,
        lastStatus: status,
        savedAt: new Date().toISOString(),
      };

      saveMemberProfileLocally(newProfile);
      setSavedProfile(newProfile);

      triggerConfetti();

      setSubmittedData({
        member: result.member,
        session: result.session,
        status: result.record?.status || status,
        note: note.trim() || undefined,
        submittedAt: result.submittedAt || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        isNewMember: result.isNewMember,
      });

      if (onAttendanceSubmitted) {
        onAttendanceSubmitted({
          member: result.member,
          session: result.session,
          isNewMember: result.isNewMember,
          status,
        });
      }
    } catch (err: any) {
      const msg = err.message || 'Terjadi kendala saat menyimpan absensi.';
      if (msg.includes('Akses Ditolak') || msg.includes('dilarang') || msg.includes('terverifikasi') || msg.includes('terikat')) {
        setSecurityViolationMessage(msg);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin PIN Unlock Handler for legitimate device re-binding
  const handleAdminUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    const isAuthorized = loginAdmin(adminPinInput);
    if (isAuthorized) {
      clearMemberProfileLocally();
      setSavedProfile(null);
      setName('');
      setPhone('');
      setEmail('');
      setMatchedMember(null);
      setIsUnlockModalOpen(false);
      setAdminPinInput('');
      setSecurityViolationMessage(null);
      setSubmittedData(null);
    } else {
      setUnlockError('PIN Pengurus salah! Hanya pengurus/developer yang berhak me-reset perangkat.');
    }
  };

  const getVoiceColor = (v: VoiceType) => {
    switch (v) {
      case 'Sopran':
        return 'border-rose-300 bg-rose-50 text-rose-700';
      case 'Alto':
        return 'border-purple-300 bg-purple-50 text-purple-700';
      case 'Tenor':
        return 'border-amber-300 bg-amber-50 text-amber-800';
      case 'Bass':
        return 'border-sky-300 bg-sky-50 text-sky-700';
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50 via-slate-50 to-indigo-50 flex flex-col justify-between p-3 sm:p-6">
      <div className="max-w-md w-full mx-auto">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-base leading-tight">
                Absensi Latihan Koor
              </h1>
              <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Portal Mandiri Pribadi (SATB)
              </span>
            </div>
          </div>

          {/* Top Actions: Schedule link and Mode Switch */}
          <div className="flex items-center gap-1.5">
            {onOpenSchedule && (
              <button
                type="button"
                onClick={onOpenSchedule}
                className="text-[11px] font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1"
                title="Lihat jadwal & materi lagu latihan"
              >
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Jadwal</span>
              </button>
            )}

            {savedProfile && (
              <button
                type="button"
                onClick={() => setShowMemberQrPass(true)}
                className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1"
                title="Lihat Kartu QR Kehadiran Anggota Saya"
              >
                <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">QR Saya</span>
              </button>
            )}

            {isAdmin ? (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="text-[11px] font-extrabold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1.5 rounded-xl shadow-2xs transition flex items-center gap-1.5"
                title="Kembali ke Dashboard Pengurus"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Dashboard</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-xl shadow-2xs transition flex items-center gap-1.5"
                title="Khusus Pengurus / Developer (Memerlukan PIN)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Pengurus</span>
              </button>
            )}
          </div>
        </header>

        {/* SECURITY VIOLATION BANNER (ANTI-PROXY ATTENDANCE ENFORCEMENT) */}
        {securityViolationMessage && (
          <div className="mb-4 p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-900 shadow-md animate-shake space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-rose-200/80 rounded-xl text-rose-700 shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-700" />
              </div>
              <div className="flex-1 text-xs">
                <h4 className="font-extrabold text-rose-900 text-sm">
                  ⛔ Dilarang Mengisi Absensi untuk Anggota Lain
                </h4>
                <p className="mt-1 leading-relaxed text-rose-800">
                  {securityViolationMessage}
                </p>
                <p className="mt-2 text-[11px] text-rose-700 font-semibold bg-rose-100/70 p-2 rounded-xl">
                  Kebijakan Paduan Suara: Setiap anggota wajib mengisi absensi dari HP mereka masing-masing demi kejujuran dan ketertiban bersama.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SUCCESS DIGITAL ATTENDANCE SLIP / TICKET */}
        {submittedData ? (
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-emerald-100 text-center animate-fade-in relative overflow-hidden">
            {/* Header pattern banner */}
            <div className="absolute top-0 left-0 right-0 h-2.5 bg-linear-to-r from-emerald-400 via-teal-500 to-blue-500" />

            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Absensi Berhasil Dicatat!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Data kehadiran pribadi Anda sudah tersinkronisasi otomatis ke lembar kerja koor.
            </p>

            {submittedData.isNewMember && (
              <div className="mt-3 py-1.5 px-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-semibold flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Anggota Baru & Email Resmi Terdaftar ke Database Koor</span>
              </div>
            )}

            {/* Slip Details Card */}
            <div className="bg-slate-50 rounded-2xl p-4 my-5 text-left border border-slate-200/90 text-xs space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-400 font-medium">Nama Anggota</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {submittedData.member.name}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-400 font-medium">Email Terverifikasi</span>
                <span className="font-mono text-slate-700 font-semibold text-[11px] truncate max-w-[200px]">
                  {submittedData.member.email || submittedData.member.verifiedEmail || '-'}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-400 font-medium">Bagian Suara</span>
                <span className={`px-2 py-0.5 rounded-lg font-bold border ${getVoiceColor(submittedData.member.voice)}`}>
                  {submittedData.member.voice}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-400 font-medium">Status Kehadiran</span>
                <span
                  className={`px-2.5 py-0.5 rounded-lg font-bold text-white shadow-2xs ${
                    submittedData.status === 'Hadir'
                      ? 'bg-emerald-600'
                      : submittedData.status === 'Izin'
                      ? 'bg-blue-600'
                      : 'bg-amber-600'
                  }`}
                >
                  {submittedData.status}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-400 font-medium">Agenda Sesi</span>
                <span className="font-semibold text-slate-800 text-right max-w-[200px] truncate">
                  {submittedData.session.title}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Waktu Absen</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {submittedData.session.date} • {submittedData.submittedAt} WIB
                </span>
              </div>

              {submittedData.note && (
                <div className="pt-2 border-t border-slate-200 text-slate-600 italic">
                  Catatan: "{submittedData.note}"
                </div>
              )}
            </div>

            {/* Anti-Proxy Security Guarantee Badge */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-left flex items-start gap-2.5 text-xs text-emerald-900 mb-5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-[11px] text-emerald-950 uppercase tracking-wide">
                  Keamanan Absensi Terverifikasi
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                  Akun & email Anda terkunci resmi untuk <strong>{submittedData.member.name}</strong>. Pengisian absensi untuk orang lain tidak diperbolehkan.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Halo Pengurus Koor, saya sudah mengisi absensi latihan *${submittedData.session.title}* (${submittedData.session.date}) dengan status *${submittedData.status}*.\n\nNama: ${submittedData.member.name}\nEmail: ${submittedData.member.email || '-'}\nSuara: ${submittedData.member.voice}\nTerima kasih! 🎶`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Bukti ke WhatsApp Pengurus</span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowMemberQrPass(true)}
                  className="py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Lihat QR Saya</span>
                </button>

                {onOpenSchedule && (
                  <button
                    type="button"
                    onClick={onOpenSchedule}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Jadwal Latihan</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSubmittedData(null)}
                className="w-full py-2 text-slate-500 hover:text-slate-700 text-xs font-semibold transition"
              >
                Perbarui Status Absensi Saya
              </button>
            </div>
          </div>
        ) : (
          /* ATTENDANCE FORM */
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-200/90 space-y-5">
            {/* Active Session Info Card */}
            {activeSession ? (
              <div className="bg-linear-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-2xl shadow-md shadow-blue-500/20 relative overflow-hidden">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-xs mb-1.5">
                      SESI LATIHAN AKTIF
                    </span>
                    <h2 className="font-extrabold text-base sm:text-lg leading-tight">
                      {activeSession.title}
                    </h2>
                  </div>
                  <div className="bg-white/10 p-2 rounded-xl text-center">
                    <Calendar className="w-4 h-4 mx-auto text-blue-200" />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/20 text-xs space-y-1 text-blue-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                    <span>
                      {new Date(activeSession.date).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {activeSession.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                      <span className="truncate">{activeSession.location}</span>
                    </div>
                  )}
                  {activeSession.songList && (
                    <div className="flex items-center gap-2">
                      <Music className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                      <span className="truncate">Lagu: {activeSession.songList}</span>
                    </div>
                  )}
                </div>

                {/* Session selector toggle if multiple sessions exist */}
                {sessions.length > 1 && (
                  <div className="mt-3 pt-2 border-t border-white/20">
                    <label className="text-[10px] text-blue-200 block mb-1 font-medium">
                      Pilih Tanggal / Sesi Latihan Lain:
                    </label>
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className="w-full bg-white/10 text-white text-xs rounded-xl px-2.5 py-1.5 border border-white/30 focus:outline-hidden focus:bg-slate-900"
                    >
                      {sortedSessions.map((s) => (
                        <option key={s.id} value={s.id} className="text-slate-900">
                          {s.date} - {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800">
                Belum ada jadwal sesi latihan aktif.
              </div>
            )}

            {/* Error Notification */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-start gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* RECOGNIZED VERIFIED MEMBER IDENTITY CARD (LOCKED AGAINST PROXY ATTENDANCE) */}
            {savedProfile ? (
              <div className="bg-linear-to-r from-emerald-50 via-teal-50 to-blue-50 border-2 border-emerald-300 p-4 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                      {savedProfile.voice.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-600 text-white tracking-wider flex items-center gap-1 shadow-2xs">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Identitas Terverifikasi</span>
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Lock className="w-3 h-3 text-emerald-600" />
                          Terkunci
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-snug mt-0.5">
                        {savedProfile.name}
                      </h3>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Suara {savedProfile.voice} • {savedProfile.phone}
                      </p>
                      {savedProfile.email && (
                        <p className="text-[10px] text-emerald-800 font-mono mt-0.5 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{savedProfile.email}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsUnlockModalOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition shrink-0"
                    title="Bantuan Pengurus / Buka Kunci Perangkat (Perlu PIN)"
                  >
                    <KeyRound className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div className="text-[11px] text-emerald-900 bg-white/80 p-2.5 rounded-xl border border-emerald-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Anti-Titip Absen Aktif</span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    Satu email/akun hanya diizinkan untuk 1 anggota. Anda hanya dapat mengisi kehadiran untuk diri Anda sendiri. Pengisian untuk anggota lain dilarang.
                  </p>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* STEP 1: PERSONAL IDENTITY (Shown only if new member or not yet bound) */}
              {!savedProfile && (
                <div className="space-y-3.5 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>Data Diri & Verifikasi Identitas Anggota</span>
                    </span>
                  </div>

                  {/* Anti-Proxy Information notice */}
                  <div className="p-2.5 bg-blue-50/90 rounded-xl border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="leading-snug">
                      Masukkan nama, WhatsApp, dan <strong>email pribadi</strong> Anda. Email ini akan diverifikasi dan terikat secara permanen pada perangkat ini untuk mencegah titip absen.
                    </p>
                  </div>

                  {/* Full Name Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Lengkap Anda <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        placeholder="Contoh: Budi Santoso"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setErrorMessage(null);
                        }}
                        required
                        className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  {/* Phone Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>
                        Nomor WhatsApp / HP <span className="text-rose-500">*</span>
                      </span>
                      {matchedMember && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Terdaftar
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="tel"
                        inputMode="tel"
                        placeholder="Contoh: 081234567890"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setErrorMessage(null);
                        }}
                        required
                        className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  {/* Email Input (Required for Uniqueness & Anti-Proxy Verification) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>
                        Alamat Email Pribadi <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Verifikasi Unik</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="email"
                        inputMode="email"
                        placeholder="nama.anda@gmail.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setErrorMessage(null);
                        }}
                        required
                        className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Email ini tidak dapat digunakan untuk mengisi absensi atas nama anggota lain.
                    </span>
                  </div>

                  {/* Voice Type (SATB) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bagian Suara (SATB) <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['Sopran', 'Alto', 'Tenor', 'Bass'] as const).map((v) => {
                        const isSelected = voice === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setVoice(v)}
                            className={`py-2 px-1 rounded-xl border text-center text-xs font-bold transition ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ATTENDANCE STATUS SELECTION */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>
                    Pilih Status Kehadiran Sesi Ini: <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400">1-Klik Pilih</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: 'Hadir',
                      label: 'Hadir',
                      desc: 'Datang latihan',
                      activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20',
                      inactiveClass: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50',
                    },
                    {
                      id: 'Izin',
                      label: 'Izin',
                      desc: 'Ada urusan/kerja',
                      activeClass: 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20',
                      inactiveClass: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50',
                    },
                    {
                      id: 'Sakit',
                      label: 'Sakit',
                      desc: 'Kurang sehat',
                      activeClass: 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20',
                      inactiveClass: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-amber-50',
                    },
                  ].map((btn) => {
                    const isSelected = status === btn.id;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setStatus(btn.id as AttendanceStatus)}
                        className={`p-3 rounded-2xl border text-center transition ${
                          isSelected ? btn.activeClass : btn.inactiveClass
                        }`}
                      >
                        <div className="font-extrabold text-xs">{btn.label}</div>
                        <div
                          className={`text-[9px] mt-0.5 ${
                            isSelected ? 'text-white/80' : 'text-slate-400'
                          }`}
                        >
                          {btn.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note / Reason Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>
                    Catatan / Alasan {status !== 'Hadir' && <span className="text-rose-500">*</span>}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {status === 'Hadir' ? 'Opsional' : 'Wajib'}
                  </span>
                </label>
                <input
                  type="text"
                  placeholder={
                    status === 'Hadir'
                      ? 'Misal: Tepat waktu, latihan partitur...'
                      : 'Tulis alasan izin / sakit Anda...'
                  }
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required={status !== 'Hadir'}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-white text-xs font-medium focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !activeSession}
                className="w-full py-3.5 px-4 bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-extrabold text-sm shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan & Memverifikasi...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {savedProfile
                        ? `Konfirmasi Kehadiran Saya (${savedProfile.name.split(' ')[0]})`
                        : 'Kirim & Kunci Absensi Pribadi Saya'}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ADMIN UNLOCK & RESET MODAL (FOR PHONE TRANSFERS OR CORRECTIONS) */}
        {isUnlockModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  <span>Otorisasi Pengurus Koor</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsUnlockModalOpen(false);
                    setUnlockError(null);
                    setAdminPinInput('');
                  }}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                <p className="font-semibold">Perlindungan Anti-Titip Absen</p>
                <p className="mt-1 text-[11px] text-amber-800 leading-snug">
                  Untuk menjaga integritas absensi, anggota tidak dapat mengganti identitas sendiri. Masukkan PIN Pengurus untuk me-reset ikatan akun perangkat ini jika terjadi kesalahan pengisian.
                </p>
              </div>

              {unlockError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                  {unlockError}
                </div>
              )}

              <form onSubmit={handleAdminUnlock} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PIN Pengurus / Developer
                  </label>
                  <input
                    type="password"
                    placeholder="Masukkan PIN Pengurus..."
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnlockModalOpen(false);
                      setUnlockError(null);
                      setAdminPinInput('');
                    }}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    Buka Kunci
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PERSONAL QR MEMBER PASS MODAL */}
        {showMemberQrPass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl max-w-xs w-full shadow-2xl border border-slate-200 overflow-hidden text-center p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-extrabold text-slate-900 text-xs">Kartu QR Anggota Pribadi</span>
                <button
                  type="button"
                  onClick={() => setShowMemberQrPass(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                {memberQrDataUrl ? (
                  <img
                    src={memberQrDataUrl}
                    alt="Kartu QR Anggota"
                    className="w-44 h-44 mx-auto object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-slate-400">
                    Membuat QR...
                  </div>
                )}
                <h4 className="font-extrabold text-slate-900 text-sm mt-2">{name}</h4>
                <p className="text-xs text-blue-600 font-bold">Suara {voice}</p>
                <p className="text-[10px] text-slate-400 font-mono">{phone}</p>
                {email && (
                  <p className="text-[10px] text-emerald-600 font-mono truncate">{email}</p>
                )}
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-[10px] text-emerald-800 font-medium">
                🛡️ QR Terverifikasi Resmi • Terikat Khusus untuk {name}
              </div>

              <button
                type="button"
                onClick={() => setShowMemberQrPass(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                Tutup Kartu
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-400 space-y-2">
          <p>
            Paduan Suara SATB • Keamanan Absensi & Verifikasi Identitas Anggota
          </p>
          <div className="flex items-center justify-center gap-3 text-[11px]">
            {isAdmin ? (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
              >
                <span>Buka Lembar Kerja Pengurus (Spreadsheet & Rekap)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="text-slate-400 hover:text-slate-600 transition flex items-center gap-1"
              >
                <Lock className="w-3 h-3" />
                <span>Area Pengurus (Memerlukan PIN)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
