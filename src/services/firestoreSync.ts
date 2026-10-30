import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Member, AttendanceSession, ActivityLogItem, VoiceType, AttendanceStatus } from '../types';
import { INITIAL_MEMBERS, INITIAL_SESSIONS } from '../data/initialData';
import { normalizeIndonesianPhone, normalizeEmail, getDeviceFingerprintId } from './syncService';

export interface FirestoreDataListeners {
  onMembersChange: (members: Member[]) => void;
  onSessionsChange: (sessions: AttendanceSession[]) => void;
  onAdminPinChange: (adminPin: string) => void;
  onLogsChange: (logs: ActivityLogItem[]) => void;
  onError?: (error: any) => void;
}

let cachedCloudPin: string = '1234';

export const getCachedCloudAdminPin = (): string => cachedCloudPin;

/**
 * Initializes real-time two-way synchronization with Firebase Firestore across all devices
 */
export function initFirestoreSync(listeners: FirestoreDataListeners): () => void {
  const unsubscribes: (() => void)[] = [];
  let isSeedingMembers = false;
  let isSeedingSessions = false;

  // 1. Members Real-time Listener
  try {
    const membersRef = collection(db, 'members');
    const unsubMembers = onSnapshot(
      membersRef,
      async (snapshot) => {
        if (snapshot.empty && !isSeedingMembers) {
          isSeedingMembers = true;
          console.log('Seeding initial choir members to Firestore...');
          try {
            const batch = writeBatch(db);
            INITIAL_MEMBERS.forEach((m) => {
              const ref = doc(db, 'members', m.id);
              batch.set(ref, m);
            });
            await batch.commit();
          } catch (e) {
            console.error('Failed seeding members to Firestore:', e);
          } finally {
            isSeedingMembers = false;
          }
          return;
        }

        const members: Member[] = [];
        snapshot.forEach((docSnap) => {
          members.push(docSnap.data() as Member);
        });

        // Sort by ID naturally
        members.sort((a, b) => {
          const numA = parseInt(a.id.replace(/\D/g, '') || '0', 10);
          const numB = parseInt(b.id.replace(/\D/g, '') || '0', 10);
          return numA - numB;
        });

        listeners.onMembersChange(members);
      },
      (error) => {
        console.error('Firestore members snapshot error:', error);
        listeners.onError?.(error);
      }
    );
    unsubscribes.push(unsubMembers);
  } catch (err) {
    console.error('Failed to attach members listener:', err);
  }

  // 2. Sessions Real-time Listener
  try {
    const sessionsRef = collection(db, 'sessions');
    const unsubSessions = onSnapshot(
      sessionsRef,
      async (snapshot) => {
        if (snapshot.empty && !isSeedingSessions) {
          isSeedingSessions = true;
          console.log('Seeding initial sessions to Firestore...');
          try {
            const batch = writeBatch(db);
            INITIAL_SESSIONS.forEach((s) => {
              const ref = doc(db, 'sessions', s.id);
              batch.set(ref, s);
            });
            await batch.commit();
          } catch (e) {
            console.error('Failed seeding sessions to Firestore:', e);
          } finally {
            isSeedingSessions = false;
          }
          return;
        }

        const sessions: AttendanceSession[] = [];
        snapshot.forEach((docSnap) => {
          sessions.push(docSnap.data() as AttendanceSession);
        });

        // Sort latest date first
        sessions.sort((a, b) => b.date.localeCompare(a.date));
        listeners.onSessionsChange(sessions);
      },
      (error) => {
        console.error('Firestore sessions snapshot error:', error);
        listeners.onError?.(error);
      }
    );
    unsubscribes.push(unsubSessions);
  } catch (err) {
    console.error('Failed to attach sessions listener:', err);
  }

  // 3. Admin PIN Settings Listener (Synchronized Password Across All Devices)
  try {
    const settingsDocRef = doc(db, 'settings', 'admin');
    const unsubSettings = onSnapshot(
      settingsDocRef,
      async (snap) => {
        if (!snap.exists()) {
          // Initialize default PIN in cloud
          try {
            await setDoc(settingsDocRef, { adminPin: '1234', updatedAt: new Date().toISOString() });
          } catch (e) {
            console.error('Failed setting default admin PIN:', e);
          }
        } else {
          const data = snap.data();
          if (data && data.adminPin) {
            cachedCloudPin = String(data.adminPin).trim();
            listeners.onAdminPinChange(cachedCloudPin);
          }
        }
      },
      (error) => {
        console.error('Firestore settings snapshot error:', error);
      }
    );
    unsubscribes.push(unsubSettings);
  } catch (err) {
    console.error('Failed to attach settings listener:', err);
  }

  // 4. Activity Logs Listener
  try {
    const logsRef = collection(db, 'logs');
    const logsQuery = query(logsRef, limit(50));
    const unsubLogs = onSnapshot(
      logsQuery,
      (snap) => {
        const logs: ActivityLogItem[] = [];
        snap.forEach((d) => logs.push(d.data() as ActivityLogItem));
        // Sort reverse chronological
        logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        listeners.onLogsChange(logs);
      },
      (err) => {
        console.error('Firestore logs snapshot error:', err);
      }
    );
    unsubscribes.push(unsubLogs);
  } catch (err) {
    console.error('Failed to attach logs listener:', err);
  }

  return () => {
    unsubscribes.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Error during Firestore unsubscribe:', e);
      }
    });
  };
}

/**
 * Save single member to Firestore
 */
export async function saveMemberToFirestore(member: Member): Promise<void> {
  const ref = doc(db, 'members', member.id);
  await setDoc(ref, {
    ...member,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Save bulk members to Firestore
 */
export async function saveMembersToFirestore(members: Member[]): Promise<void> {
  const batch = writeBatch(db);
  members.forEach((m) => {
    const ref = doc(db, 'members', m.id);
    batch.set(ref, {
      ...m,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
  await batch.commit();
}

/**
 * Delete members from Firestore
 */
export async function deleteMembersFromFirestore(memberIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  memberIds.forEach((id) => {
    batch.delete(doc(db, 'members', id));
  });
  await batch.commit();
}

/**
 * Save single session to Firestore
 */
export async function saveSessionToFirestore(session: AttendanceSession): Promise<void> {
  const ref = doc(db, 'sessions', session.id);
  await setDoc(ref, session, { merge: true });
}

/**
 * Delete session from Firestore
 */
export async function deleteSessionFromFirestore(sessionId: string): Promise<void> {
  await deleteDoc(doc(db, 'sessions', sessionId));
}

/**
 * Save global Admin PIN to Firestore (Synchronizes instantly with all devices)
 */
export async function saveAdminPinToFirestore(newPin: string): Promise<boolean> {
  try {
    const trimmed = newPin.trim();
    if (trimmed.length < 3) return false;
    const ref = doc(db, 'settings', 'admin');
    await setDoc(ref, {
      adminPin: trimmed,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    cachedCloudPin = trimmed;
    return true;
  } catch (err) {
    console.error('Failed saving admin PIN to Firestore:', err);
    return false;
  }
}

/**
 * Add activity log to Firestore
 */
export async function addActivityLogToFirestore(action: string, details: string, user: string): Promise<void> {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const ref = doc(db, 'logs', logId);
    await setDoc(ref, {
      id: logId,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action,
      details,
      user,
    });
  } catch (err) {
    console.error('Failed writing activity log to Firestore:', err);
  }
}

/**
 * Reset member device and email binding in Firestore
 */
export async function resetMemberBindingInFirestore(memberId: string): Promise<boolean> {
  try {
    const ref = doc(db, 'members', memberId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    await setDoc(
      ref,
      {
        deviceId: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    await addActivityLogToFirestore('Reset Kunci Perangkat', `Kunci perangkat untuk ID ${memberId} berhasil di-reset.`, 'Pengurus Koor');
    return true;
  } catch (err) {
    console.error('Error resetting member binding in Firestore:', err);
    return false;
  }
}

/**
 * Submit self attendance directly to Firestore
 * Works flawlessly across every single device, phone, browser, or hosting provider!
 */
export async function submitAttendanceToFirestore(payload: {
  name: string;
  phone: string;
  email: string;
  voice?: VoiceType;
  status: AttendanceStatus;
  sessionId?: string;
  note?: string;
  deviceId?: string;
  sessionPasscode?: string;
}): Promise<{
  success: boolean;
  message: string;
  isNewMember: boolean;
  member: Member;
  session: { id: string; date: string; title: string; location: string };
  record: any;
  submittedAt: string;
}> {
  const deviceId = payload.deviceId || getDeviceFingerprintId();
  const formattedName = payload.name.trim().toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
  const normalizedPhone = normalizeIndonesianPhone(payload.phone);
  const normalizedEmail = normalizeEmail(payload.email);

  // 1. Fetch current live members and sessions from Firestore
  const membersSnap = await getDocs(collection(db, 'members'));
  const currentMembers: Member[] = [];
  membersSnap.forEach((d) => currentMembers.push(d.data() as Member));

  const sessionsSnap = await getDocs(collection(db, 'sessions'));
  const currentSessions: AttendanceSession[] = [];
  sessionsSnap.forEach((d) => currentSessions.push(d.data() as AttendanceSession));

  // 2. Resolve target session
  let targetSession = currentSessions.find((s) => s.id === payload.sessionId);
  if (!targetSession) {
    const sorted = [...currentSessions].sort((a, b) => b.date.localeCompare(a.date));
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
  }

  // 3. Dynamic Daily Passcode Validation
  if (targetSession.requirePasscode && targetSession.passcode) {
    const submittedCode = (payload.sessionPasscode || '').trim().toUpperCase();
    const expectedCode = targetSession.passcode.trim().toUpperCase();
    if (submittedCode !== expectedCode) {
      throw new Error(
        `Kode Validasi Sesi tidak sesuai. Silakan minta atau lihat kode harian yang ditampilkan pengurus di ruangan latihan (${targetSession.title}).`
      );
    }
  }

  // 4. Strict Anti-Titip Absen Integrity
  if (deviceId) {
    const boundByDevice = currentMembers.find((m) => m.deviceId && m.deviceId === deviceId);
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

  const boundByEmail = currentMembers.find(
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

  const boundByPhone = currentMembers.find((m) => normalizeIndonesianPhone(m.phone) === normalizedPhone);
  if (boundByPhone) {
    const isSameName = boundByPhone.name.toLowerCase().trim() === formattedName.toLowerCase().trim();
    if (!isSameName) {
      throw new Error(
        `Nomor WhatsApp ${normalizedPhone} sudah terdaftar atas nama ${boundByPhone.name}. Pengisian absensi untuk anggota lain tidak diizinkan.`
      );
    }
  }

  // 5. Resolve or register member
  let member = boundByPhone || boundByEmail || currentMembers.find((m) => m.name.toLowerCase().trim() === formattedName.toLowerCase().trim());
  let isNewMember = false;

  if (!member) {
    isNewMember = true;
    const numericIds = currentMembers
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
  } else {
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

  // 6. Record attendance
  const recordNote = payload.note ? payload.note.trim() : payload.status === 'Hadir' ? 'Hadir via HP' : 'Izin via HP';
  const attendanceRecord = {
    memberId: member.id,
    status: payload.status,
    note: recordNote,
    submittedBy: 'self',
    verifiedEmail: member.verifiedEmail || normalizedEmail,
    updatedAt: new Date().toISOString(),
  };

  const updatedRecords = {
    ...targetSession.records,
    [member.id]: attendanceRecord,
  };
  const updatedSession: AttendanceSession = {
    ...targetSession,
    records: updatedRecords,
  };

  // 7. Atomic-like saves to Firestore
  await saveMemberToFirestore(member);
  await saveSessionToFirestore(updatedSession);
  await addActivityLogToFirestore(
    isNewMember ? 'Pendaftaran & Absen Mandiri' : 'Absensi Mandiri (HP)',
    `${member.name} (${member.voice}) mencatat ${payload.status} pada sesi ${updatedSession.title}`,
    member.name
  );

  return {
    success: true,
    message: isNewMember
      ? `Selamat datang ${member.name}! Anda otomatis terdaftar di database koor cloud.`
      : `Halo ${member.name}, absensi Anda berhasil dicatat sebagai "${payload.status}".`,
    isNewMember,
    member,
    session: {
      id: updatedSession.id,
      date: updatedSession.date,
      title: updatedSession.title,
      location: updatedSession.location,
    },
    record: attendanceRecord,
    submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };
}
