import React from 'react';
import { Member, AttendanceSession, VoiceType } from '../types';
import {
  TrendingUp,
  Users,
  Award,
  AlertTriangle,
  MessageCircle,
  Activity,
  Music2,
  CheckCircle,
} from 'lucide-react';

interface StatsViewProps {
  members: Member[];
  sessions: AttendanceSession[];
}

export const StatsView: React.FC<StatsViewProps> = ({ members, sessions }) => {
  // Voice breakdown
  const voiceCounts: Record<VoiceType, number> = {
    Sopran: members.filter((m) => m.voice === 'Sopran').length,
    Alto: members.filter((m) => m.voice === 'Alto').length,
    Tenor: members.filter((m) => m.voice === 'Tenor').length,
    Bass: members.filter((m) => m.voice === 'Bass').length,
  };

  const totalMembers = members.length;

  // Member stats
  const memberStats = members.map((m) => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;

    sessions.forEach((s) => {
      const rec = s.records[m.id];
      if (rec?.status === 'Hadir') hadir++;
      else if (rec?.status === 'Izin') izin++;
      else if (rec?.status === 'Sakit') sakit++;
      else if (rec?.status === 'Alpa') alpa++;
    });

    const pct = sessions.length > 0 ? Math.round((hadir / sessions.length) * 100) : 0;
    return {
      member: m,
      hadir,
      izin,
      sakit,
      alpa,
      pct,
    };
  });

  // Calculate overall attendance percentage across all sessions
  let totalHadirAll = 0;
  let totalOpportunities = totalMembers * sessions.length;
  sessions.forEach((s) => {
    members.forEach((m) => {
      if (s.records[m.id]?.status === 'Hadir') totalHadirAll++;
    });
  });

  const overallPct =
    totalOpportunities > 0 ? Math.round((totalHadirAll / totalOpportunities) * 100) : 0;

  // Top Attendees (100% or highest)
  const topAttendees = [...memberStats].sort((a, b) => b.pct - a.pct).slice(0, 5);

  // At risk members (Alpa >= 1 or pct < 65%)
  const atRiskMembers = memberStats.filter((m) => m.alpa > 0 || m.pct < 65);

  // Section Attendance comparison
  const sectionAttendance: Record<VoiceType, { totalHadir: number; opportunities: number; pct: number }> = {
    Sopran: { totalHadir: 0, opportunities: 0, pct: 0 },
    Alto: { totalHadir: 0, opportunities: 0, pct: 0 },
    Tenor: { totalHadir: 0, opportunities: 0, pct: 0 },
    Bass: { totalHadir: 0, opportunities: 0, pct: 0 },
  };

  sessions.forEach((s) => {
    members.forEach((m) => {
      const voice = m.voice;
      sectionAttendance[voice].opportunities++;
      if (s.records[m.id]?.status === 'Hadir') {
        sectionAttendance[voice].totalHadir++;
      }
    });
  });

  (['Sopran', 'Alto', 'Tenor', 'Bass'] as VoiceType[]).forEach((v) => {
    const opp = sectionAttendance[v].opportunities;
    sectionAttendance[v].pct = opp > 0 ? Math.round((sectionAttendance[v].totalHadir / opp) * 100) : 0;
  });

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Anggota Koor</p>
            <h3 className="text-2xl font-black text-slate-900">{totalMembers}</h3>
            <p className="text-[11px] text-emerald-600 font-medium">100% Aktif Terdaftar</p>
          </div>
        </div>

        {/* Overall Attendance Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Rerata Kehadiran</p>
            <h3 className="text-2xl font-black text-slate-900">{overallPct}%</h3>
            <p className="text-[11px] text-slate-500 font-medium">Dari {sessions.length} sesi latihan</p>
          </div>
        </div>

        {/* Total Sessions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Music2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Latihan Tercatat</p>
            <h3 className="text-2xl font-black text-slate-900">{sessions.length}</h3>
            <p className="text-[11px] text-purple-600 font-medium">Periode Terkini</p>
          </div>
        </div>

        {/* Need Follow-up */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Perlu Follow-up</p>
            <h3 className="text-2xl font-black text-slate-900">{atRiskMembers.length}</h3>
            <p className="text-[11px] text-amber-600 font-medium">Alpa atau izin berturut</p>
          </div>
        </div>
      </div>

      {/* SATB Voice Balance & Section Attendance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SATB Balance Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Distribusi Keseimbangan Suara (SATB)</h4>
              <p className="text-xs text-slate-500">Komposisi penyanyi per seksi vokal</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700">
              SATB Paduan Suara
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {(
              [
                { voice: 'Sopran', count: voiceCounts.Sopran, color: 'bg-rose-500', barBg: 'bg-rose-100', text: 'text-rose-700' },
                { voice: 'Alto', count: voiceCounts.Alto, color: 'bg-purple-500', barBg: 'bg-purple-100', text: 'text-purple-700' },
                { voice: 'Tenor', count: voiceCounts.Tenor, color: 'bg-amber-500', barBg: 'bg-amber-100', text: 'text-amber-800' },
                { voice: 'Bass', count: voiceCounts.Bass, color: 'bg-sky-500', barBg: 'bg-sky-100', text: 'text-sky-700' },
              ] as const
            ).map((item) => {
              const pct = totalMembers > 0 ? Math.round((item.count / totalMembers) * 100) : 0;
              return (
                <div key={item.voice} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className={item.text}>
                      {item.voice}
                    </span>
                    <span className="text-slate-600 font-mono">
                      {item.count} orang ({pct}%)
                    </span>
                  </div>
                  <div className={`w-full h-2.5 rounded-full ${item.barBg} overflow-hidden`}>
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
            💡 Keseimbangan ideal paduan suara 4 suara (SATB) umumnya memiliki rasio vokal Sopran 30%, Alto 25%, Tenor 20%, Bass 25%.
          </div>
        </div>

        {/* Attendance Rate by Voice Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Disiplin Kehadiran per Seksi Suara</h4>
              <p className="text-xs text-slate-500">Persentase latihan dihadiri berdasarkan seksi</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="space-y-3 pt-2">
            {(['Sopran', 'Alto', 'Tenor', 'Bass'] as VoiceType[]).map((v) => {
              const stat = sectionAttendance[v];
              return (
                <div key={v} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">Seksi {v}</span>
                      <span className="text-[11px] text-slate-500">
                        {stat.totalHadir} kehadiran dari {stat.opportunities} sesi
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-black font-mono ${
                        stat.pct >= 80
                          ? 'text-emerald-600'
                          : stat.pct >= 60
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {stat.pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaders & Follow-up lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top disciplined members */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h4 className="font-bold text-slate-900 text-sm">Anggota Paling Rajin</h4>
            </div>
            <span className="text-xs text-slate-400">Tingkat kehadiran tertinggi</span>
          </div>

          <div className="divide-y divide-slate-100">
            {topAttendees.map((item, idx) => (
              <div key={item.member.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 font-bold text-xs flex items-center justify-center font-mono">
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{item.member.name}</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Seksi {item.member.voice}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 font-mono">
                    {item.pct}% ({item.hadir}/{sessions.length})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Members Needing Follow-up */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <h4 className="font-bold text-slate-900 text-sm">Perlu Pendampingan / Follow-up</h4>
            </div>
            <span className="text-xs text-slate-400">Ada riwayat alpa/izin</span>
          </div>

          {atRiskMembers.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <CheckCircle className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
              <p className="text-xs font-semibold text-emerald-700">Luar biasa! Seluruh anggota aktif hadir teratur.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {atRiskMembers.map((item) => (
                <div key={item.member.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{item.member.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {item.member.voice} • {item.alpa}x Alpa, {item.izin}x Izin
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 font-mono">
                      {item.pct}%
                    </span>
                    {item.member.phone && (
                      <a
                        href={`https://wa.me/${
                          item.member.phone.startsWith('0')
                            ? '62' + item.member.phone.slice(1)
                            : item.member.phone
                        }?text=${encodeURIComponent(
                          `Halo ${item.member.name}, salam dari pengurus koor. Semoga kabarnya baik! Kami merindukan kehadiranmu di sesi latihan selanjutnya. 🙏🎶`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                        title="Follow up via WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
