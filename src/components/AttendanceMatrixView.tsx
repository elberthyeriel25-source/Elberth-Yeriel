import React, { useState } from 'react';
import { Member, AttendanceSession, AttendanceStatus, VoiceType } from '../types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  CheckCheck,
  Share2,
  AlertCircle,
  FileText,
  X,
  Sparkles,
  Music,
  QrCode,
} from 'lucide-react';

interface AttendanceMatrixViewProps {
  members: Member[];
  sessions: AttendanceSession[];
  onUpdateSessionRecord: (
    sessionId: string,
    memberId: string,
    status: AttendanceStatus,
    note?: string
  ) => void;
  onAddSession: (session: AttendanceSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onMarkAllPresent: (sessionId: string) => void;
  onOpenShareModal?: (sessionId?: string) => void;
}

export const AttendanceMatrixView: React.FC<AttendanceMatrixViewProps> = ({
  members,
  sessions,
  onUpdateSessionRecord,
  onAddSession,
  onDeleteSession,
  onMarkAllPresent,
  onOpenShareModal,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<'Semua' | VoiceType>('Semua');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Session form state
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTitle, setNewTitle] = useState('Latihan Rutin Koor');
  const [newLocation, setNewLocation] = useState('Ruang Koor / Gereja');
  const [newSongs, setNewSongs] = useState('');

  // Note editor modal
  const [editingNote, setEditingNote] = useState<{
    sessionId: string;
    memberId: string;
    memberName: string;
    status: AttendanceStatus;
    note: string;
  } | null>(null);

  // Status cycling configuration
  const statusCycle: AttendanceStatus[] = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Belum'];

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'Hadir':
        return {
          short: 'H',
          label: 'Hadir',
          badge: 'bg-emerald-500 text-white font-bold hover:bg-emerald-600 shadow-2xs',
        };
      case 'Izin':
        return {
          short: 'I',
          label: 'Izin',
          badge: 'bg-blue-500 text-white font-bold hover:bg-blue-600 shadow-2xs',
        };
      case 'Sakit':
        return {
          short: 'S',
          label: 'Sakit',
          badge: 'bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-2xs',
        };
      case 'Alpa':
        return {
          short: 'A',
          label: 'Alpa',
          badge: 'bg-rose-500 text-white font-bold hover:bg-rose-600 shadow-2xs',
        };
      default:
        return {
          short: '-',
          label: 'Belum',
          badge: 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200',
        };
    }
  };

  const handleCellClick = (sessionId: string, memberId: string, currentStatus?: AttendanceStatus) => {
    const cur = currentStatus || 'Belum';
    const nextIdx = (statusCycle.indexOf(cur) + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIdx];
    onUpdateSessionRecord(sessionId, memberId, nextStatus);
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;

    const newSession: AttendanceSession = {
      id: `sess-${newDate}-${Date.now().toString(36).substring(2, 6)}`,
      date: newDate,
      title: newTitle.trim() || 'Latihan Rutin',
      location: newLocation.trim() || 'Ruang Latihan Koor',
      songList: newSongs.trim(),
      createdAt: new Date().toISOString(),
      records: {},
    };

    // Initialize all active members as 'Belum'
    members.forEach((m) => {
      newSession.records[m.id] = {
        memberId: m.id,
        status: 'Belum',
      };
    });

    onAddSession(newSession);
    setIsAddModalOpen(false);
    setNewSongs('');
  };

  // WhatsApp Summary Generator for a session
  const copySessionSummaryWhatsApp = (session: AttendanceSession) => {
    let hadir = 0;
    let izin: string[] = [];
    let sakit: string[] = [];
    let alpa: string[] = [];

    members.forEach((m) => {
      const rec = session.records[m.id];
      const status = rec?.status || 'Belum';
      if (status === 'Hadir') hadir++;
      else if (status === 'Izin') izin.push(`${m.name} (${m.voice})`);
      else if (status === 'Sakit') sakit.push(`${m.name} (${m.voice})`);
      else if (status === 'Alpa') alpa.push(`${m.name} (${m.voice})`);
    });

    const total = members.length;
    const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;

    let text = `🎵 *REKAP ABSENSI LATIHAN KOOR*\n`;
    text += `📅 *Tanggal:* ${session.date}\n`;
    text += `🏷️ *Agenda:* ${session.title}\n`;
    if (session.songList) text += `🎼 *Lagu/Partitur:* ${session.songList}\n`;
    text += `📍 *Lokasi:* ${session.location}\n\n`;
    text += `📊 *Kehadiran:* ${hadir}/${total} Anggota (${pct}%)\n`;

    if (izin.length > 0) {
      text += `\n🔵 *Izin (${izin.length}):*\n- ${izin.join('\n- ')}\n`;
    }
    if (sakit.length > 0) {
      text += `\n🟡 *Sakit (${sakit.length}):*\n- ${sakit.join('\n- ')}\n`;
    }
    if (alpa.length > 0) {
      text += `\n🔴 *Tanpa Keterangan (${alpa.length}):*\n- ${alpa.join('\n- ')}\n`;
    }

    text += `\nTerima kasih atas dedikasi dan semangat pelayanan seluruh anggota paduan suara! 🙏🎶`;

    navigator.clipboard.writeText(text);
    setToastMessage('✅ Rekap absensi disalin ke clipboard! Silakan paste langsung ke grup WhatsApp Koor.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter members
  const filteredMembers = members.filter(
    (m) => selectedVoice === 'Semua' || m.voice === selectedVoice
  );

  return (
    <div className="space-y-4 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Voice Section tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['Semua', 'Sopran', 'Alto', 'Tenor', 'Bass'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setSelectedVoice(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedVoice === v
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Legend & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-400">Status:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Hadir (H)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-500" /> Izin (I)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> Sakit (S)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Alpa (A)
            </span>
          </div>

          {/* Share Link & QR Button */}
          {onOpenShareModal && (
            <button
              type="button"
              onClick={() => onOpenShareModal()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              title="Bagikan Link / QR Absensi untuk Anggota Koor Mengisi Lewat HP"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Bagikan Link & QR</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Tanggal Latihan</span>
          </button>
        </div>
      </div>

      {/* Attendance Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-800 font-bold">
              ABSENSI MATRIX
            </span>
            <span>
              {filteredMembers.length} Anggota × {sessions.length} Jadwal Sesi Latihan
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            💡 Klik sel untuk ganti status: H ➔ I ➔ S ➔ A ➔ Belum
          </span>
        </div>

        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-xs shadow-xs">
              <tr className="border-b border-slate-200 text-slate-700 text-[11px] font-semibold">
                {/* Fixed columns */}
                <th className="py-2.5 px-3 border-r border-slate-200 w-12 text-center bg-slate-100 text-slate-400 font-mono">
                  #
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[180px] bg-slate-100">
                  Nama Anggota
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200 w-24 bg-slate-100">
                  Suara
                </th>

                {/* Session Columns */}
                {sessions.map((session) => (
                  <th
                    key={session.id}
                    className="py-2 px-3 border-r border-slate-200 min-w-[130px] max-w-[150px] text-center bg-slate-50/90 hover:bg-slate-100/80 transition"
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-slate-900 text-xs font-mono">
                        {session.date}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[120px] font-medium" title={session.title}>
                        {session.title}
                      </span>

                      {/* Column quick actions */}
                      <div className="flex items-center gap-1 mt-1.5">
                        <button
                          onClick={() => onMarkAllPresent(session.id)}
                          title="Tandai Semua Hadir"
                          className="p-1 rounded-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition text-[10px] flex items-center gap-0.5 font-bold"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Semua</span>
                        </button>
                        {onOpenShareModal && (
                          <button
                            onClick={() => onOpenShareModal(session.id)}
                            title="Tampilkan & Generate Kode QR Unik Sesi Ini"
                            className="px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-800 hover:bg-blue-200 transition flex items-center gap-0.5 font-bold text-[9px]"
                          >
                            <QrCode className="w-3 h-3 text-blue-700" />
                            <span>QR</span>
                          </button>
                        )}
                        <button
                          onClick={() => copySessionSummaryWhatsApp(session)}
                          title="Salin Rekap ke WhatsApp"
                          className="p-1 rounded-sm bg-emerald-500 text-white hover:bg-emerald-600 transition"
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus sesi tanggal ${session.date}?`)) {
                              onDeleteSession(session.id);
                            }
                          }}
                          title="Hapus Sesi"
                          className="p-1 rounded-sm text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </th>
                ))}

                {/* Stats Columns */}
                <th className="py-2.5 px-3 border-r border-slate-200 w-20 text-center bg-slate-100 font-bold">
                  Total
                </th>
                <th className="py-2.5 px-3 w-24 text-center bg-slate-100 font-bold">
                  % Hadir
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((member, idx) => {
                // Calculate member stats
                let hadirCount = 0;
                sessions.forEach((s) => {
                  if (s.records[member.id]?.status === 'Hadir') hadirCount++;
                });
                const pct = sessions.length > 0 ? Math.round((hadirCount / sessions.length) * 100) : 0;

                return (
                  <tr
                    key={member.id}
                    className={`hover:bg-slate-50/80 transition ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                    }`}
                  >
                    <td className="text-center py-2 px-1 text-slate-400 font-mono text-[11px] border-r border-slate-200/80 bg-slate-50/40">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200/80 font-semibold text-slate-900">
                      {member.name}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200/80">
                      <span className="font-bold text-[11px] text-slate-700">
                        {member.voice}
                      </span>
                    </td>

                    {/* Attendance Status Cells */}
                    {sessions.map((session) => {
                      const record = session.records[member.id];
                      const status = record?.status || 'Belum';
                      const badge = getStatusBadge(status);

                      return (
                        <td
                          key={session.id}
                          className="py-1.5 px-2 border-r border-slate-200/80 text-center"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCellClick(session.id, member.id, status)}
                              className={`w-8 h-8 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center ${badge.badge}`}
                              title={`${member.name}: ${badge.label} (Klik untuk ganti)`}
                            >
                              {badge.short}
                            </button>

                            {/* Note button */}
                            <button
                              onClick={() =>
                                setEditingNote({
                                  sessionId: session.id,
                                  memberId: member.id,
                                  memberName: member.name,
                                  status,
                                  note: record?.note || '',
                                })
                              }
                              className={`p-1 rounded-md transition ${
                                record?.note
                                  ? 'text-blue-600 bg-blue-50 font-bold'
                                  : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                              }`}
                              title={record?.note ? `Catatan: ${record.note}` : 'Tambah catatan'}
                            >
                              <FileText className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      );
                    })}

                    {/* Row Summary */}
                    <td className="py-2 px-3 border-r border-slate-200/80 text-center font-bold text-slate-800 text-xs font-mono">
                      {hadirCount}/{sessions.length}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                          pct >= 80
                            ? 'bg-emerald-100 text-emerald-800'
                            : pct >= 50
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Bottom Summary Row */}
            <tfoot className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-xs">
              <tr>
                <td colSpan={4} className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">
                  Total Hadir per Latihan:
                </td>
                {sessions.map((session) => {
                  let hadir = 0;
                  filteredMembers.forEach((m) => {
                    if (session.records[m.id]?.status === 'Hadir') hadir++;
                  });
                  const pct = filteredMembers.length > 0 ? Math.round((hadir / filteredMembers.length) * 100) : 0;

                  return (
                    <td key={session.id} className="py-2 px-2 border-r border-slate-200 text-center">
                      <div className="font-mono text-emerald-700">
                        {hadir}/{filteredMembers.length}
                      </div>
                      <div className="text-[10px] text-slate-500">{pct}%</div>
                    </td>
                  );
                })}
                <td colSpan={2} className="py-2 px-3 text-center text-slate-500 text-[11px]">
                  Rata-rata Kehadiran
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add New Session Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Tambah Jadwal Latihan Koor</h3>
                  <p className="text-xs text-slate-400">Kolom absensi baru akan otomatis disinkronkan</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Latihan *
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Agenda / Judul Latihan *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="cth: Latihan Rutin Minggu ke-4 / Gladi Bersih"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lokasi Latihan
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="cth: Ruang Koor Utama / Gereja"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Daftar Lagu / Partitur
                </label>
                <input
                  type="text"
                  value={newSongs}
                  onChange={(e) => setNewSongs(e.target.value)}
                  placeholder="cth: Hallelujah Chorus, Ave Verum Corpus"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
                >
                  Buat Jadwal Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Note Edit Modal */}
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Catatan Kehadiran</h4>
                <p className="text-xs text-slate-500">
                  {editingNote.memberName} ({editingNote.status})
                </p>
              </div>
              <button
                onClick={() => setEditingNote(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Keterangan / Alasan (cth: Dinas luar kota, demam)
              </label>
              <textarea
                value={editingNote.note}
                onChange={(e) =>
                  setEditingNote({ ...editingNote, note: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="Tulis alasan izin, sakit, atau catatan khusus..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateSessionRecord(
                    editingNote.sessionId,
                    editingNote.memberId,
                    editingNote.status,
                    editingNote.note
                  );
                  setEditingNote(null);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
