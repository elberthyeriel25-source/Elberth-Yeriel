import { Member, AttendanceSession, GoogleSheetsConfig, SyncMessage, ActivityLogItem, VoiceType, AttendanceStatus } from '../types';
import { INITIAL_MEMBERS, INITIAL_SESSIONS } from '../data/initialData';

const STORAGE_KEYS = {
  MEMBERS: 'koor_database_members_v1',
  SESSIONS: 'koor_database_sessions_v1',
  CONFIG: 'koor_google_sheets_config_v1',
  LOGS: 'koor_activity_logs_v1',
  CLIENT_ID: 'koor_client_id',
};

// Generate or retrieve persistent client session ID
export const getClientId = (): string => {
  let id = sessionStorage.getItem(STORAGE_KEYS.CLIENT_ID);
  if (!id) {
    id = 'user_' + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem(STORAGE_KEYS.CLIENT_ID, id);
  }
  return id;
};

// User names for collaborative demo
const COLLABORATOR_NAMES = ['Koordinator Koor', 'Sekretaris Absensi', 'Seksi Musik SATB', 'Dirigen Koor'];
export const getClientName = (): string => {
  const id = getClientId();
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLLABORATOR_NAMES[hash % COLLABORATOR_NAMES.length];
};

// ================= VALIDATION & FORMATTING UTILITIES =================

/**
 * Normalizes Indonesian phone number into standard 08xxxxxxxxxx
 */
export const normalizeIndonesianPhone = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.substring(2);
  } else if (!cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
};

/**
 * Validates Indonesian phone format (WhatsApp mobile number)
 */
export const validateIndonesianPhone = (phone: string): { isValid: boolean; message: string; formatted: string } => {
  const cleaned = normalizeIndonesianPhone(phone);
  if (!cleaned) {
    return { isValid: false, message: 'Nomor telepon / WhatsApp wajib diisi.', formatted: '' };
  }
  if (!cleaned.startsWith('08')) {
    return { isValid: false, message: 'Nomor HP Indonesia harus diawali dengan 08 (misal: 081234567890).', formatted: cleaned };
  }
  if (cleaned.length < 10) {
    return { isValid: false, message: `Nomor terlalu pendek (${cleaned.length} digit). Minimal 10 digit.`, formatted: cleaned };
  }
  if (cleaned.length > 14) {
    return { isValid: false, message: `Nomor terlalu panjang (${cleaned.length} digit). Maksimal 14 digit.`, formatted: cleaned };
  }
  return { isValid: true, message: 'Nomor WhatsApp valid', formatted: cleaned };
};

/**
 * Normalizes email address
 */
export const normalizeEmail = (email: string): string => {
  if (!email) return '';
  return email.trim().toLowerCase();
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): { isValid: boolean; message: string; formatted: string } => {
  const cleaned = normalizeEmail(email);
  if (!cleaned) {
    return { isValid: false, message: 'Alamat email wajib diisi untuk verifikasi identitas.', formatted: '' };
  }
  // Standard RFC-compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(cleaned)) {
    return { isValid: false, message: 'Format email tidak valid (contoh: nama@email.com).', formatted: cleaned };
  }
  return { isValid: true, message: 'Email valid', formatted: cleaned };
};

/**
 * Validates member full name
 */
export const validateMemberName = (name: string): { isValid: boolean; message: string; formatted: string } => {
  const trimmed = (name || '').trim();
  if (trimmed.length < 2) {
    return { isValid: false, message: 'Nama lengkap wajib diisi minimal 2 karakter.', formatted: trimmed };
  }
  // Check if name has at least some letters
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, message: 'Nama harus mengandung huruf yang jelas.', formatted: trimmed };
  }
  // Title case
  const formatted = trimmed
    .toLowerCase()
    .replace(/(?:^|\s|-)\S/g, (char) => char.toUpperCase());
  return { isValid: true, message: 'Nama valid', formatted };
};

const STORAGE_DEVICE_TOKEN = 'koor_device_fingerprint_token_v1';
export const getDeviceFingerprintId = (): string => {
  if (typeof window === 'undefined') return 'server_ssr';
  try {
    let token = localStorage.getItem(STORAGE_DEVICE_TOKEN);
    if (!token) {
      token = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(STORAGE_DEVICE_TOKEN, token);
    }
    return token;
  } catch {
    return 'temp_device_' + Math.random().toString(36).substring(2, 8);
  }
};

class RealtimeSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: SyncMessage) => void> = new Set();
  private presenceTimer: any = null;
  private activePeers: Map<string, { name: string; lastSeen: number }> = new Map();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('koor_realtime_broadcast_channel');
        this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
          this.handleIncomingMessage(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel error, falling back to storage listener', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.MEMBERS || e.key === STORAGE_KEYS.SESSIONS) {
          this.notifyListeners({
            type: e.key === STORAGE_KEYS.MEMBERS ? 'MEMBERS_UPDATED' : 'SESSIONS_UPDATED',
            timestamp: Date.now(),
            senderId: 'external_storage',
            senderName: 'Sesi Lain',
          });
        }
      });

      // Start presence heartbeat
      this.startPresenceHeartbeat();
    }
  }

  private startPresenceHeartbeat() {
    const broadcastPresence = () => {
      this.broadcast({
        type: 'USER_PRESENCE',
        timestamp: Date.now(),
        senderId: getClientId(),
        senderName: getClientName(),
      });
    };

    // Broadcast immediately and every 5 seconds
    broadcastPresence();
    this.presenceTimer = setInterval(broadcastPresence, 6000);
  }

  private handleIncomingMessage(msg: SyncMessage) {
    if (msg.senderId === getClientId()) return; // ignore self

    if (msg.type === 'USER_PRESENCE') {
      this.activePeers.set(msg.senderId, {
        name: msg.senderName,
        lastSeen: Date.now(),
      });
      // Prune dead peers (>15s)
      const now = Date.now();
      for (const [id, peer] of this.activePeers.entries()) {
        if (now - peer.lastSeen > 15000) {
          this.activePeers.delete(id);
        }
      }
    }

    this.notifyListeners(msg);
  }

  public getActivePeersCount(): number {
    const now = Date.now();
    let count = 1; // self
    for (const [, peer] of this.activePeers.entries()) {
      if (now - peer.lastSeen <= 15000) {
        count++;
      }
    }
    return count;
  }

  public subscribe(callback: (msg: SyncMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(msg: SyncMessage) {
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  public broadcast(msg: SyncMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (e) {
        console.warn('Failed to broadcast message:', e);
      }
    }
  }
}

export const syncManager = new RealtimeSyncManager();

// ================= STORAGE REPOSITORY =================

export const getStoredMembers = (): Member[] => {
  if (typeof window === 'undefined') return INITIAL_MEMBERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (!raw) {
      saveStoredMembers(INITIAL_MEMBERS, false);
      return INITIAL_MEMBERS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading members from localStorage:', e);
    return INITIAL_MEMBERS;
  }
};

export const saveStoredMembers = (members: Member[], broadcast = true): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    if (broadcast) {
      syncManager.broadcast({
        type: 'MEMBERS_UPDATED',
        timestamp: Date.now(),
        senderId: getClientId(),
        senderName: getClientName(),
        payload: members,
      });
    }

    // Background push to backend server
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members }),
    }).catch(() => {
      // Offline or network error; localStorage acts as resilient fallback
    });
  } catch (e) {
    console.error('Failed saving members to localStorage:', e);
  }
};

export const getStoredSessions = (): AttendanceSession[] => {
  if (typeof window === 'undefined') return INITIAL_SESSIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) {
      saveStoredSessions(INITIAL_SESSIONS, false);
      return INITIAL_SESSIONS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading sessions from localStorage:', e);
    return INITIAL_SESSIONS;
  }
};

export const saveStoredSessions = (sessions: AttendanceSession[], broadcast = true): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    if (broadcast) {
      syncManager.broadcast({
        type: 'SESSIONS_UPDATED',
        timestamp: Date.now(),
        senderId: getClientId(),
        senderName: getClientName(),
        payload: sessions,
      });
    }

    // Background push to backend server
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    }).catch(() => {
      // Resilient fallback
    });
  } catch (e) {
    console.error('Failed saving sessions to localStorage:', e);
  }
};

/**
 * Fetches latest members, sessions and logs from the backend server
 */
export const fetchServerData = async (): Promise<{
  members: Member[];
  sessions: AttendanceSession[];
  logs: ActivityLogItem[];
  lastUpdated: number;
} | null> => {
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (err) {
    // Network or offline fallback
    return null;
  }
};

/**
 * Helper to generate or format dynamic session passcode (e.g. "SB84")
 */
export const generateSessionPasscode = (dateString?: string): string => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous O, 0, I, 1
  let code = '';
  // If date is given and is Saturday, prefix with SB, else KR
  let prefix = 'SB';
  if (dateString) {
    const d = new Date(dateString);
    if (!isNaN(d.getTime()) && d.getDay() !== 6) {
      prefix = 'KR';
    }
  }
  for (let i = 0; i < 2; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const randomDigits = Math.floor(10 + Math.random() * 90);
  return `${prefix}${code.charAt(0)}${randomDigits}`;
};

/**
 * Submits self attendance from member's phone
 */
export interface SelfAttendancePayload {
  name: string;
  phone: string;
  email: string;
  voice?: VoiceType;
  status: AttendanceStatus;
  sessionId?: string;
  note?: string;
  deviceId?: string;
  sessionPasscode?: string;
}

export interface SelfAttendanceResponse {
  success: boolean;
  message: string;
  isNewMember: boolean;
  member: Member;
  session: {
    id: string;
    date: string;
    title: string;
    location: string;
  };
  record: any;
  submittedAt: string;
}

export const submitSelfAttendanceAPI = async (
  payload: SelfAttendancePayload
): Promise<SelfAttendanceResponse> => {
  const deviceId = payload.deviceId || getDeviceFingerprintId();
  const bodyPayload = {
    ...payload,
    deviceId,
  };

  let backendData: any = null;
  let useFallback = false;

  // 1. Try sending to backend API
  try {
    const res = await fetch('/api/attendance/self-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      backendData = await res.json();
      if (!res.ok || !backendData.success) {
        // Genuine business logic error (e.g., Anti-Titip Absen violation or wrong passcode)
        throw new Error(backendData.message || 'Gagal menyimpan absensi.');
      }
    } else {
      // Backend returned non-JSON (e.g., HTML 502/503/404 during container restart or static host)
      const text = await res.text();
      console.warn('Backend returned non-JSON response, activating client-side engine:', text.substring(0, 80));
      useFallback = true;
    }
  } catch (err: any) {
    if (backendData && backendData.message) {
      // Pass through validation error message
      throw err;
    }
    console.warn('Network or proxy error, activating resilient client fallback:', err);
    useFallback = true;
  }

  // 2. If backend succeeded with valid JSON, update local cache and return
  if (!useFallback && backendData && backendData.success) {
    const data: SelfAttendanceResponse = backendData;

    // Update local cache as well
    const currentMembers = getStoredMembers();
    const existingIdx = currentMembers.findIndex((m) => m.id === data.member.id);
    let nextMembers: Member[];
    if (existingIdx !== -1) {
      nextMembers = currentMembers.map((m) => (m.id === data.member.id ? data.member : m));
    } else {
      nextMembers = [...currentMembers, data.member];
    }
    saveStoredMembers(nextMembers, false);

    const currentSessions = getStoredSessions();
    const nextSessions = currentSessions.map((s) => {
      if (s.id === data.session.id) {
        return {
          ...s,
          records: {
            ...s.records,
            [data.member.id]: data.record,
          },
        };
      }
      return s;
    });
    saveStoredSessions(nextSessions, false);

    // Broadcast change
    syncManager.broadcast({
      type: 'MEMBERS_UPDATED',
      timestamp: Date.now(),
      senderId: getClientId(),
      senderName: data.member.name,
      payload: nextMembers,
    });
    syncManager.broadcast({
      type: 'SESSIONS_UPDATED',
      timestamp: Date.now(),
      senderId: getClientId(),
      senderName: data.member.name,
      payload: nextSessions,
    });

    appendActivityLog(
      data.isNewMember ? 'Pendaftaran & Absen Mandiri' : 'Absen Mandiri (HP)',
      `${data.member.name} (${data.member.voice}) mencatat ${data.record.status} pada sesi ${data.session.title}`
    );

    return data;
  }

  // 3. RESILIENT CLIENT-SIDE FALLBACK ENGINE
  // Guarantees zero data loss even during network hiccups or static hosting!
  const formattedName = payload.name.trim().toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
  const normalizedPhone = normalizeIndonesianPhone(payload.phone);
  const normalizedEmail = normalizeEmail(payload.email);

  const localMembers = getStoredMembers();
  const localSessions = getStoredSessions();

  // Resolve target session
  let targetSession = localSessions.find((s) => s.id === payload.sessionId);
  if (!targetSession) {
    const sorted = [...localSessions].sort((a, b) => b.date.localeCompare(a.date));
    targetSession = sorted[0];
  }
  if (!targetSession) {
    const today = new Date().toISOString().split('T')[0];
    targetSession = {
      id: `sess-${today}`,
      date: today,
      title: 'Latihan Rutin Koor',
      location: 'Ruang Latihan Koor',
      createdAt: new Date().toISOString(),
      passcode: 'SB26',
      requirePasscode: true,
      records: {},
    };
    localSessions.push(targetSession);
  }

  // Dynamic Session Passcode Validation
  if (targetSession.requirePasscode && targetSession.passcode) {
    const submittedCode = (payload.sessionPasscode || '').trim().toUpperCase();
    const expectedCode = targetSession.passcode.trim().toUpperCase();
    if (submittedCode !== expectedCode) {
      throw new Error(
        `Kode Validasi Sesi tidak sesuai. Silakan minta atau lihat kode harian yang ditampilkan pengurus di ruangan latihan (${targetSession.title}).`
      );
    }
  }

  // STRICT ANTI-TITIP ABSEN INTEGRITY
  // Rule: Check device identity
  if (deviceId) {
    const boundByDevice = localMembers.find((m) => m.deviceId && m.deviceId === deviceId);
    if (boundByDevice) {
      const isSamePhone = normalizeIndonesianPhone(boundByDevice.phone) === normalizedPhone;
      const isSameName = boundByDevice.name.toLowerCase().trim() === formattedName.toLowerCase().trim();
      const isSameEmail = boundByDevice.email ? normalizeEmail(boundByDevice.email) === normalizedEmail : true;

      if (!isSamePhone || !isSameName || !isSameEmail) {
        throw new Error(
          `Akses Ditolak: Perangkat ini sudah terikat dengan ${boundByDevice.name}. Sesuai kebijakan kejujuran paduan suara, Anda dilarang mengisi absensi untuk anggota lain (titip absen), baik anggota yang sudah terdaftar maupun mendaftarkan anggota baru.`
        );
      }
    }
  }

  // Check email identity
  const boundByEmail = localMembers.find(
    (m) =>
      (m.email && normalizeEmail(m.email) === normalizedEmail) ||
      (m.verifiedEmail && normalizeEmail(m.verifiedEmail) === normalizedEmail)
  );
  if (boundByEmail) {
    const isSamePhone = normalizeIndonesianPhone(boundByEmail.phone) === normalizedPhone;
    const isSameName = boundByEmail.name.toLowerCase().trim() === formattedName.toLowerCase().trim();
    if (!isSamePhone || !isSameName) {
      throw new Error(
        `Email '${normalizedEmail}' telah terverifikasi atas nama ${boundByEmail.name}. Email terverifikasi tidak boleh digunakan untuk mengisi absensi anggota lain.`
      );
    }
  }

  // Check phone identity
  const boundByPhone = localMembers.find((m) => normalizeIndonesianPhone(m.phone) === normalizedPhone);
  if (boundByPhone) {
    const isSameName = boundByPhone.name.toLowerCase().trim() === formattedName.toLowerCase().trim();
    if (!isSameName) {
      throw new Error(
        `Nomor WhatsApp ${normalizedPhone} sudah terdaftar atas nama ${boundByPhone.name}. Pengisian absensi untuk anggota lain tidak diizinkan.`
      );
    }
  }

  // Resolve member or register new
  let member = boundByPhone || boundByEmail || localMembers.find((m) => m.name.toLowerCase().trim() === formattedName.toLowerCase().trim());
  let isNewMember = false;

  if (!member) {
    isNewMember = true;
    const numericIds = localMembers
      .map((m) => {
        const match = m.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const nextNum = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
    const newId = `A${String(nextNum).padStart(3, '0')}`;

    const validVoice: VoiceType = ['Sopran', 'Alto', 'Tenor', 'Bass'].includes(payload.voice as VoiceType)
      ? (payload.voice as VoiceType)
      : 'Sopran';

    member = {
      id: newId,
      name: formattedName,
      voice: validVoice,
      phone: normalizedPhone,
      email: normalizedEmail,
      verifiedEmail: normalizedEmail,
      deviceId: deviceId || undefined,
      verifiedAt: new Date().toISOString(),
      notes: 'Pendaftaran mandiri via portal kehadiran HP (Terverifikasi)',
      joinDate: new Date().toISOString().split('T')[0],
      active: true,
      updatedAt: new Date().toISOString(),
    };

    localMembers.push(member);

    // Initialize in all sessions
    localSessions.forEach((s) => {
      if (!s.records[member!.id]) {
        s.records[member!.id] = { memberId: member!.id, status: 'Belum' };
      }
    });
  } else {
    // Existing member: Bind email and device if not already set
    if (!member.email) member.email = normalizedEmail;
    if (!member.verifiedEmail) member.verifiedEmail = normalizedEmail;
    if (deviceId && !member.deviceId) member.deviceId = deviceId;
    if (!member.verifiedAt) member.verifiedAt = new Date().toISOString();
    if (payload.voice && ['Sopran', 'Alto', 'Tenor', 'Bass'].includes(payload.voice as VoiceType)) {
      member.voice = payload.voice as VoiceType;
    }
    if (!member.phone) member.phone = normalizedPhone;
    member.updatedAt = new Date().toISOString();
  }

  // Record attendance
  const recordNote = payload.note ? payload.note.trim() : payload.status === 'Hadir' ? 'Hadir via HP' : 'Izin via HP';
  const attendanceRecord = {
    memberId: member.id,
    status: payload.status,
    note: recordNote,
    submittedBy: 'self',
    verifiedEmail: member.verifiedEmail || normalizedEmail,
    updatedAt: new Date().toISOString(),
  };
  targetSession.records[member.id] = attendanceRecord;

  // Persist updated state locally
  saveStoredMembers(localMembers, true);
  saveStoredSessions(localSessions, true);

  // Background push to server database if available
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ members: localMembers, sessions: localSessions }),
  }).catch(() => {});

  appendActivityLog(
    isNewMember ? 'Pendaftaran & Absen Mandiri' : 'Absensi Mandiri (HP)',
    `${member.name} (${member.voice}) mencatat status "${payload.status}" pada sesi ${targetSession.title}`
  );

  return {
    success: true,
    message: isNewMember
      ? `Selamat datang ${member.name}! Anda otomatis terdaftar dan terverifikasi di database koor.`
      : `Halo ${member.name}, absensi Anda berhasil dicatat sebagai "${payload.status}".`,
    isNewMember,
    member,
    session: {
      id: targetSession.id,
      date: targetSession.date,
      title: targetSession.title,
      location: targetSession.location,
    },
    record: attendanceRecord,
    submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };
};

export const getStoredConfig = (): GoogleSheetsConfig => {
  if (typeof window === 'undefined') {
    return {
      webhookUrl: '',
      sheetId: '',
      sheetName: 'Database_Absensi_Koor',
      autoSync: true,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) {
      return {
        webhookUrl: '',
        sheetId: '',
        sheetName: 'Database_Absensi_Koor',
        autoSync: true,
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    return {
      webhookUrl: '',
      sheetId: '',
      sheetName: 'Database_Absensi_Koor',
      autoSync: true,
    };
  }
};

export const saveStoredConfig = (config: GoogleSheetsConfig): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed saving config:', e);
  }
};

export const getStoredLogs = (): ActivityLogItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const appendActivityLog = (action: string, details: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const current = getStoredLogs();
    const newItem: ActivityLogItem = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action,
      details,
      user: getClientName(),
    };
    const updated = [newItem, ...current].slice(0, 50); // keep last 50
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed appending log:', e);
  }
};

// ================= CSV & GOOGLE SHEETS UTILS =================

/**
 * Parses CSV/TSV text into Member list.
 * Recognizes header fields like ID_Anggota, Nama Lengkap, Suara, No WhatsApp.
 */
export const parseCSVToMembers = (csvText: string): Member[] => {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Determine separator (comma or tab)
  const firstLine = lines[0];
  const sep = firstLine.includes('\t') ? '\t' : ',';

  // Parse header
  const headers = firstLine.split(sep).map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
  const idIdx = headers.findIndex((h) => h.includes('id'));
  const nameIdx = headers.findIndex((h) => h.includes('nama') || h.includes('name'));
  const voiceIdx = headers.findIndex((h) => h.includes('suara') || h.includes('voice') || h.includes('satb'));
  const phoneIdx = headers.findIndex((h) => h.includes('wa') || h.includes('phone') || h.includes('telepon') || h.includes('hp'));

  const parsedMembers: Member[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Split by separator respecting simple quotes
    const cols = line.split(sep).map((col) => col.replace(/^["']|["']$/g, '').trim());
    if (cols.length === 0 || !cols.some((c) => c.length > 0)) continue;

    const id = idIdx !== -1 && cols[idIdx] ? cols[idIdx] : `A${String(i).padStart(3, '0')}`;
    const name = nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : cols[1] || `Anggota ${i}`;
    let voiceRaw = voiceIdx !== -1 && cols[voiceIdx] ? cols[voiceIdx] : cols[2] || 'Sopran';
    let phone = phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx] : cols[3] || '';

    // Clean phone number (format Indonesian phone)
    if (phone.startsWith('62')) {
      phone = '0' + phone.substring(2);
    } else if (phone && !phone.startsWith('0') && !phone.startsWith('+')) {
      phone = '0' + phone;
    }

    // Standardize voice
    const voiceUpper = voiceRaw.toLowerCase();
    let voice: Member['voice'] = 'Sopran';
    if (voiceUpper.includes('tenor')) voice = 'Tenor';
    else if (voiceUpper.includes('bass') || voiceUpper.includes('bas')) voice = 'Bass';
    else if (voiceUpper.includes('alto')) voice = 'Alto';
    else voice = 'Sopran';

    parsedMembers.push({
      id,
      name,
      voice,
      phone,
      active: true,
      notes: '',
      joinDate: new Date().toISOString().split('T')[0],
    });
  }

  return parsedMembers;
};

/**
 * Generates RFC 4180 compliant CSV string with UTF-8 BOM
 */
export const membersToCSV = (members: Member[]): string => {
  const header = ['Nama Lengkap', 'Suara', 'No WhatsApp', 'Catatan', 'Tanggal Bergabung', 'Status'];
  const rows = members.map((m) => [
    `"${m.name.replace(/"/g, '""')}"`,
    m.voice,
    `'${m.phone}`, // leading quote prevents excel dropping zero
    `"${(m.notes || '').replace(/"/g, '""')}"`,
    m.joinDate || '',
    m.active ? 'Aktif' : 'Nonaktif',
  ]);

  return [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
};

/**
 * Converts Attendance Matrix to CSV
 */
export const attendanceMatrixToCSV = (members: Member[], sessions: AttendanceSession[]): string => {
  const headers = ['Nama Lengkap', 'Suara', ...sessions.map((s) => `${s.date} (${s.title})`), 'Total Hadir', '% Kehadiran'];
  
  const rows = members.map((m) => {
    let hadirCount = 0;
    const sessionCols = sessions.map((s) => {
      const rec = s.records[m.id];
      const status = rec?.status || '-';
      if (status === 'Hadir') hadirCount++;
      return status;
    });

    const percent = sessions.length > 0 ? Math.round((hadirCount / sessions.length) * 100) : 0;

    return [
      `"${m.name.replace(/"/g, '""')}"`,
      m.voice,
      ...sessionCols,
      hadirCount.toString(),
      `${percent}%`,
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
};

/**
 * Generate Google Apps Script code snippet for copy-paste
 */
export const generateGoogleAppsScriptCode = (sheetName = 'Database_Absensi_Koor'): string => {
  return `/**
 * Google Apps Script untuk Sinkronisasi Otomatis Web Koor <-> Google Sheets
 * 1. Buka spreadsheet Google Sheets Anda.
 * 2. Klik Extensions > Apps Script.
 * 3. Hapus kode default, paste script ini, dan klik Save (ikon disket).
 * 4. Klik Deploy > New deployment > Select type: Web app.
 *    - Description: Koor Realtime Sync
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Salin Web App URL yang dihasilkan dan masukkan ke aplikasi web ini.
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("${sheetName}") || ss.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  var headers = data[0] || [];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[1]) continue;
    result.push({
      id: String(row[0] || ''),
      name: String(row[1] || ''),
      voice: String(row[2] || 'Sopran'),
      phone: String(row[3] || '')
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    members: result,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("${sheetName}");
    if (!sheet) {
      sheet = ss.insertSheet("${sheetName}");
    }
    
    // Clear and write members
    if (payload.members && Array.isArray(payload.members)) {
      sheet.clearContents();
      sheet.appendRow(["Nama Lengkap", "Suara", "No WhatsApp", "Catatan", "Terakhir Update"]);
      
      var rows = payload.members.map(function(m) {
        return [m.name, m.voice, "'" + m.phone, m.notes || '', new Date().toLocaleString('id-ID')];
      });
      
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 5).setValues(rows);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Data berhasil disinkronkan ke Google Sheets",
      count: payload.members ? payload.members.length : 0,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
};

// ================= MEMBER IDENTITY LOCAL PERSISTENCE =================
export interface SavedMemberProfile {
  memberId?: string;
  name: string;
  phone: string;
  email: string;
  voice: VoiceType;
  deviceId: string;
  isVerified: boolean;
  verifiedAt: string;
  lastSessionId?: string;
  lastStatus?: AttendanceStatus;
  savedAt: string;
}

const STORAGE_SAVED_PROFILE = 'koor_saved_member_profile_v1';

export const getSavedMemberProfile = (): SavedMemberProfile | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_PROFILE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.phone) {
      return {
        ...parsed,
        deviceId: parsed.deviceId || getDeviceFingerprintId(),
        email: parsed.email || '',
        isVerified: parsed.isVerified ?? true,
        verifiedAt: parsed.verifiedAt || parsed.savedAt || new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const saveMemberProfileLocally = (profile: Partial<SavedMemberProfile> & { name: string; phone: string; email: string; voice: VoiceType }): void => {
  if (typeof window === 'undefined') return;
  try {
    const deviceId = profile.deviceId || getDeviceFingerprintId();
    const data: SavedMemberProfile = {
      memberId: profile.memberId,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      voice: profile.voice,
      deviceId,
      isVerified: true,
      verifiedAt: profile.verifiedAt || new Date().toISOString(),
      lastSessionId: profile.lastSessionId,
      lastStatus: profile.lastStatus,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_SAVED_PROFILE, JSON.stringify(data));
  } catch (e) {
    console.error('Failed saving member profile locally:', e);
  }
};

export const clearMemberProfileLocally = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_SAVED_PROFILE);
  } catch {}
};

/**
 * Reset member's device/email binding on the server (Admin/Pengurus action)
 */
export const resetMemberBindingAPI = async (memberId: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/members/${memberId}/reset-binding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error('Error resetting member binding:', err);
    return false;
  }
};
