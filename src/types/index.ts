export type VoiceType = 'Sopran' | 'Alto' | 'Tenor' | 'Bass';

export interface Member {
  id: string; // e.g. "A001"
  name: string; // e.g. "Budi Santoso"
  voice: VoiceType; // "Tenor"
  phone: string; // "081234567890"
  email?: string; // e.g. "budi.santoso@example.com"
  verifiedEmail?: string;
  deviceId?: string;
  verifiedAt?: string;
  notes?: string;
  joinDate?: string;
  active: boolean;
  updatedAt?: string;
}

export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa' | 'Belum';

export interface AttendanceRecord {
  memberId: string;
  status: AttendanceStatus;
  note?: string;
  submittedBy?: string; // "self" | "admin"
  verifiedEmail?: string;
  updatedAt?: string;
}

export interface AttendanceSession {
  id: string;
  date: string; // YYYY-MM-DD
  title: string; // e.g. "Latihan Rutin #12"
  location: string; // e.g. "Ruang Koor Lantai 2"
  songList?: string; // e.g. "Hallelujah Chorus, Ave Verum"
  records: Record<string, AttendanceRecord>; // memberId -> AttendanceRecord
  createdAt: string;
  passcode?: string; // e.g. "SB72" (Dynamic daily verification passcode distributed by admin)
  requirePasscode?: boolean; // whether passcode validation is strictly enforced for this session
}

export interface GoogleSheetsConfig {
  webhookUrl: string; // Google Apps Script Web App URL
  sheetId: string; // Google Spreadsheet ID
  sheetName: string; // e.g. "Database_Absensi"
  autoSync: boolean; // Auto-sync on changes
  lastSynced?: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
}

export interface SyncMessage {
  type: 'MEMBERS_UPDATED' | 'SESSIONS_UPDATED' | 'FULL_SYNC' | 'USER_PRESENCE';
  timestamp: number;
  senderId: string;
  senderName: string;
  payload?: any;
}

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
}
