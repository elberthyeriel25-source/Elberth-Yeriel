import React, { useState, useEffect } from 'react';
import { Member, AttendanceSession, GoogleSheetsConfig } from '../types';
import {
  generateGoogleAppsScriptCode,
  membersToCSV,
  attendanceMatrixToCSV,
  parseCSVToMembers,
} from '../services/syncService';
import {
  initGoogleAuth,
  signInWithGoogle,
  signOutGoogle,
  getAccessToken,
  extractSpreadsheetId,
  getSpreadsheetMetadata,
  createNewChoirSpreadsheet,
  pushDataToGoogleSheets,
  pullMembersFromGoogleSheets,
} from '../services/googleSheetsService';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Copy,
  Check,
  X,
  ExternalLink,
  Code2,
  CheckCircle2,
  AlertCircle,
  Database,
  Cloud,
  LogOut,
  PlusCircle,
  Link2,
  ShieldCheck,
  FileCheck,
  HelpCircle,
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetsConfig;
  onSaveConfig: (config: GoogleSheetsConfig) => void;
  members: Member[];
  sessions: AttendanceSession[];
  onImportMembers: (members: Member[]) => void;
  onResetToDefault: () => void;
  onSyncPush?: () => Promise<void>;
  onSyncPull?: () => Promise<void>;
  isSyncing?: boolean;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  members,
  sessions,
  onImportMembers,
  onResetToDefault,
}) => {
  const [activeTab, setActiveTab] = useState<'google_auth' | 'import_export' | 'apps_script'>('google_auth');

  // Firebase Google Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Spreadsheet Selection & Creation State
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState(config.sheetId || '');
  const [newSheetTitle, setNewSheetTitle] = useState('Absensi Koor - Database & Rekapitulasi');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isVerifyingSheet, setIsVerifyingSheet] = useState(false);
  const [activeSpreadsheetMeta, setActiveSpreadsheetMeta] = useState<{
    id: string;
    title: string;
    sheets: string[];
    url: string;
  } | null>(() => {
    if (config.sheetId) {
      return {
        id: config.sheetId,
        title: config.spreadsheetTitle || 'Spreadsheet Absensi Koor',
        sheets: ['Daftar Anggota', 'Rekapitulasi Absensi'],
        url: config.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`,
      };
    }
    return null;
  });

  // Action & sync state
  const [isSyncingDirect, setIsSyncingDirect] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Destructive / Mutating Operation Confirmation Dialog (Mandatory per Workspace Integration Skill)
  const [showConfirmPushDialog, setShowConfirmPushDialog] = useState(false);

  // Manual Export / Import state
  const [pasteData, setPasteData] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedTSV, setCopiedTSV] = useState(false);

  // Apps Script fallback inputs
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl || '');
  const [sheetName, setSheetName] = useState(config.sheetName || 'Database_Absensi_Koor');
  const [autoSync, setAutoSync] = useState(config.autoSync ?? true);

  // Monitor Auth state on mount
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initGoogleAuth((user) => {
      setCurrentUser(user);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  // If already configured with sheetId, try fetching fresh metadata
  useEffect(() => {
    if (isOpen && config.sheetId && !activeSpreadsheetMeta) {
      setActiveSpreadsheetMeta({
        id: config.sheetId,
        title: config.spreadsheetTitle || 'Spreadsheet Absensi Koor',
        sheets: ['Daftar Anggota', 'Rekapitulasi Absensi'],
        url: config.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${config.sheetId}/edit`,
      });
    }
  }, [isOpen, config.sheetId]);

  if (!isOpen) return null;

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setStatusMessage(null);
      const res = await signInWithGoogle();
      setCurrentUser(res.user);
      setStatusMessage({
        type: 'success',
        text: `Berhasil terhubung dengan akun Google: ${res.user.email}`,
      });
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal login dengan akun Google. Pastikan popup tidak diblokir.',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  // Handle Google Sign Out
  const handleGoogleSignOut = async () => {
    try {
      await signOutGoogle();
      setCurrentUser(null);
      setStatusMessage({
        type: 'success',
        text: 'Berhasil keluar dari akun Google.',
      });
    } catch (err: any) {
      console.error('Google Sign out failed:', err);
    }
  };

  // Create brand new Google Sheet
  const handleCreateNewSpreadsheet = async () => {
    const token = getAccessToken();
    if (!token) {
      setStatusMessage({
        type: 'error',
        text: 'Sesi login Google telah berakhir. Silakan masuk kembali.',
      });
      return;
    }

    try {
      setIsCreatingSheet(true);
      setStatusMessage(null);

      const result = await createNewChoirSpreadsheet(newSheetTitle, token);

      const newMeta = {
        id: result.spreadsheetId,
        title: newSheetTitle.trim() || 'Absensi Koor - Database & Rekapitulasi',
        sheets: ['Daftar Anggota', 'Rekapitulasi Absensi'],
        url: result.spreadsheetUrl,
      };

      setActiveSpreadsheetMeta(newMeta);
      setSpreadsheetIdInput(result.spreadsheetId);

      // Save to config
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        sheetId: result.spreadsheetId,
        spreadsheetTitle: newMeta.title,
        spreadsheetUrl: newMeta.url,
        lastSynced: new Date().toISOString(),
      };
      onSaveConfig(updatedConfig);

      // Instantly push initial data to the newly created sheet
      await pushDataToGoogleSheets(result.spreadsheetId, token, members, sessions);

      setStatusMessage({
        type: 'success',
        text: `Spreadsheet baru "${newMeta.title}" berhasil dibuat di Google Drive Anda dan data telah disinkronkan!`,
      });
    } catch (err: any) {
      console.error('Create sheet error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal membuat Google Spreadsheet baru.',
      });
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Connect to existing spreadsheet
  const handleConnectExistingSpreadsheet = async () => {
    const rawInput = spreadsheetIdInput.trim();
    if (!rawInput) {
      setStatusMessage({
        type: 'error',
        text: 'Masukkan tautan (link) Google Sheets atau Spreadsheet ID.',
      });
      return;
    }

    const cleanId = extractSpreadsheetId(rawInput);
    const token = getAccessToken();
    if (!token) {
      setStatusMessage({
        type: 'error',
        text: 'Silakan masuk dengan akun Google terlebih dahulu.',
      });
      return;
    }

    try {
      setIsVerifyingSheet(true);
      setStatusMessage(null);

      const meta = await getSpreadsheetMetadata(cleanId, token);
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;

      const newMeta = {
        id: cleanId,
        title: meta.title,
        sheets: meta.sheets,
        url: sheetUrl,
      };

      setActiveSpreadsheetMeta(newMeta);

      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        sheetId: cleanId,
        spreadsheetTitle: meta.title,
        spreadsheetUrl: sheetUrl,
      };
      onSaveConfig(updatedConfig);

      setStatusMessage({
        type: 'success',
        text: `Berhasil terhubung ke spreadsheet: "${meta.title}".`,
      });
    } catch (err: any) {
      console.error('Verification error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal memverifikasi spreadsheet. Pastikan link benar dan akun memiliki akses.',
      });
    } finally {
      setIsVerifyingSheet(false);
    }
  };

  // Execute confirmed Push to Google Sheets
  const handleExecutePushData = async () => {
    setShowConfirmPushDialog(false);
    if (!activeSpreadsheetMeta?.id) return;

    let token = getAccessToken();
    if (!token) {
      try {
        const res = await signInWithGoogle();
        token = res.accessToken;
      } catch (err) {
        setStatusMessage({
          type: 'error',
          text: 'Diperlukan autentikasi Google untuk menyinkronkan data.',
        });
        return;
      }
    }

    try {
      setIsSyncingDirect(true);
      setStatusMessage(null);

      const result = await pushDataToGoogleSheets(
        activeSpreadsheetMeta.id,
        token,
        members,
        sessions
      );

      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        sheetId: activeSpreadsheetMeta.id,
        spreadsheetTitle: activeSpreadsheetMeta.title,
        spreadsheetUrl: activeSpreadsheetMeta.url,
        lastSynced: new Date().toISOString(),
      };
      onSaveConfig(updatedConfig);

      setStatusMessage({
        type: 'success',
        text: `Berhasil menyinkronkan ${members.length} anggota dan ${sessions.length} jadwal absensi ke Google Sheets (${result.updatedCells} sel diperbarui)!`,
      });
    } catch (err: any) {
      console.error('Sync push error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal mengirim data ke Google Sheets.',
      });
    } finally {
      setIsSyncingDirect(false);
    }
  };

  // Pull data from Google Sheets
  const handlePullData = async () => {
    if (!activeSpreadsheetMeta?.id) return;

    let token = getAccessToken();
    if (!token) {
      try {
        const res = await signInWithGoogle();
        token = res.accessToken;
      } catch (err) {
        setStatusMessage({
          type: 'error',
          text: 'Diperlukan autentikasi Google untuk mengambil data.',
        });
        return;
      }
    }

    try {
      setIsSyncingDirect(true);
      setStatusMessage(null);

      const importedMembers = await pullMembersFromGoogleSheets(activeSpreadsheetMeta.id, token);
      if (importedMembers.length === 0) {
        throw new Error('Tidak ada baris data anggota yang ditemukan pada sheet tersebut.');
      }

      onImportMembers(importedMembers);
      setStatusMessage({
        type: 'success',
        text: `Berhasil mengimpor ${importedMembers.length} anggota dari Google Sheets!`,
      });
    } catch (err: any) {
      console.error('Sync pull error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal menarik data dari Google Sheets.',
      });
    } finally {
      setIsSyncingDirect(false);
    }
  };

  // Disconnect spreadsheet
  const handleDisconnectSpreadsheet = () => {
    setActiveSpreadsheetMeta(null);
    setSpreadsheetIdInput('');
    const updatedConfig: GoogleSheetsConfig = {
      ...config,
      sheetId: '',
      spreadsheetTitle: '',
      spreadsheetUrl: '',
    };
    onSaveConfig(updatedConfig);
    setStatusMessage({
      type: 'success',
      text: 'Tautan spreadsheet telah diputuskan.',
    });
  };

  // CSV/TSV helper handlers
  const handleDownloadMembersCSV = () => {
    const csv = '\uFEFF' + membersToCSV(members);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Database_Anggota_Koor_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAttendanceCSV = () => {
    const csv = '\uFEFF' + attendanceMatrixToCSV(members, sessions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Kehadiran_Koor_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTSV = () => {
    const header = ['Nama Lengkap', 'Suara', 'No WhatsApp'].join('\t');
    const rows = members.map((m) => [m.name, m.voice, m.phone].join('\t'));
    const tsv = [header, ...rows].join('\n');

    navigator.clipboard.writeText(tsv);
    setCopiedTSV(true);
    setTimeout(() => setCopiedTSV(false), 2500);
  };

  const handleImportText = () => {
    if (!pasteData.trim()) return;
    const parsed = parseCSVToMembers(pasteData);
    if (parsed.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Format data tidak dikenali. Pastikan terdapat kolom Nama Lengkap, Suara, dan No WhatsApp.',
      });
      return;
    }
    onImportMembers(parsed);
    setPasteData('');
    setStatusMessage({
      type: 'success',
      text: `Berhasil mengimpor ${parsed.length} data anggota!`,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const parsed = parseCSVToMembers(content);
        if (parsed.length > 0) {
          onImportMembers(parsed);
          setStatusMessage({
            type: 'success',
            text: `Berhasil mengimpor ${parsed.length} anggota dari file ${file.name}!`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: 'Format file CSV tidak dikenali.',
          });
        }
      }
    };
    reader.readAsText(file);
  };

  const appsScriptCode = generateGoogleAppsScriptCode(sheetName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4.5 bg-linear-to-r from-emerald-800 via-emerald-900 to-teal-950 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-emerald-300 flex items-center justify-center font-bold border border-white/10 shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base">Sinkronisasi Google Sheets</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Google Drive Terintegrasi
                </span>
              </div>
              <p className="text-xs text-emerald-200/90">
                Hubungkan absensi langsung ke akun Google Anda untuk update spreadsheet otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-300 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/90 text-xs font-semibold px-2">
          <button
            onClick={() => setActiveTab('google_auth')}
            className={`py-3 px-4 border-b-2 text-center transition flex items-center gap-2 ${
              activeTab === 'google_auth'
                ? 'border-emerald-600 text-emerald-800 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-4 h-4 text-emerald-600" />
            <span>Akun Google Sheets Saya</span>
          </button>

          <button
            onClick={() => setActiveTab('import_export')}
            className={`py-3 px-4 border-b-2 text-center transition flex items-center gap-2 ${
              activeTab === 'import_export'
                ? 'border-emerald-600 text-emerald-800 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Download CSV & Salin TSV</span>
          </button>

          <button
            onClick={() => setActiveTab('apps_script')}
            className={`py-3 px-4 border-b-2 text-center transition flex items-center gap-2 ${
              activeTab === 'apps_script'
                ? 'border-emerald-600 text-emerald-800 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4 text-slate-500" />
            <span>Apps Script (Opsional)</span>
          </button>
        </div>

        {/* Main Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl flex items-center justify-between gap-2.5 transition animate-in fade-in duration-200 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-semibold text-xs leading-snug">{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: GOOGLE SHEETS DIRECT NATIVE OAUTH INTEGRATION */}
          {activeTab === 'google_auth' && (
            <div className="space-y-4">
              {/* Account Connection State */}
              {!currentUser ? (
                <div className="p-5 bg-linear-to-br from-blue-50/60 to-indigo-50/60 border border-blue-200/80 rounded-2xl text-center space-y-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-blue-100 flex items-center justify-center mx-auto text-blue-600">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Hubungkan dengan Akun Google Anda
                    </h4>
                    <p className="text-slate-600 text-[11px] max-w-md mx-auto mt-1 leading-relaxed">
                      Sambungkan spreadsheet Google Sheets langsung ke akun Google Anda dengan aman. Data anggota dan absensi paduan suara akan otomatis tersinkronisasi.
                    </p>
                  </div>

                  {/* Official Google Sign-in Button */}
                  <div className="pt-1 flex justify-center">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isSigningIn}
                      className="inline-flex items-center gap-3 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-xs hover:shadow-md transition active:scale-98 disabled:opacity-50"
                    >
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        <path fill="none" d="M0 0h48v48H0z" />
                      </svg>
                      <span>{isSigningIn ? 'Menghubungkan...' : 'Masuk dengan Google (Google Sheets)'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt="Profile"
                        className="w-9 h-9 rounded-full border border-emerald-300 object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                        {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-950 text-xs">
                          {currentUser.displayName || 'Akun Google'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-200 text-emerald-800">
                          TERHUBUNG
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 font-mono">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleSignOut}
                    className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-semibold rounded-xl border border-rose-200 flex items-center gap-1.5 transition text-[11px]"
                    title="Keluar dari akun Google"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Ganti Akun</span>
                  </button>
                </div>
              )}

              {/* SPREADSHEET STATUS & MANAGEMENT */}
              {activeSpreadsheetMeta ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Spreadsheet Aktif
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 mt-0.5">
                        <span>{activeSpreadsheetMeta.title}</span>
                      </h4>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate max-w-sm">
                        ID: {activeSpreadsheetMeta.id}
                      </p>
                    </div>

                    <a
                      href={activeSpreadsheetMeta.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
                    >
                      <span>Buka di Google Sheets</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Sheet Tabs Info */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-slate-600">
                        Memuat lembar: <strong>Daftar Anggota</strong> &amp; <strong>Rekapitulasi Absensi</strong>
                      </span>
                    </div>
                    {config.lastSynced && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Sinkron: {new Date(config.lastSynced).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleDisconnectSpreadsheet}
                      className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold underline underline-offset-2"
                    >
                      Ganti Spreadsheet
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePullData}
                        disabled={isSyncingDirect}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDirect ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Tarik dari Sheets</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowConfirmPushDialog(true)}
                        disabled={isSyncingDirect}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition active:scale-98"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        <span>{isSyncingDirect ? 'Menyinkronkan...' : 'Kirim Data ke Google Sheets'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* CHOOSE / CREATE SPREADSHEET OPTIONS */
                <div className="space-y-3">
                  {/* Option 1: Create Brand New Spreadsheet */}
                  <div className="p-4 bg-linear-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                      <h4 className="font-extrabold text-emerald-950 text-xs">
                        Pilihan 1: Buat Spreadsheet Baru di Google Drive Anda (Direkomendasikan)
                      </h4>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Sistem akan membuat file spreadsheet baru dengan format resmi berisi tab <strong>Daftar Anggota</strong> dan <strong>Rekapitulasi Absensi SATB</strong> yang siap pakai.
                    </p>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newSheetTitle}
                        onChange={(e) => setNewSheetTitle(e.target.value)}
                        placeholder="Nama Dokumen Spreadsheet"
                        className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleCreateNewSpreadsheet}
                        disabled={isCreatingSheet}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{isCreatingSheet ? 'Membuat File...' : 'Buat Spreadsheet Baru'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Option 2: Connect Existing Spreadsheet */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <h4 className="font-bold text-slate-800 text-xs">
                        Pilihan 2: Sambungkan ke Google Sheets yang Sudah Ada
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Tempelkan URL Google Sheets Anda (misal: <code>https://docs.google.com/spreadsheets/d/...</code>) atau ID Spreadsheet.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={spreadsheetIdInput}
                        onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleConnectExistingSpreadsheet}
                        disabled={isVerifyingSheet || !spreadsheetIdInput.trim()}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isVerifyingSheet ? 'Memverifikasi...' : 'Hubungkan'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset to initial attachment */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px]">
                <div>
                  <h5 className="font-bold text-slate-800">Muat Ulang Data Awal Lampiran</h5>
                  <p className="text-slate-500">
                    Kembalikan database ke data bawaan awal (Database_Absensi_Koor_4ad61b53).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset database ke data awal? Semua data anggota lokal akan digantikan.')) {
                      onResetToDefault();
                      setStatusMessage({
                        type: 'success',
                        text: 'Data telah dikembalikan ke dataset awal file.',
                      });
                    }
                  }}
                  className="px-3 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl"
                >
                  Reset Data Awal
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: DOWNLOAD CSV & COPY TSV */}
          {activeTab === 'import_export' && (
            <div className="space-y-4">
              {/* Quick Copy TSV for 1-Click Paste into Google Sheets */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <h5 className="font-extrabold text-emerald-950 text-xs">Salin Format Google Sheets (TSV)</h5>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Klik tombol di samping, lalu langsung tekan <strong>Ctrl + V</strong> di sel A1 Google Sheets Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyTSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
                >
                  {copiedTSV ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedTSV ? 'Tersalin ke Clipboard!' : 'Salin ke Clipboard'}</span>
                </button>
              </div>

              {/* Download CSV Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleDownloadMembersCSV}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-3 text-left font-semibold text-slate-800 transition"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block">Download CSV Anggota</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Daftar Lengkap Nama, Suara, No WA
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAttendanceCSV}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-3 text-left font-semibold text-slate-800 transition"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs block">Download Rekap Absensi</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Matriks Semua Sesi & Persentase
                    </span>
                  </div>
                </button>
              </div>

              {/* Upload or Paste Import */}
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <h5 className="font-bold text-slate-800 text-xs">Impor Data Anggota Tambahan</h5>
                <div className="flex items-center gap-2">
                  <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer flex items-center gap-1.5 transition">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>Pilih File CSV / TSV</span>
                    <input
                      type="file"
                      accept=".csv,.txt,.tsv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-slate-400 text-[11px]">atau tempelkan baris data di bawah:</span>
                </div>

                <textarea
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                  placeholder="Nama Lengkap,Suara,No WhatsApp&#10;Budi Santoso,Tenor,081234567890&#10;Maria Fransiska,Sopran,089876543210..."
                  rows={4}
                  className="w-full p-2.5 font-mono text-[11px] border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleImportText}
                    disabled={!pasteData.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl disabled:opacity-40 shadow-xs transition"
                  >
                    Impor Data ke Aplikasi
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APPS SCRIPT WEBHOOK */}
          {activeTab === 'apps_script' && (
            <div className="space-y-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-800 text-xs">
                    Script Google Apps (Opsional untuk Webhook Otomatis)
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(appsScriptCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2500);
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 transition"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Tersalin!' : 'Salin Script'}</span>
                  </button>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Buka Google Sheets &gt; Extensions &gt; Apps Script, tempelkan kode ini, lalu Deploy sebagai Web App jika Anda ingin sinkronisasi melalui Webhook.
                </p>
              </div>

              <pre className="p-3 bg-slate-900 text-emerald-300 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-56">
                {appsScriptCode}
              </pre>

              <div className="pt-2 border-t border-slate-200">
                <label className="block font-semibold text-slate-700 mb-1">
                  URL Web App Google Apps Script
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSaveConfig({
                        ...config,
                        webhookUrl: webhookUrl.trim(),
                        sheetName: sheetName.trim() || 'Database_Absensi_Koor',
                        autoSync,
                      });
                      setStatusMessage({
                        type: 'success',
                        text: 'Pengaturan Webhook Apps Script disimpan.',
                      });
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Terhubung ke Google Sheets API v4 resmi dengan izin dari akun Google Anda.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION DIALOG FOR MUTATING GOOGLE SHEETS DATA */}
      {showConfirmPushDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-extrabold text-slate-900 text-base">
                Konfirmasi Sinkronisasi Google Sheets
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Apakah Anda yakin ingin memperbarui data pada spreadsheet{' '}
                <strong>"{activeSpreadsheetMeta?.title || 'Google Sheets'}"</strong>?
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-slate-900">Perubahan yang akan ditulis:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>Tab <strong>Daftar Anggota</strong>: {members.length} anggota koor</li>
                <li>Tab <strong>Rekapitulasi Absensi</strong>: {sessions.length} sesi latihan &amp; status kehadiran</li>
                <li>Formula persentase kehadiran SATB otomatis</li>
              </ul>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmPushDialog(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecutePushData}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-98"
              >
                Ya, Perbarui Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
