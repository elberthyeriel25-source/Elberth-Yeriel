import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Member, AttendanceSession, AttendanceStatus, GoogleSheetsConfig, ActivityLogItem } from './types';
import {
  getStoredMembers,
  saveStoredMembers,
  getStoredSessions,
  saveStoredSessions,
  getStoredConfig,
  saveStoredConfig,
  getStoredLogs,
  appendActivityLog,
  syncManager,
  getClientName,
} from './services/syncService';
import { INITIAL_MEMBERS, INITIAL_SESSIONS } from './data/initialData';
import { Header, AppView } from './components/Header';
import { SpreadsheetView } from './components/SpreadsheetView';
import { AttendanceMatrixView } from './components/AttendanceMatrixView';
import { StatsView } from './components/StatsView';
import { WhatsAppSenderView } from './components/WhatsAppSenderView';
import { MemberEditModal } from './components/MemberEditModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { ActivityLogModal } from './components/ActivityLogModal';
import { MemberAttendancePortal } from './components/MemberAttendancePortal';
import { MemberScheduleView } from './components/MemberScheduleView';
import { ShareAttendanceModal } from './components/ShareAttendanceModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminPinSettingsModal } from './components/AdminPinSettingsModal';
import { checkIsAdminLoggedIn, logoutAdmin } from './services/authService';
import { fetchServerData } from './services/syncService';
import { pushDataToGoogleSheets, getAccessToken } from './services/googleSheetsService';
import {
  initFirestoreSync,
  deleteMembersFromFirestore,
  deleteSessionFromFirestore,
  saveSessionToFirestore,
} from './services/firestoreSync';
import { Bell, CheckCircle2, X, ShieldAlert, Lock, Cloud, CloudCheck } from 'lucide-react';

export default function App() {
  const [members, setMembers] = useState<Member[]>(() => getStoredMembers());
  const [sessions, setSessions] = useState<AttendanceSession[]>(() => getStoredSessions());
  const [config, setConfig] = useState<GoogleSheetsConfig>(() => getStoredConfig());
  const [logs, setLogs] = useState<ActivityLogItem[]>(() => getStoredLogs());

  // Role Authentication: Developer/Admin vs Regular Choir Member
  const [isAdmin, setIsAdmin] = useState<boolean>(() => checkIsAdminLoggedIn());
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [isPinSettingsModalOpen, setIsPinSettingsModalOpen] = useState(false);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Views & navigation: Default to 'member-portal' for non-admin to ensure members don't accidentally touch dev tools!
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (search.includes('mode=absen') || search.includes('absen') || hash.includes('absen') || search.includes('portal')) {
        return 'member-portal';
      }
      if (search.includes('jadwal') || hash.includes('jadwal')) {
        return 'member-schedule';
      }
    }
    return checkIsAdminLoggedIn() ? 'sheet' : 'member-portal';
  });

  // Sesi parameter from URL (supports both 'sesi' and 'session')
  const [initialSessionId, setInitialSessionId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('sesi') || params.get('session') || undefined;
    }
    return undefined;
  });

  // Sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastSavedText, setLastSavedText] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);

  // Live Toast for newly submitted attendances
  const [remoteNotification, setRemoteNotification] = useState<{
    name: string;
    voice: string;
    status: string;
    isNew: boolean;
  } | null>(null);

  // Undo / Redo history
  const [undoStack, setUndoStack] = useState<{ members: Member[]; sessions: AttendanceSession[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ members: Member[]; sessions: AttendanceSession[] }[]>([]);

  // Modals
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareModalSessionId, setShareModalSessionId] = useState<string | undefined>();
  const [preselectedBroadcast, setPreselectedBroadcast] = useState<{ name: string; phone: string }[]>();

  // Push current state to undo history before modifying
  const pushUndoSnapshot = () => {
    setUndoStack((prev) => [...prev.slice(-20), { members, sessions }]);
    setRedoStack([]); // reset redo on fresh edit
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const lastSnapshot = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    setRedoStack((prev) => [...prev, { members, sessions }]);
    setUndoStack(newUndoStack);

    setMembers(lastSnapshot.members);
    setSessions(lastSnapshot.sessions);
    saveStoredMembers(lastSnapshot.members);
    saveStoredSessions(lastSnapshot.sessions);
    appendActivityLog('Undo', 'Membatalkan perubahan terakhir');
    setLogs(getStoredLogs());
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    setUndoStack((prev) => [...prev, { members, sessions }]);
    setRedoStack(newRedoStack);

    setMembers(nextSnapshot.members);
    setSessions(nextSnapshot.sessions);
    saveStoredMembers(nextSnapshot.members);
    saveStoredSessions(nextSnapshot.sessions);
    appendActivityLog('Redo', 'Mengulangi perubahan yang dibatalkan');
    setLogs(getStoredLogs());
  };

  // Keyboard shortcuts for Undo (Ctrl+Z) & Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, members, sessions]);

  // Handle View Change with Role Authorization
  const handleViewChange = (newView: AppView) => {
    // If attempting to open developer/admin views without permission, prompt for PIN
    if (!isAdmin && ['sheet', 'attendance', 'stats', 'whatsapp'].includes(newView)) {
      setIsAdminLoginModalOpen(true);
      return;
    }
    setCurrentView(newView);
  };

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    setCurrentView('sheet');
    setToastBanner('👑 Berhasil masuk ke Mode Developer & Pengurus Koor!');
    setTimeout(() => setToastBanner(null), 4000);
  };

  const handleAdminLogout = () => {
    logoutAdmin();
    setIsAdmin(false);
    setCurrentView('member-portal');
    setToastBanner('🔒 Anda telah keluar ke Mode Anggota Koor.');
    setTimeout(() => setToastBanner(null), 4000);
  };

  // Subscribe to multi-window / multi-tab broadcast channel
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((msg) => {
      if (msg.type === 'MEMBERS_UPDATED') {
        const fresh = getStoredMembers();
        setMembers(fresh);
        setSyncStatus('synced');
        setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        setLogs(getStoredLogs());
      } else if (msg.type === 'SESSIONS_UPDATED') {
        const fresh = getStoredSessions();
        setSessions(fresh);
        setSyncStatus('synced');
        setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        setLogs(getStoredLogs());
      } else if (msg.type === 'USER_PRESENCE') {
        setActiveUsersCount(syncManager.getActivePeersCount());
      }
    });

    // Check peers count periodically
    const peerTimer = setInterval(() => {
      setActiveUsersCount(syncManager.getActivePeersCount());
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(peerTimer);
    };
  }, []);

  // Multi-Device Real-Time Cloud Synchronization via Firebase Firestore
  // Ensures every phone/computer sees the exact same data in real time!
  useEffect(() => {
    const unsubFirestore = initFirestoreSync({
      onMembersChange: (cloudMembers) => {
        if (cloudMembers && cloudMembers.length > 0) {
          setMembers((prevMembers) => {
            if (prevMembers.length > 0 && cloudMembers.length > prevMembers.length) {
              const newest = cloudMembers[cloudMembers.length - 1];
              setRemoteNotification({
                name: newest.name,
                voice: newest.voice,
                status: 'Terdaftar & Hadir',
                isNew: true,
              });
              setTimeout(() => setRemoteNotification(null), 5000);
            }
            return cloudMembers;
          });
          saveStoredMembers(cloudMembers, false, false);
          setSyncStatus('synced');
          setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        }
      },
      onSessionsChange: (cloudSessions) => {
        if (cloudSessions && cloudSessions.length > 0) {
          setSessions(cloudSessions);
          saveStoredSessions(cloudSessions, false, false);
          setSyncStatus('synced');
          setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        }
      },
      onAdminPinChange: (_cloudPin) => {
        // Cached cloud PIN is automatically updated in authService
      },
      onLogsChange: (cloudLogs) => {
        if (cloudLogs && cloudLogs.length > 0) {
          setLogs(cloudLogs);
        }
      },
    });

    return () => unsubFirestore();
  }, []);

  // Poll backend server for remote member attendance submissions (fallback for local dev)
  useEffect(() => {
    let isMounted = true;
    const pollServer = async () => {
      const data = await fetchServerData();
      if (!isMounted || !data) return;

      setMembers((prevMembers) => {
        if (JSON.stringify(prevMembers) !== JSON.stringify(data.members)) {
          // If a new member registered remotely
          if (data.members.length > prevMembers.length) {
            const newest = data.members[data.members.length - 1];
            setRemoteNotification({
              name: newest.name,
              voice: newest.voice,
              status: 'Terdaftar & Hadir',
              isNew: true,
            });
            setTimeout(() => setRemoteNotification(null), 5000);
          }
          saveStoredMembers(data.members, false);
          return data.members;
        }
        return prevMembers;
      });

      setSessions((prevSessions) => {
        if (JSON.stringify(prevSessions) !== JSON.stringify(data.sessions)) {
          saveStoredSessions(data.sessions, false);
          return data.sessions;
        }
        return prevSessions;
      });

      if (data.logs) {
        setLogs(data.logs);
      }
    };

    pollServer();
    const interval = setInterval(pollServer, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Update member
  const handleUpdateMember = (updated: Member) => {
    pushUndoSnapshot();
    setSyncStatus('syncing');

    const nextMembers = members.map((m) => (m.id === updated.id ? updated : m));
    setMembers(nextMembers);
    saveStoredMembers(nextMembers);

    appendActivityLog('Edit Anggota', `${updated.name} (${updated.voice}) diperbarui.`);
    setLogs(getStoredLogs());

    setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 400);

    // Auto-sync push to Google Sheets if configured
    triggerAutoCloudSync(nextMembers, sessions);
  };

  // Add member
  const handleAddMember = (newMember: Member) => {
    pushUndoSnapshot();
    setSyncStatus('syncing');

    const nextMembers = [...members, newMember];
    setMembers(nextMembers);
    saveStoredMembers(nextMembers);

    // Also initialize member in all existing sessions
    const nextSessions = sessions.map((s) => ({
      ...s,
      records: {
        ...s.records,
        [newMember.id]: { memberId: newMember.id, status: 'Belum' as AttendanceStatus },
      },
    }));
    setSessions(nextSessions);
    saveStoredSessions(nextSessions);

    appendActivityLog('Tambah Anggota', `Anggota baru ${newMember.name} (${newMember.voice}) ditambahkan.`);
    setLogs(getStoredLogs());

    setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 400);

    triggerAutoCloudSync(nextMembers, nextSessions);
  };

  // Delete members
  const handleDeleteMembers = (ids: string[]) => {
    pushUndoSnapshot();
    setSyncStatus('syncing');

    const nextMembers = members.filter((m) => !ids.includes(m.id));
    setMembers(nextMembers);
    saveStoredMembers(nextMembers);
    deleteMembersFromFirestore(ids).catch((err) => console.warn('Failed deleting from Firestore:', err));

    appendActivityLog('Hapus Anggota', `${ids.length} anggota dihapus.`);
    setLogs(getStoredLogs());

    setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 400);

    triggerAutoCloudSync(nextMembers, sessions);
  };

  // Update session attendance record
  const handleUpdateSessionRecord = (
    sessionId: string,
    memberId: string,
    status: AttendanceStatus,
    note?: string
  ) => {
    pushUndoSnapshot();
    setSyncStatus('syncing');

    const memberName = members.find((m) => m.id === memberId)?.name || memberId;
    const nextSessions = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        records: {
          ...s.records,
          [memberId]: {
            memberId,
            status,
            note: note !== undefined ? note : s.records[memberId]?.note,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });

    setSessions(nextSessions);
    saveStoredSessions(nextSessions);

    appendActivityLog('Absensi', `${memberName} status diubah menjadi "${status}".`);
    setLogs(getStoredLogs());

    setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 300);

    triggerAutoCloudSync(members, nextSessions);
  };

  // Add session
  const handleAddSession = (newSession: AttendanceSession) => {
    pushUndoSnapshot();
    setSyncStatus('syncing');

    const nextSessions = [...sessions, newSession];
    setSessions(nextSessions);
    saveStoredSessions(nextSessions);
    saveSessionToFirestore(newSession).catch((err) => console.warn('Failed saving session to Firestore:', err));

    appendActivityLog('Tambah Jadwal', `Sesi latihan tanggal ${newSession.date} ("${newSession.title}") dibuat.`);
    setLogs(getStoredLogs());

    setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 400);

    triggerAutoCloudSync(members, nextSessions);
  };

  // Delete session
  const handleDeleteSession = (sessionId: string) => {
    pushUndoSnapshot();
    setSyncStatus('syncing');

    const target = sessions.find((s) => s.id === sessionId);
    const nextSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(nextSessions);
    saveStoredSessions(nextSessions);
    deleteSessionFromFirestore(sessionId).catch((err) => console.warn('Failed deleting session from Firestore:', err));

    appendActivityLog('Hapus Jadwal', `Sesi latihan tanggal ${target?.date || ''} dihapus.`);
    setLogs(getStoredLogs());

    setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 400);

    triggerAutoCloudSync(members, nextSessions);
  };

  // Mark all present for session
  const handleMarkAllPresent = (sessionId: string) => {
    pushUndoSnapshot();
    setSyncStatus('syncing');

    const target = sessions.find((s) => s.id === sessionId);
    const nextSessions = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      const updatedRecords = { ...s.records };
      members.forEach((m) => {
        updatedRecords[m.id] = {
          memberId: m.id,
          status: 'Hadir',
          note: s.records[m.id]?.note,
        };
      });
      return {
        ...s,
        records: updatedRecords,
      };
    });

    setSessions(nextSessions);
    saveStoredSessions(nextSessions);

    appendActivityLog('Tandai Hadir', `Semua anggota ditandai Hadir pada sesi ${target?.date}.`);
    setLogs(getStoredLogs());

    setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 400);

    triggerAutoCloudSync(members, nextSessions);
  };

  // Update existing session (e.g. passcode or details)
  const handleUpdateSession = (updated: AttendanceSession) => {
    pushUndoSnapshot();
    setSyncStatus('syncing');

    const nextSessions = sessions.map((s) => (s.id === updated.id ? updated : s));
    setSessions(nextSessions);
    saveStoredSessions(nextSessions);

    appendActivityLog('Update Sesi', `Sesi ${updated.date} (${updated.title}) diperbarui.`);
    setLogs(getStoredLogs());

    setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 400);

    triggerAutoCloudSync(members, nextSessions);
  };

  // Import members
  const handleImportMembers = (imported: Member[]) => {
    pushUndoSnapshot();
    setSyncStatus('syncing');

    // Merge or replace based on ID
    const memberMap = new Map<string, Member>();
    members.forEach((m) => memberMap.set(m.id, m));
    imported.forEach((m) => memberMap.set(m.id, m));

    const merged = Array.from(memberMap.values());
    setMembers(merged);
    saveStoredMembers(merged);

    appendActivityLog('Impor Data', `${imported.length} data anggota diimpor.`);
    setLogs(getStoredLogs());

    setTimeout(() => {
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 400);

    triggerAutoCloudSync(merged, sessions);
  };

  // Reset to default dataset from attachment file
  const handleResetToDefault = () => {
    pushUndoSnapshot();
    setMembers(INITIAL_MEMBERS);
    setSessions(INITIAL_SESSIONS);
    saveStoredMembers(INITIAL_MEMBERS);
    saveStoredSessions(INITIAL_SESSIONS);

    appendActivityLog('Reset Database', 'Data dikembalikan ke dataset awal file Database_Absensi_Koor.');
    setLogs(getStoredLogs());
  };

  // Google Sheets Push & Pull
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const cloudSyncTimeoutRef = useRef<any>(null);
  const triggerAutoCloudSync = (currentMembers: Member[], currentSessions: AttendanceSession[]) => {
    if (!config.autoSync || (!config.sheetId && !config.webhookUrl)) return;

    if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
    cloudSyncTimeoutRef.current = setTimeout(() => {
      handleCloudPush(currentMembers, currentSessions);
    }, 2000); // 2 second debounce
  };

  const handleCloudPush = async (
    targetMembers = members,
    targetSessions = sessions
  ): Promise<void> => {
    const token = getAccessToken();
    if (!config.sheetId && !config.webhookUrl) {
      throw new Error('Belum ada Google Sheets yang terhubung.');
    }

    setIsCloudSyncing(true);
    setSyncStatus('syncing');

    try {
      // 1. Direct native Google Sheets API push if sheetId & token are available
      if (config.sheetId && token) {
        await pushDataToGoogleSheets(config.sheetId, token, targetMembers, targetSessions);
      }

      // 2. Apps Script webhook if configured
      if (config.webhookUrl) {
        await fetch(config.webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            members: targetMembers,
            sessions: targetSessions,
            sheetName: config.sheetName,
            client: getClientName(),
            timestamp: new Date().toISOString(),
          }),
        });
      }

      appendActivityLog('Sinkronisasi Google Sheets', 'Pembaruan otomatis dikirim ke Google Sheets.');
      setLogs(getStoredLogs());
      setSyncStatus('synced');
      setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error('Google Sheets Push Error:', err);
      setSyncStatus('error');
      throw new Error('Gagal menyinkronkan ke Google Sheets: ' + (err.message || 'Error koneksi'));
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleCloudPull = async (): Promise<void> => {
    if (!config.webhookUrl) {
      throw new Error('Masukkan Webhook URL Google Sheets terlebih dahulu.');
    }

    setIsCloudSyncing(true);
    setSyncStatus('syncing');

    try {
      const url = new URL(config.webhookUrl);
      url.searchParams.set('action', 'getAll');
      url.searchParams.set('sheet', config.sheetName || 'Database_Absensi_Koor');

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data && data.members && Array.isArray(data.members) && data.members.length > 0) {
        handleImportMembers(data.members);
      } else {
        throw new Error('Tidak ada data anggota ditemukan pada Google Sheet tersebut.');
      }
    } catch (err: any) {
      console.error('Google Sheets Pull Error:', err);
      setSyncStatus('error');
      throw new Error('Gagal menarik data dari Google Sheets: ' + (err.message || 'Pastikan script sudah di-deploy'));
    } finally {
      setIsCloudSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Toast Notification Banner */}
      {toastBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-sm font-semibold animate-fade-in">
          <span>{toastBanner}</span>
          <button
            type="button"
            onClick={() => setToastBanner(null)}
            className="text-slate-400 hover:text-white ml-2 p-1 rounded-md hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Remote Notification Toast when member submits attendance on phone */}
      {remoteNotification && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-start gap-3 max-w-sm animate-bounce">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-slate-100 flex items-center gap-1.5">
              <span>Absensi Baru Masuk!</span>
              {remoteNotification.isNew && (
                <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.2 rounded-full font-extrabold">
                  BARU
                </span>
              )}
            </p>
            <p className="text-slate-300 mt-0.5">
              <strong className="text-white">{remoteNotification.name}</strong> ({remoteNotification.voice}) mengisi: <span className="text-emerald-400 font-bold">{remoteNotification.status}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRemoteNotification(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* If current view is the dedicated Member Self-Attendance Portal */}
      {currentView === 'member-portal' ? (
        <MemberAttendancePortal
          members={members}
          sessions={sessions}
          initialSessionId={initialSessionId}
          isAdmin={isAdmin}
          onSwitchToAdmin={() => {
            if (isAdmin) {
              setCurrentView('sheet');
            } else {
              setIsAdminLoginModalOpen(true);
            }
          }}
          onOpenSchedule={() => setCurrentView('member-schedule')}
          onAttendanceSubmitted={(res) => {
            setLastSavedText(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
          }}
        />
      ) : (
        <>
          {/* Top Header */}
          <Header
            currentView={currentView}
            onViewChange={handleViewChange}
            isAdmin={isAdmin}
            onOpenAdminLoginModal={() => setIsAdminLoginModalOpen(true)}
            onLogoutAdmin={handleAdminLogout}
            onOpenPinSettingsModal={() => setIsPinSettingsModalOpen(true)}
            syncStatus={syncStatus}
            lastSavedText={lastSavedText}
            activeUsersCount={activeUsersCount}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
            onOpenLogsModal={() => setIsLogsModalOpen(true)}
            onOpenAddMemberModal={() => {
              setEditingMember(null);
              setIsMemberModalOpen(true);
            }}
            onOpenShareModal={() => {
              setShareModalSessionId(undefined);
              setIsShareModalOpen(true);
            }}
            isCloudConfigured={Boolean(config.sheetId || config.webhookUrl)}
          />

          {/* Main View Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-16">
            {/* Guard against direct access to admin views without authentication */}
            {!isAdmin && ['sheet', 'attendance', 'stats', 'whatsapp'].includes(currentView) && (
              <div className="bg-white rounded-3xl p-8 max-w-md mx-auto text-center border border-slate-200/80 shadow-md my-12">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200/60 shadow-inner">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Akses Terkunci</h3>
                <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                  Bagian ini khusus untuk Pengurus & Developer Paduan Suara. Masukkan PIN Pengurus untuk mengelola data dan konfigurasi.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                  <button
                    type="button"
                    onClick={() => setIsAdminLoginModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    Masukkan PIN Pengurus
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('member-portal')}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all"
                  >
                    Kembali ke Absensi Mandiri
                  </button>
                </div>
              </div>
            )}

            {currentView === 'member-schedule' && (
              <MemberScheduleView
                sessions={sessions}
                members={members}
                onOpenSelfAttendance={(sessionId) => {
                  if (sessionId) setInitialSessionId(sessionId);
                  setCurrentView('member-portal');
                }}
                onOpenSessionQR={(sessionId) => {
                  setShareModalSessionId(sessionId);
                  setIsShareModalOpen(true);
                }}
              />
            )}

            {isAdmin && currentView === 'sheet' && (
              <SpreadsheetView
                members={members}
                onUpdateMember={handleUpdateMember}
                onAddMember={handleAddMember}
                onDeleteMembers={handleDeleteMembers}
                onOpenEditModal={(m) => {
                  setEditingMember(m || null);
                  setIsMemberModalOpen(true);
                }}
                onSelectForBroadcast={(selected) => {
                  setPreselectedBroadcast(selected);
                  setCurrentView('whatsapp');
                }}
              />
            )}

            {isAdmin && currentView === 'attendance' && (
              <AttendanceMatrixView
                members={members}
                sessions={sessions}
                onUpdateSessionRecord={handleUpdateSessionRecord}
                onAddSession={handleAddSession}
                onDeleteSession={handleDeleteSession}
                onMarkAllPresent={handleMarkAllPresent}
                onOpenShareModal={(sId) => {
                  setShareModalSessionId(sId);
                  setIsShareModalOpen(true);
                }}
              />
            )}

            {isAdmin && currentView === 'stats' && (
              <StatsView members={members} sessions={sessions} />
            )}

            {isAdmin && currentView === 'whatsapp' && (
              <WhatsAppSenderView
                members={members}
                preselectedPhones={preselectedBroadcast}
              />
            )}
          </main>

          {/* Footer Info */}
          <footer className="bg-white border-t border-slate-200/80 py-3 text-center text-xs text-slate-400">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-slate-600">
                  {isAdmin ? 'Mode Developer / Pengurus Aktif' : 'Portal Anggota Paduan Suara'}
                </span>
                <span>• Sinkronisasi Real-Time</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {isAdmin ? (
                  <span>Database: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">Database_Absensi_Koor_4ad61b53</code></span>
                ) : (
                  <span>Hubungi Pengurus jika ada kendala data absensi</span>
                )}
              </div>
            </div>
          </footer>
        </>
      )}

      {/* Modals */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />

      <AdminPinSettingsModal
        isOpen={isPinSettingsModalOpen}
        onClose={() => setIsPinSettingsModalOpen(false)}
      />

      <MemberEditModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSave={(saved) => {
          if (editingMember) {
            handleUpdateMember(saved);
          } else {
            handleAddMember(saved);
          }
        }}
        initialData={editingMember}
        existingIds={members.map((m) => m.id)}
      />

      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        config={config}
        onSaveConfig={(newCfg) => {
          setConfig(newCfg);
          saveStoredConfig(newCfg);
        }}
        members={members}
        sessions={sessions}
        onImportMembers={handleImportMembers}
        onResetToDefault={handleResetToDefault}
        onSyncPush={handleCloudPush}
        onSyncPull={handleCloudPull}
        isSyncing={isCloudSyncing}
      />

      <ActivityLogModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        logs={logs}
        onClearLogs={() => {
          localStorage.removeItem('koor_activity_logs_v1');
          setLogs([]);
        }}
      />

      <ShareAttendanceModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        sessions={sessions}
        currentSessionId={shareModalSessionId}
        onUpdateSession={handleUpdateSession}
        onOpenMobilePreview={() => {
          setIsShareModalOpen(false);
          setCurrentView('member-portal');
        }}
      />
    </div>
  );
}
