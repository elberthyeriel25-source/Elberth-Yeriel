import React from 'react';
import {
  Music,
  Users,
  Calendar,
  BarChart3,
  MessageSquare,
  FileSpreadsheet,
  RotateCcw,
  RotateCw,
  History,
  CheckCircle,
  RefreshCw,
  Plus,
  Share2,
  Smartphone,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  LogOut,
  CalendarDays,
} from 'lucide-react';

export type AppView =
  | 'sheet'
  | 'attendance'
  | 'stats'
  | 'whatsapp'
  | 'member-portal'
  | 'member-schedule';

interface HeaderProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  isAdmin: boolean;
  onOpenAdminLoginModal: () => void;
  onLogoutAdmin: () => void;
  onOpenPinSettingsModal: () => void;
  syncStatus: 'synced' | 'syncing' | 'error';
  lastSavedText: string;
  activeUsersCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSheetsModal: () => void;
  onOpenLogsModal: () => void;
  onOpenAddMemberModal: () => void;
  onOpenShareModal: () => void;
  isCloudConfigured: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  isAdmin,
  onOpenAdminLoginModal,
  onLogoutAdmin,
  onOpenPinSettingsModal,
  syncStatus,
  lastSavedText,
  activeUsersCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSheetsModal,
  onOpenLogsModal,
  onOpenAddMemberModal,
  onOpenShareModal,
  isCloudConfigured,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      {/* Top Warning Banner if Admin Mode is active */}
      {isAdmin && (
        <div className="bg-linear-to-r from-amber-500 via-orange-500 to-amber-600 text-white text-[11px] font-bold py-1 px-4 text-center flex items-center justify-between">
          <div className="flex items-center gap-1.5 mx-auto">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>MODE DEVELOPER & PENGURUS DIAKTIFKAN — Kontrol penuh spreadsheet, database, dan jadwal</span>
          </div>
          <button
            type="button"
            onClick={onLogoutAdmin}
            className="text-[10px] bg-black/20 hover:bg-black/40 px-2 py-0.5 rounded-md flex items-center gap-1 transition"
            title="Keluar ke Mode Pengguna Umum"
          >
            <LogOut className="w-3 h-3" />
            <span>Kunci / Keluar</span>
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Navbar Row */}
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Choir Identity */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                  Database & Absensi Koor
                </h1>
                {isAdmin ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                    PENGURUS
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    PORTAL ANGGOTA
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                {isAdmin
                  ? 'Panel Kontrol Manajemen & Database Paduan Suara SATB'
                  : 'Sistem absensi mandiri & jadwal latihan paduan suara'}
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Real-time Sync Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              {syncStatus === 'syncing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                  <span className="font-semibold text-blue-700">Menyinkronkan...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-slate-700">Tersinkron</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {lastSavedText}
                  </span>
                </>
              )}
            </div>

            {/* IF REGULAR MEMBER (USER MODE) */}
            {!isAdmin ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenAdminLoginModal}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  title="Masuk ke panel kontrol Developer/Pengurus"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mode Pengurus</span>
                </button>
              </div>
            ) : (
              /* IF DEVELOPER / ADMIN MODE */
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Undo / Redo */}
                <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition"
                    title="Undo (Ctrl+Z)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition"
                    title="Redo (Ctrl+Y)"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Share Link & QR Button */}
                <button
                  type="button"
                  onClick={onOpenShareModal}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  title="Bagikan Link atau QR Absensi ke HP Anggota Koor"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bagikan QR/Link</span>
                </button>

                {/* Google Sheets Sync Button */}
                <button
                  type="button"
                  onClick={onOpenSheetsModal}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                    isCloudConfigured
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Integrasi & Sinkronisasi Google Sheets"
                >
                  <FileSpreadsheet className={`w-3.5 h-3.5 ${isCloudConfigured ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <span className="hidden sm:inline">Google Sheets</span>
                </button>

                {/* Riwayat Log Activity */}
                <button
                  type="button"
                  onClick={onOpenLogsModal}
                  className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
                  title="Riwayat Perubahan & Log Sistem"
                >
                  <History className="w-4 h-4" />
                </button>

                {/* Ganti PIN Button */}
                <button
                  type="button"
                  onClick={onOpenPinSettingsModal}
                  className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
                  title="Ganti PIN Pengurus"
                >
                  <KeyRound className="w-4 h-4 text-amber-600" />
                </button>

                {/* Add Member Manual Quick Button */}
                <button
                  type="button"
                  onClick={onOpenAddMemberModal}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden md:inline">Tambah Anggota</span>
                </button>

                {/* Logout / Lock Button */}
                <button
                  type="button"
                  onClick={onLogoutAdmin}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  title="Kunci Akses Pengurus (Kembali ke Mode Anggota)"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kunci</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* View Navigation Tabs Row */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 pt-1 -mb-px">
          {!isAdmin ? (
            /* USER TABS (Only safe, read-only or self-attendance tabs) */
            <>
              {[
                { id: 'member-portal', label: '📱 Isi Absensi Mandiri (HP)', icon: Smartphone },
                { id: 'member-schedule', label: '📅 Jadwal & Materi Lagu Latihan', icon: CalendarDays },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = currentView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onViewChange(tab.id as AppView)}
                    className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                      isActive
                        ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </>
          ) : (
            /* DEVELOPER / ADMIN TABS (All master controls) */
            <>
              {[
                { id: 'sheet', label: 'Database Anggota (Sheet Master)', icon: Users },
                { id: 'attendance', label: 'Lembar Absensi Latihan', icon: Calendar },
                { id: 'member-portal', label: '📱 Portal Mandiri (HP)', icon: Smartphone },
                { id: 'member-schedule', label: '📅 Pratinjau Jadwal Anggota', icon: CalendarDays },
                { id: 'stats', label: 'Statistik & Suara SATB', icon: BarChart3 },
                { id: 'whatsapp', label: 'Pengingat WhatsApp', icon: MessageSquare },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = currentView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onViewChange(tab.id as AppView)}
                    className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                      isActive
                        ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </header>
  );
};
