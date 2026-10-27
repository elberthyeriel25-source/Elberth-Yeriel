import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_MEMBERS, INITIAL_SESSIONS } from './src/data/initialData.ts';
import type { Member, AttendanceSession, AttendanceStatus, VoiceType } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface ServerDatabase {
  members: Member[];
  sessions: AttendanceSession[];
  logs: {
    id: string;
    timestamp: string;
    action: string;
    details: string;
    user: string;
  }[];
  lastUpdated: number;
}

// Helper to normalize Indonesian phone numbers (08xxxxxxxxxx)
export function normalizeIndonesianPhone(phone: string): string {
  if (!phone) return '';
  // Remove non-digit characters except leading plus
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.substring(2);
  } else if (!cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

// Helper to title case names
export function toTitleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s|-)\S/g, (char) => char.toUpperCase());
}

// Helper to normalize email
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

// Helper to validate email format
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    email.trim().toLowerCase()
  );
}

// Load database from file or initial data
function loadDatabase(): ServerDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.members && parsed.sessions) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading database file, initializing defaults:', err);
  }

  const initialDb: ServerDatabase = {
    members: INITIAL_MEMBERS,
    sessions: INITIAL_SESSIONS,
    logs: [
      {
        id: 'log_init',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action: 'Sistem Dimulai',
        details: 'Server database paduan suara berhasil diinisialisasi',
        user: 'Server',
      },
    ],
    lastUpdated: Date.now(),
  };

  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(db: ServerDatabase): void {
  try {
    db.lastUpdated = Date.now();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

let db = loadDatabase();

async function startServer() {
  // Always bind to port 3000 (DEFAULT_APP_PORT). Port 8080 is reserved for Nginx.
  const portArgIdx = process.argv.indexOf('--port');
  const portFromArg = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? parseInt(process.argv[portArgIdx + 1], 10) : NaN;
  const PORT = !isNaN(portFromArg) ? portFromArg : parseInt(process.env.DEFAULT_APP_PORT || '3000', 10);
  const app = express();

  app.use(express.json());

  // API Route: Get all data
  app.get('/api/data', (_req, res) => {
    res.json({
      members: db.members,
      sessions: db.sessions,
      logs: db.logs,
      lastUpdated: db.lastUpdated,
    });
  });

  // API Route: Get current active session
  app.get('/api/active-session', (_req, res) => {
    if (db.sessions.length === 0) {
      return res.json({ session: null });
    }
    // Return the latest session
    const sorted = [...db.sessions].sort((a, b) => b.date.localeCompare(a.date));
    res.json({ session: sorted[0], allSessions: sorted });
  });

  // API Route: Self-service Attendance Submission by Member via phone
  // API Route: Self-service Attendance Submission by Member via phone with Strict Anti-Proxy Integrity
  app.post('/api/attendance/self-submit', (req, res) => {
    const { name, phone, email, voice, status, sessionId, note, deviceId } = req.body;

    // Validation: Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap harus diisi (minimal 2 karakter).',
      });
    }

    // Validation: Phone
    const normalizedPhone = normalizeIndonesianPhone(phone || '');
    if (!normalizedPhone || normalizedPhone.length < 9 || normalizedPhone.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Nomor WhatsApp tidak valid. Masukkan nomor WhatsApp yang benar (contoh: 081234567890).',
      });
    }

    // Validation: Email (Required for Identity Binding & Verification)
    const normalizedEmail = normalizeEmail(email || '');
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Alamat email wajib diisi dengan format yang benar untuk verifikasi identitas unik Anda (contoh: nama@email.com).',
      });
    }

    // Validation: Status
    const validStatuses: AttendanceStatus[] = ['Hadir', 'Izin', 'Sakit', 'Alpa'];
    const attendanceStatus: AttendanceStatus = validStatuses.includes(status) ? status : 'Hadir';

    const formattedName = toTitleCase(name);

    // ================= STRICT INTEGRITY & ANTI-PROXY VERIFICATION =================
    // Rule: "dan setiap anggota atau email yang terverifikasi tidak boleh mengisi absensi untuk anggota lain baik anggota yang baru daftar ataupun anggota yang sudah terdaftar"

    // 1. Device Identity Binding Check
    // If this device was already bound to a verified member, block any attempt to fill for another person!
    if (deviceId) {
      const boundByDevice = db.members.find(
        (m) => m.deviceId && m.deviceId === deviceId
      );

      if (boundByDevice) {
        // Must match bound member's identity
        const isSamePhone = normalizeIndonesianPhone(boundByDevice.phone) === normalizedPhone;
        const isSameName = boundByDevice.name.toLowerCase().trim() === formattedName.toLowerCase().trim();
        const isSameEmail = boundByDevice.email ? normalizeEmail(boundByDevice.email) === normalizedEmail : true;

        if (!isSamePhone || !isSameName || !isSameEmail) {
          return res.status(403).json({
            success: false,
            message: `Akses Ditolak: Perangkat ini sudah terikat dengan ${boundByDevice.name}. Sesuai kebijakan kejujuran paduan suara, Anda dilarang mengisi absensi untuk anggota lain (titip absen), baik anggota yang sudah terdaftar maupun mendaftarkan anggota baru.`,
          });
        }
      }
    }

    // 2. Verified Email Binding Check
    // If this email is already registered to another member, it cannot be used by someone else!
    const boundByEmail = db.members.find(
      (m) =>
        (m.email && normalizeEmail(m.email) === normalizedEmail) ||
        (m.verifiedEmail && normalizeEmail(m.verifiedEmail) === normalizedEmail)
    );

    if (boundByEmail) {
      const isSamePhone = normalizeIndonesianPhone(boundByEmail.phone) === normalizedPhone;
      const isSameName = boundByEmail.name.toLowerCase().trim() === formattedName.toLowerCase().trim();

      if (!isSamePhone || !isSameName) {
        return res.status(403).json({
          success: false,
          message: `Email '${normalizedEmail}' telah terverifikasi atas nama ${boundByEmail.name}. Email terverifikasi tidak boleh digunakan untuk mengisi absensi anggota lain.`,
        });
      }
    }

    // 3. Phone Binding Check
    const boundByPhone = db.members.find(
      (m) => normalizeIndonesianPhone(m.phone) === normalizedPhone
    );

    if (boundByPhone) {
      const isSameName = boundByPhone.name.toLowerCase().trim() === formattedName.toLowerCase().trim();
      if (!isSameName) {
        return res.status(403).json({
          success: false,
          message: `Nomor WhatsApp ${normalizedPhone} sudah terdaftar atas nama ${boundByPhone.name}. Pengisian absensi untuk anggota lain tidak diizinkan.`,
        });
      }

      if (boundByPhone.email && normalizeEmail(boundByPhone.email) !== normalizedEmail) {
        return res.status(403).json({
          success: false,
          message: `Nomor WhatsApp ini sudah terikat dengan email terverifikasi lain (${boundByPhone.email}). Pengisian untuk akun lain dilarang demi keamanan.`,
        });
      }
    }

    // 4. Resolve Member or Register New
    let member = boundByPhone || boundByEmail || db.members.find(
      (m) => m.name.toLowerCase().trim() === formattedName.toLowerCase().trim()
    );

    let isNewMember = false;

    if (!member) {
      // Auto-register new member!
      // But verify that this device is NOT already bound to an existing member!
      if (deviceId) {
        const deviceMember = db.members.find((m) => m.deviceId === deviceId);
        if (deviceMember) {
          return res.status(403).json({
            success: false,
            message: `Perangkat ini sudah terikat dengan anggota ${deviceMember.name}. Anda tidak dapat mendaftarkan anggota baru dari perangkat yang sama.`,
          });
        }
      }

      isNewMember = true;
      const numericIds = db.members
        .map((m) => {
          const match = m.id.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        })
        .filter((n) => !isNaN(n));
      const nextNum = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
      const newId = `A${String(nextNum).padStart(3, '0')}`;

      const validVoice: VoiceType = ['Sopran', 'Alto', 'Tenor', 'Bass'].includes(voice)
        ? voice
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

      db.members.push(member);

      // Initialize this new member in all existing sessions as 'Belum'
      db.sessions.forEach((s) => {
        if (!s.records[member!.id]) {
          s.records[member!.id] = {
            memberId: member!.id,
            status: 'Belum',
          };
        }
      });
    } else {
      // Existing member: Bind email and device if not already set
      if (!member.email || member.email.trim() === '') {
        member.email = normalizedEmail;
      }
      if (!member.verifiedEmail) {
        member.verifiedEmail = normalizedEmail;
      }
      if (deviceId && !member.deviceId) {
        member.deviceId = deviceId;
      }
      if (!member.verifiedAt) {
        member.verifiedAt = new Date().toISOString();
      }
      if (voice && ['Sopran', 'Alto', 'Tenor', 'Bass'].includes(voice)) {
        member.voice = voice;
      }
      if (!member.phone || member.phone.trim() === '') {
        member.phone = normalizedPhone;
      }
      member.updatedAt = new Date().toISOString();
    }

    // Target session
    let targetSession = db.sessions.find((s) => s.id === sessionId);
    if (!targetSession) {
      // Fallback to latest session
      const sorted = [...db.sessions].sort((a, b) => b.date.localeCompare(a.date));
      targetSession = sorted[0];
    }

    // If still no session exists, create a default session for today
    if (!targetSession) {
      const today = new Date().toISOString().split('T')[0];
      targetSession = {
        id: `sess-${today}`,
        date: today,
        title: 'Latihan Rutin Koor',
        location: 'Ruang Latihan Koor',
        createdAt: new Date().toISOString(),
        records: {},
      };
      db.sessions.push(targetSession);
    }

    // Record attendance
    const recordNote = note ? note.trim() : attendanceStatus === 'Hadir' ? 'Hadir via HP' : 'Izin via HP';
    targetSession.records[member.id] = {
      memberId: member.id,
      status: attendanceStatus,
      note: recordNote,
      submittedBy: 'self',
      verifiedEmail: member.verifiedEmail || normalizedEmail,
      updatedAt: new Date().toISOString(),
    };

    // Activity log entry
    db.logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action: isNewMember ? 'Pendaftaran & Absen Mandiri' : 'Absensi Mandiri (HP)',
      details: `${member.name} (${member.voice}) mencatat status "${attendanceStatus}" pada sesi ${targetSession.title} (Email: ${member.email || normalizedEmail})`,
      user: member.name,
    });
    if (db.logs.length > 100) db.logs = db.logs.slice(0, 100);

    saveDatabase(db);

    return res.json({
      success: true,
      message: isNewMember
        ? `Selamat datang ${member.name}! Anda otomatis terdaftar dan terverifikasi di database koor.`
        : `Halo ${member.name}, absensi Anda berhasil dicatat sebagai "${attendanceStatus}".`,
      isNewMember,
      member,
      session: {
        id: targetSession.id,
        date: targetSession.date,
        title: targetSession.title,
        location: targetSession.location,
      },
      record: targetSession.records[member.id],
      submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    });
  });

  // API Route: Reset device & email binding for member (Admin/Pengurus override)
  app.post('/api/members/:id/reset-binding', (req, res) => {
    const { id } = req.params;
    const target = db.members.find((m) => m.id === id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan' });
    }

    target.deviceId = undefined;
    target.updatedAt = new Date().toISOString();
    saveDatabase(db);

    db.logs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action: 'Reset Kunci Perangkat',
      details: `Kunci perangkat untuk ${target.name} di-reset oleh Pengurus.`,
      user: 'Pengurus Koor',
    });

    res.json({ success: true, message: `Kunci perangkat ${target.name} berhasil di-reset`, member: target });
  });

  // API Route: Add or Update member (Admin manual)
  app.post('/api/members', (req, res) => {
    const member: Member = req.body;
    if (!member || !member.name) {
      return res.status(400).json({ success: false, message: 'Data anggota tidak lengkap' });
    }

    const existingIdx = db.members.findIndex((m) => m.id === member.id);
    if (existingIdx !== -1) {
      db.members[existingIdx] = { ...member, updatedAt: new Date().toISOString() };
    } else {
      db.members.push({ ...member, updatedAt: new Date().toISOString() });
      // initialize in sessions
      db.sessions.forEach((s) => {
        if (!s.records[member.id]) {
          s.records[member.id] = { memberId: member.id, status: 'Belum' };
        }
      });
    }

    db.logs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action: existingIdx !== -1 ? 'Edit Anggota' : 'Tambah Anggota Manual',
      details: `${member.name} (${member.voice}) diperbarui.`,
      user: 'Pengurus Koor',
    });

    saveDatabase(db);
    res.json({ success: true, members: db.members });
  });

  // API Route: Delete members
  app.post('/api/members/delete', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'Invalid IDs' });
    }

    db.members = db.members.filter((m) => !ids.includes(m.id));
    saveDatabase(db);
    res.json({ success: true, members: db.members });
  });

  // API Route: Add/Update session
  app.post('/api/sessions', (req, res) => {
    const session: AttendanceSession = req.body;
    if (!session || !session.id) {
      return res.status(400).json({ success: false, message: 'Invalid session' });
    }

    const idx = db.sessions.findIndex((s) => s.id === session.id);
    if (idx !== -1) {
      db.sessions[idx] = session;
    } else {
      db.sessions.push(session);
    }

    saveDatabase(db);
    res.json({ success: true, sessions: db.sessions });
  });

  // API Route: Delete session
  app.delete('/api/sessions/:id', (req, res) => {
    const { id } = req.params;
    db.sessions = db.sessions.filter((s) => s.id !== id);
    saveDatabase(db);
    res.json({ success: true, sessions: db.sessions });
  });

  // API Route: Bulk sync
  app.post('/api/sync', (req, res) => {
    const { members, sessions } = req.body;
    if (Array.isArray(members)) db.members = members;
    if (Array.isArray(sessions)) db.sessions = sessions;
    saveDatabase(db);
    res.json({ success: true, members: db.members, sessions: db.sessions });
  });

  // Mount Vite dev server or static files
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Absensi Koor running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
