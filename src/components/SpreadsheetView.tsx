import React, { useState, useRef, useEffect } from 'react';
import { Member, VoiceType } from '../types';
import { resetMemberBindingAPI } from '../services/syncService';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  MessageCircle,
  ArrowUpDown,
  Check,
  ChevronDown,
  Sparkles,
  Phone,
  ExternalLink,
  Users,
  Mail,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface SpreadsheetViewProps {
  members: Member[];
  onUpdateMember: (member: Member) => void;
  onAddMember: (member: Member) => void;
  onDeleteMembers: (ids: string[]) => void;
  onOpenEditModal: (member?: Member) => void;
  onSelectForBroadcast: (phones: { name: string; phone: string }[]) => void;
}

type EditableField = 'name' | 'voice' | 'phone' | 'notes';

interface EditingCell {
  id: string;
  field: EditableField;
}

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  members,
  onUpdateMember,
  onAddMember,
  onDeleteMembers,
  onOpenEditModal,
  onSelectForBroadcast,
}) => {
  const [search, setSearch] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<'Semua' | VoiceType>('Semua');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'voice' | 'phone'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [cellDraftValue, setCellDraftValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Quick bottom row addition state
  const [quickName, setQuickName] = useState('');
  const [quickVoice, setQuickVoice] = useState<VoiceType>('Sopran');
  const [quickPhone, setQuickPhone] = useState('');

  // Auto focus inline edit input
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, [editingCell]);

  // Voice styling helpers
  const voiceStyles: Record<VoiceType, { badge: string; text: string; bg: string }> = {
    Sopran: {
      badge: 'bg-rose-50 text-rose-700 border border-rose-200',
      text: 'text-rose-700',
      bg: 'bg-rose-500',
    },
    Alto: {
      badge: 'bg-purple-50 text-purple-700 border border-purple-200',
      text: 'text-purple-700',
      bg: 'bg-purple-500',
    },
    Tenor: {
      badge: 'bg-amber-50 text-amber-800 border border-amber-200',
      text: 'text-amber-800',
      bg: 'bg-amber-500',
    },
    Bass: {
      badge: 'bg-sky-50 text-sky-700 border border-sky-200',
      text: 'text-sky-700',
      bg: 'bg-sky-500',
    },
  };

  // Start inline editing
  const handleStartEdit = (id: string, field: EditableField, currentVal: string) => {
    setEditingCell({ id, field });
    setCellDraftValue(currentVal || '');
  };

  // Commit inline edit
  const handleCommitEdit = () => {
    if (!editingCell) return;
    const member = members.find((m) => m.id === editingCell.id);
    if (!member) {
      setEditingCell(null);
      return;
    }

    let updatedVal = cellDraftValue.trim();
    if (editingCell.field === 'phone') {
      if (updatedVal.startsWith('62')) updatedVal = '0' + updatedVal.substring(2);
      else if (updatedVal && !updatedVal.startsWith('0') && !updatedVal.startsWith('+')) {
        updatedVal = '0' + updatedVal;
      }
    }

    if (member[editingCell.field] !== updatedVal) {
      onUpdateMember({
        ...member,
        [editingCell.field]: updatedVal,
        updatedAt: new Date().toISOString(),
      });
    }

    setEditingCell(null);
  };

  // Handle keyboard navigation inside inline editor
  const handleKeyDown = (e: React.KeyboardEvent, member: Member, field: EditableField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitEdit();
      // Move down to next member same field
      const currentIndex = sortedMembers.findIndex((m) => m.id === member.id);
      if (currentIndex < sortedMembers.length - 1) {
        const nextMember = sortedMembers[currentIndex + 1];
        setTimeout(() => handleStartEdit(nextMember.id, field, nextMember[field] || ''), 50);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCommitEdit();
      const fields: EditableField[] = ['name', 'voice', 'phone', 'notes'];
      const currentFieldIndex = fields.indexOf(field);
      if (currentFieldIndex < fields.length - 1) {
        const nextField = fields[currentFieldIndex + 1];
        setTimeout(() => handleStartEdit(member.id, nextField, member[nextField] || ''), 50);
      } else {
        const currentIndex = sortedMembers.findIndex((m) => m.id === member.id);
        if (currentIndex < sortedMembers.length - 1) {
          const nextMember = sortedMembers[currentIndex + 1];
          setTimeout(() => handleStartEdit(nextMember.id, fields[0], nextMember[fields[0]] || ''), 50);
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Filtering
  const filteredMembers = members.filter((m) => {
    const matchesVoice = voiceFilter === 'Semua' || m.voice === voiceFilter;
    const query = search.toLowerCase();
    const matchesSearch =
      m.name.toLowerCase().includes(query) ||
      m.phone.toLowerCase().includes(query) ||
      m.voice.toLowerCase().includes(query) ||
      (m.notes || '').toLowerCase().includes(query);
    return matchesVoice && matchesSearch;
  });

  // Sorting
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    let comp = 0;
    if (sortField === 'name') comp = a.name.localeCompare(b.name);
    else if (sortField === 'voice') comp = a.voice.localeCompare(b.voice);
    else if (sortField === 'phone') comp = a.phone.localeCompare(b.phone);
    return sortAsc ? comp : -comp;
  });

  const handleSort = (field: 'name' | 'voice' | 'phone') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Selection
  const toggleSelectAll = () => {
    if (selectedIds.size === sortedMembers.length && sortedMembers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedMembers.map((m) => m.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Quick Add Row
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;

    // Generate next ID
    const numbers = members
      .map((m) => parseInt(m.id.replace(/[^0-9]/g, ''), 10))
      .filter((n) => !isNaN(n));
    const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    const nextId = `A${String(nextNum).padStart(3, '0')}`;

    let phoneFormatted = quickPhone.trim();
    if (phoneFormatted.startsWith('62')) phoneFormatted = '0' + phoneFormatted.substring(2);
    else if (phoneFormatted && !phoneFormatted.startsWith('0') && !phoneFormatted.startsWith('+')) {
      phoneFormatted = '0' + phoneFormatted;
    }

    onAddMember({
      id: nextId,
      name: quickName.trim(),
      voice: quickVoice,
      phone: phoneFormatted,
      notes: '',
      active: true,
      joinDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    });

    setQuickName('');
    setQuickPhone('');
  };

  // Voice counts
  const voiceCounts = {
    Semua: members.length,
    Sopran: members.filter((m) => m.voice === 'Sopran').length,
    Alto: members.filter((m) => m.voice === 'Alto').length,
    Tenor: members.filter((m) => m.voice === 'Tenor').length,
    Bass: members.filter((m) => m.voice === 'Bass').length,
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Voice Section Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['Semua', 'Sopran', 'Alto', 'Tenor', 'Bass'] as const).map((v) => {
            const isActive = voiceFilter === v;
            return (
              <button
                key={v}
                onClick={() => setVoiceFilter(v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {v !== 'Semua' && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      voiceStyles[v as VoiceType].bg
                    }`}
                  />
                )}
                <span>{v}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-200/70 text-slate-600'
                  }`}
                >
                  {voiceCounts[v]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5 flex-1 max-w-md justify-end">
          <div className="relative w-full max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, no WhatsApp, suara..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition"
            />
          </div>

          <button
            onClick={() => onOpenEditModal()}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Selected Action Floating Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center justify-between shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">{selectedIds.size} anggota terpilih</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const selectedMembers = members.filter((m) => selectedIds.has(m.id) && m.phone);
                onSelectForBroadcast(
                  selectedMembers.map((m) => ({ name: m.name, phone: m.phone }))
                );
              }}
              className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Broadcast WA</span>
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Hapus ${selectedIds.size} anggota terpilih dari database?`)) {
                  onDeleteMembers(Array.from(selectedIds));
                  setSelectedIds(new Set());
                }
              }}
              className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          </div>
        </div>
      )}

      {/* Google Sheets Styled Spreadsheet Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table info banner */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 font-bold">
              SHEET 1
            </span>
            <span>Database_Absensi_Koor ({sortedMembers.length} baris)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>💡 Klik sel untuk edit langsung (Enter / Tab untuk pindah)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            {/* Sheet Column Headers (A, B, C, D...) */}
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-mono text-[11px] select-none">
                <th className="w-12 text-center py-2 px-2 border-r border-slate-200 text-slate-400 font-normal">
                  #
                </th>
                <th className="w-10 text-center py-2 px-2 border-r border-slate-200">
                  <input
                    type="checkbox"
                    checked={
                      sortedMembers.length > 0 && selectedIds.size === sortedMembers.length
                    }
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 text-blue-600 rounded-sm border-slate-300"
                  />
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-2 px-3 border-r border-slate-200 font-semibold cursor-pointer hover:bg-slate-200/70 transition min-w-[200px]"
                >
                  <div className="flex items-center justify-between">
                    <span>Nama Lengkap (A)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('voice')}
                  className="py-2 px-3 border-r border-slate-200 font-semibold cursor-pointer hover:bg-slate-200/70 transition w-32"
                >
                  <div className="flex items-center justify-between">
                    <span>Suara (B)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('phone')}
                  className="py-2 px-3 border-r border-slate-200 font-semibold cursor-pointer hover:bg-slate-200/70 transition w-44"
                >
                  <div className="flex items-center justify-between">
                    <span>No WhatsApp (C)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-600 min-w-[200px]">
                  <span>Email & Verifikasi (D)</span>
                </th>
                <th className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-600 min-w-[160px]">
                  <span>Catatan / Keterangan (E)</span>
                </th>
                <th className="py-2 px-3 text-center w-32 font-semibold text-slate-600">
                  <span>Aksi</span>
                </th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-slate-100">
              {sortedMembers.map((member, index) => {
                const isSelected = selectedIds.has(member.id);
                const voice = member.voice;

                return (
                  <tr
                    key={member.id}
                    className={`group transition-colors ${
                      isSelected
                        ? 'bg-blue-50/60'
                        : index % 2 === 0
                        ? 'bg-white hover:bg-slate-50/80'
                        : 'bg-slate-50/40 hover:bg-slate-50'
                    }`}
                  >
                    {/* Row Index */}
                    <td className="text-center py-2 px-1 text-slate-400 font-mono text-[11px] border-r border-slate-200/80 select-none bg-slate-50/50">
                      {index + 1}
                    </td>

                    {/* Checkbox */}
                    <td className="text-center py-2 px-2 border-r border-slate-200/80">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(member.id)}
                        className="w-3.5 h-3.5 text-blue-600 rounded-sm border-slate-300"
                      />
                    </td>

                    {/* Nama Lengkap Cell (Inline Editable) */}
                    <td
                      onClick={() => handleStartEdit(member.id, 'name', member.name)}
                      className={`py-2 px-3 border-r border-slate-200/80 font-medium text-slate-900 cursor-pointer relative group-hover:bg-blue-50/30 ${
                        editingCell?.id === member.id && editingCell?.field === 'name'
                          ? 'p-0 cell-focus'
                          : ''
                      }`}
                    >
                      {editingCell?.id === member.id && editingCell?.field === 'name' ? (
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          value={cellDraftValue}
                          onChange={(e) => setCellDraftValue(e.target.value)}
                          onBlur={handleCommitEdit}
                          onKeyDown={(e) => handleKeyDown(e, member, 'name')}
                          className="w-full h-full px-3 py-2 text-xs bg-white border-2 border-blue-600 outline-hidden font-medium"
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <span>{member.name}</span>
                          <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      )}
                    </td>

                    {/* Suara Cell (Inline Selectable) */}
                    <td
                      onClick={() => handleStartEdit(member.id, 'voice', member.voice)}
                      className={`py-2 px-3 border-r border-slate-200/80 cursor-pointer relative ${
                        editingCell?.id === member.id && editingCell?.field === 'voice'
                          ? 'p-0 cell-focus'
                          : ''
                      }`}
                    >
                      {editingCell?.id === member.id && editingCell?.field === 'voice' ? (
                        <select
                          ref={inputRef as React.RefObject<HTMLSelectElement>}
                          value={cellDraftValue}
                          onChange={(e) => {
                            setCellDraftValue(e.target.value);
                            onUpdateMember({
                              ...member,
                              voice: e.target.value as VoiceType,
                              updatedAt: new Date().toISOString(),
                            });
                            setEditingCell(null);
                          }}
                          onBlur={handleCommitEdit}
                          className="w-full h-full px-2 py-1.5 text-xs bg-white border-2 border-blue-600 outline-hidden font-semibold"
                        >
                          <option value="Sopran">Sopran</option>
                          <option value="Alto">Alto</option>
                          <option value="Tenor">Tenor</option>
                          <option value="Bass">Bass</option>
                        </select>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${
                              voiceStyles[voice].badge
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${voiceStyles[voice].bg}`}
                            />
                            {voice}
                          </span>
                          <ChevronDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      )}
                    </td>

                    {/* No WhatsApp Cell (Inline Editable + Quick Chat) */}
                    <td
                      onClick={() => handleStartEdit(member.id, 'phone', member.phone)}
                      className={`py-2 px-3 border-r border-slate-200/80 font-mono text-[11px] text-slate-700 cursor-pointer relative ${
                        editingCell?.id === member.id && editingCell?.field === 'phone'
                          ? 'p-0 cell-focus'
                          : ''
                      }`}
                    >
                      {editingCell?.id === member.id && editingCell?.field === 'phone' ? (
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          value={cellDraftValue}
                          onChange={(e) => setCellDraftValue(e.target.value)}
                          onBlur={handleCommitEdit}
                          onKeyDown={(e) => handleKeyDown(e, member, 'phone')}
                          placeholder="0812..."
                          className="w-full h-full px-3 py-2 text-xs font-mono bg-white border-2 border-blue-600 outline-hidden"
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <span>{member.phone || '-'}</span>
                          {member.phone && (
                            <a
                              href={`https://wa.me/${
                                member.phone.startsWith('0')
                                  ? '62' + member.phone.slice(1)
                                  : member.phone.replace(/[^0-9]/g, '')
                              }?text=${encodeURIComponent(
                                `Halo ${member.name}, salam dari tim Paduan Suara!`
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-600 hover:text-emerald-700 p-1 rounded-md hover:bg-emerald-50 transition"
                              title="Kirim pesan WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Email & Status Verifikasi */}
                    <td className="py-2 px-3 border-r border-slate-200/80 text-[11px] font-mono text-slate-700">
                      {member.email ? (
                        <div className="flex items-center gap-1.5">
                          {member.verifiedEmail ? (
                            <span className="p-0.5 bg-emerald-100 text-emerald-700 rounded-md shrink-0" title="Email Terverifikasi">
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="p-0.5 bg-slate-100 text-slate-500 rounded-md shrink-0">
                              <Mail className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span className="truncate max-w-[130px]">{member.email}</span>
                          {member.deviceId && (
                            <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1 py-0.2 rounded font-sans shrink-0" title="Perangkat Terikat (Anti-Titip Absen)">
                              Terkunci
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[10px]">Belum terverifikasi</span>
                      )}
                    </td>

                    {/* Catatan Cell */}
                    <td
                      onClick={() => handleStartEdit(member.id, 'notes', member.notes || '')}
                      className={`py-2 px-3 border-r border-slate-200/80 text-slate-500 cursor-pointer relative text-[11px] ${
                        editingCell?.id === member.id && editingCell?.field === 'notes'
                          ? 'p-0 cell-focus'
                          : ''
                      }`}
                    >
                      {editingCell?.id === member.id && editingCell?.field === 'notes' ? (
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          value={cellDraftValue}
                          onChange={(e) => setCellDraftValue(e.target.value)}
                          onBlur={handleCommitEdit}
                          onKeyDown={(e) => handleKeyDown(e, member, 'notes')}
                          placeholder="Catatan..."
                          className="w-full h-full px-3 py-2 text-xs bg-white border-2 border-blue-600 outline-hidden"
                        />
                      ) : (
                        <span className="truncate block max-w-[200px]">
                          {member.notes || '-'}
                        </span>
                      )}
                    </td>

                    {/* Action Cell */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        {member.deviceId && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Reset kunci perangkat untuk ${member.name}? Anggota ini akan dapat mendaftarkan/mengikat HP baru saat absensi.`)) {
                                await resetMemberBindingAPI(member.id);
                                onUpdateMember({ ...member, deviceId: undefined });
                              }
                            }}
                            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition"
                            title="Reset Kunci Perangkat (Anti-Titip Absen)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onOpenEditModal(member)}
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title="Edit Lengkap"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus ${member.name} dari database?`)) {
                              onDeleteMembers([member.id]);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                          title="Hapus Baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Quick Add Row at Table Bottom (Google Sheets style) */}
              <tr className="bg-slate-50/70 border-t-2 border-slate-200">
                <td className="text-center py-2 px-1 text-slate-400 font-mono text-[11px] border-r border-slate-200 bg-slate-100/50">
                  +
                </td>
                <td className="border-r border-slate-200"></td>
                <td className="py-1 px-2 border-r border-slate-200">
                  <input
                    type="text"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd(e)}
                    placeholder="+ Tambah nama anggota baru..."
                    className="w-full px-2 py-1 text-xs bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded-sm font-medium"
                  />
                </td>
                <td className="py-1 px-2 border-r border-slate-200">
                  <select
                    value={quickVoice}
                    onChange={(e) => setQuickVoice(e.target.value as VoiceType)}
                    className="w-full px-2 py-1 text-xs bg-transparent border-0 font-semibold text-slate-700"
                  >
                    <option value="Sopran">Sopran</option>
                    <option value="Alto">Alto</option>
                    <option value="Tenor">Tenor</option>
                    <option value="Bass">Bass</option>
                  </select>
                </td>
                <td className="py-1 px-2 border-r border-slate-200">
                  <input
                    type="text"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd(e)}
                    placeholder="No WA (0812...)"
                    className="w-full px-2 py-1 text-xs font-mono bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded-sm"
                  />
                </td>
                <td className="py-1 px-2 border-r border-slate-200 text-slate-400 text-[10px] italic">
                  Otomatis terverifikasi via HP
                </td>
                <td className="py-1 px-2 border-r border-slate-200 text-slate-400 text-[11px]">
                  Tekan Enter untuk simpan
                </td>
                <td className="py-1 px-2 text-center">
                  <button
                    type="button"
                    onClick={handleQuickAdd}
                    disabled={!quickName.trim()}
                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg transition"
                  >
                    Simpan
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {sortedMembers.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-sm">Tidak ada data anggota ditemukan</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Coba sesuaikan pencarian atau filter seksi suara
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
