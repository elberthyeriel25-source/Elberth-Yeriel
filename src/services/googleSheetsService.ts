import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Member, AttendanceSession, VoiceType } from '../types';

// Defined OAuth Scopes as required by workspace-integration
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory token cache (NEVER stored in localStorage or sessionStorage per skill rule)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Initialize Firebase Auth listener.
 */
export const initGoogleAuth = (
  onAuthChange: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthChange(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token expired or page reloaded; user remains signed in to Firebase
        onAuthChange(user, null);
      }
    } else {
      cachedAccessToken = null;
      onAuthChange(null, null);
    }
  });
};

/**
 * Sign in with Google with Workspace Sheets & Drive scopes
 */
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Sign out from Google Auth
 */
export const signOutGoogle = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Returns current access token
 */
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Extract Spreadsheet ID from URL or return raw ID
 */
export const extractSpreadsheetId = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  // Match https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
};

/**
 * Fetches basic spreadsheet metadata (title and sheet tabs)
 */
export const getSpreadsheetMetadata = async (
  spreadsheetId: string,
  token: string
): Promise<{ title: string; sheets: string[] }> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title,sheets.properties.title`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody?.error?.message || `HTTP ${res.status}: Gagal memuat spreadsheet.`;
    throw new Error(message);
  }

  const data = await res.json();
  const title = data.properties?.title || 'Spreadsheet Tanpa Judul';
  const sheets = (data.sheets || []).map((s: any) => s.properties?.title as string);
  return { title, sheets };
};

/**
 * Creates a brand new Google Spreadsheet in the user's Google Drive
 */
export const createNewChoirSpreadsheet = async (
  title: string,
  token: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const spreadsheetTitle = title.trim() || 'Absensi Koor - Database & Rekapitulasi';

  const body = {
    properties: {
      title: spreadsheetTitle,
    },
    sheets: [
      {
        properties: {
          title: 'Daftar Anggota',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: 'Rekapitulasi Absensi',
          gridProperties: {
            frozenRowCount: 1,
            frozenColumnCount: 2,
          },
        },
      },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || 'Gagal membuat Google Spreadsheet baru.');
  }

  const data = await res.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };
};

/**
 * Push full Member & Attendance dataset to Google Sheets
 */
export const pushDataToGoogleSheets = async (
  spreadsheetId: string,
  token: string,
  members: Member[],
  sessions: AttendanceSession[]
): Promise<{ updatedCells: number }> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);

  // 1. First ensure the tabs exist or fetch sheets
  const meta = await getSpreadsheetMetadata(cleanId, token);
  const existingSheets = meta.sheets;

  // If "Daftar Anggota" or "Rekapitulasi Absensi" don't exist, we can add them via batchUpdate
  const missingSheets: string[] = [];
  if (!existingSheets.includes('Daftar Anggota')) missingSheets.push('Daftar Anggota');
  if (!existingSheets.includes('Rekapitulasi Absensi')) missingSheets.push('Rekapitulasi Absensi');

  if (missingSheets.length > 0) {
    const addSheetRequests = missingSheets.map((name) => ({
      addSheet: {
        properties: {
          title: name,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: addSheetRequests }),
    });
  }

  // 2. Prepare "Daftar Anggota" data
  const memberHeader = [
    'No',
    'Nama Lengkap',
    'Suara',
    'No WhatsApp',
    'Email Terverifikasi',
    'Status Keaktifan',
    'Catatan Khusus',
    'Terakhir Sinkron',
  ];

  const nowStr = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const memberRows = members.map((m, idx) => [
    idx + 1,
    m.name,
    m.voice,
    "'" + m.phone, // escape phone to preserve leading zero in Excel/Sheets
    m.verifiedEmail || m.email || '-',
    m.active ? 'Aktif' : 'Non-Aktif',
    m.notes || '-',
    nowStr,
  ]);

  // 3. Prepare "Rekapitulasi Absensi" data
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const sessionHeaders = sortedSessions.map(
    (s) => `${s.title} (${s.date})`
  );

  const attendanceHeader = [
    'Nama Lengkap',
    'Suara',
    ...sessionHeaders,
    'Total Hadir',
    'Total Sesi',
    'Persentase (%)',
  ];

  const attendanceRows = members.map((m) => {
    let hadirCount = 0;
    const sessionStatuses = sortedSessions.map((session) => {
      const rec = session.records[m.id];
      const status = rec?.status || 'Belum';
      if (status === 'Hadir') hadirCount++;
      return status;
    });

    const totalSessions = sortedSessions.length;
    const percentage = totalSessions > 0 ? Math.round((hadirCount / totalSessions) * 100) : 0;

    return [
      m.name,
      m.voice,
      ...sessionStatuses,
      hadirCount,
      totalSessions,
      `${percentage}%`,
    ];
  });

  // 4. Clear old data and write new data using batchUpdate values
  // We clear ample range then write
  const dataPayload = [
    {
      range: "'Daftar Anggota'!A1:Z500",
      values: [memberHeader, ...memberRows],
    },
    {
      range: "'Rekapitulasi Absensi'!A1:ZZ500",
      values: [attendanceHeader, ...attendanceRows],
    },
  ];

  // First clear ranges
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'Daftar Anggota'!A1:Z500:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'Rekapitulasi Absensi'!A1:ZZ500:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  // Write new values
  const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: dataPayload,
    }),
  });

  if (!writeRes.ok) {
    const errorBody = await writeRes.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || 'Gagal menulis data ke Google Sheets.');
  }

  const result = await writeRes.json();
  return { updatedCells: result.totalUpdatedCells || (memberRows.length * 8 + attendanceRows.length * attendanceHeader.length) };
};

/**
 * Pull and import members from Google Sheets
 */
export const pullMembersFromGoogleSheets = async (
  spreadsheetId: string,
  token: string
): Promise<Member[]> => {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const meta = await getSpreadsheetMetadata(cleanId, token);
  const targetSheet = meta.sheets.includes('Daftar Anggota') ? 'Daftar Anggota' : meta.sheets[0];

  if (!targetSheet) {
    throw new Error('Spreadsheet tidak memiliki lembar data yang dapat dibaca.');
  }

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${targetSheet}'!A1:H300`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || 'Gagal membaca isi Google Sheets.');
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length < 2) {
    throw new Error('Lembar spreadsheet kosong atau tidak memiliki baris data.');
  }

  const header = rows[0].map((h) => (h || '').toString().toLowerCase().trim());
  
  // Find column indices
  let nameIdx = header.findIndex((h) => h.includes('nama'));
  let voiceIdx = header.findIndex((h) => h.includes('suara') || h.includes('voice') || h.includes('part'));
  let phoneIdx = header.findIndex((h) => h.includes('wa') || h.includes('telepon') || h.includes('hp') || h.includes('phone'));
  let emailIdx = header.findIndex((h) => h.includes('email'));
  let notesIdx = header.findIndex((h) => h.includes('catatan') || h.includes('note'));

  if (nameIdx === -1) nameIdx = 1; // fallback
  if (voiceIdx === -1) voiceIdx = 2;
  if (phoneIdx === -1) phoneIdx = 3;

  const validVoices: VoiceType[] = ['Sopran', 'Alto', 'Tenor', 'Bass'];
  const importedMembers: Member[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawName = (row[nameIdx] || '').toString().trim();
    if (!rawName) continue;

    const rawVoice = (row[voiceIdx] || '').toString().trim();
    const matchedVoice = validVoices.find((v) => v.toLowerCase() === rawVoice.toLowerCase()) || 'Tenor';

    const rawPhone = (row[phoneIdx] || '').toString().replace(/[^0-9]/g, '');
    const rawEmail = emailIdx !== -1 && row[emailIdx] ? (row[emailIdx] || '').toString().trim() : '';
    const rawNotes = notesIdx !== -1 && row[notesIdx] ? (row[notesIdx] || '').toString().trim() : '';

    importedMembers.push({
      id: 'm_' + Date.now().toString(36) + '_' + i,
      name: rawName,
      voice: matchedVoice,
      phone: rawPhone.startsWith('62') ? '0' + rawPhone.slice(2) : rawPhone,
      email: rawEmail || undefined,
      notes: rawNotes || undefined,
      active: true,
      updatedAt: new Date().toISOString(),
    });
  }

  return importedMembers;
};
