import React, { useState } from 'react';
import { AttendanceSession, Member, VoiceType } from '../types';
import {
  Calendar,
  Clock,
  MapPin,
  Music,
  Users,
  CheckCircle2,
  FileText,
  ChevronRight,
  Sparkles,
  QrCode,
} from 'lucide-react';

interface MemberScheduleViewProps {
  sessions: AttendanceSession[];
  members: Member[];
  onOpenSelfAttendance: (sessionId?: string) => void;
  onOpenSessionQR?: (sessionId: string) => void;
}

export const MemberScheduleView: React.FC<MemberScheduleViewProps> = ({
  sessions,
  members,
  onOpenSelfAttendance,
  onOpenSessionQR,
}) => {
  const [selectedVoice, setSelectedVoice] = useState<'Semua' | VoiceType>('Semua');
  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  const filteredMembers = members.filter(
    (m) => selectedVoice === 'Semua' || m.voice === selectedVoice
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-5 sm:p-6 shadow-md shadow-blue-500/15">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white mb-2">
              PORTAL INFORMASI ANGGOTA KOOR
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Jadwal & Materi Latihan Paduan Suara
            </h2>
            <p className="text-xs text-blue-100 mt-1 max-w-xl">
              Lihat jadwal latihan terkini, ruangan, dan partitur lagu. Jangan lupa untuk mengisi absensi mandiri di setiap sesi latihan.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenSelfAttendance()}
            className="px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 rounded-2xl font-bold text-xs shadow-md shadow-blue-900/20 transition flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Isi Absensi Saya Sekarang</span>
          </button>
        </div>
      </div>

      {/* Rehearsal Sessions List */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>Agenda & Jadwal Sesi Latihan</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedSessions.map((session, index) => {
            const records = Object.values(session.records || {});
            const totalHadir = records.filter((r) => r.status === 'Hadir').length;
            const isLatest = index === 0;

            return (
              <div
                key={session.id}
                className={`p-5 rounded-2xl border transition relative overflow-hidden bg-white shadow-xs ${
                  isLatest
                    ? 'border-blue-300 ring-2 ring-blue-500/10'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {isLatest && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-bl-xl uppercase tracking-wider">
                    Sesi Terbaru
                  </div>
                )}

                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {session.date}
                    </span>
                    <h4 className="font-extrabold text-slate-900 text-base mt-1.5 leading-snug">
                      {session.title}
                    </h4>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{session.location || 'Ruang Latihan Koor'}</span>
                  </div>

                  {session.songList && (
                    <div className="flex items-start gap-2">
                      <Music className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span className="font-medium text-slate-800">
                        Lagu: <span className="text-indigo-700">{session.songList}</span>
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-400 font-medium">
                      Kehadiran: <strong className="text-slate-700">{totalHadir}</strong> hadir
                    </span>

                    <div className="flex items-center gap-1.5">
                      {onOpenSessionQR && (
                        <button
                          type="button"
                          onClick={() => onOpenSessionQR(session.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg font-bold flex items-center gap-1 transition"
                          title="Lihat / Scan Kode QR Sesi Ini"
                        >
                          <QrCode className="w-3 h-3 text-blue-600" />
                          <span>QR Sesi</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenSelfAttendance(session.id)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-2xs"
                      >
                        <span>Absen</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Choir Singers Directory (Read-only for Members) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Daftar Rekan Paduan Suara SATB</span>
            </h3>
            <p className="text-xs text-slate-400">
              Total {members.length} anggota paduan suara terdaftar
            </p>
          </div>

          {/* Section filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['Semua', 'Sopran', 'Alto', 'Tenor', 'Bass'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSelectedVoice(v)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                  selectedVoice === v
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
          {filteredMembers.map((m) => (
            <div
              key={m.id}
              className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-slate-900 text-xs block truncate max-w-[170px]">
                  {m.name}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {m.voice}
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Aktif" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
