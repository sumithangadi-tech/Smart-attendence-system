import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Users, Download, Trash2,
  Filter, Search, RefreshCw, TrendingUp, Clock, ShieldAlert, Image
} from 'lucide-react';
import { 
  fetchAttendance, fetchStudents, apiDeleteAttendanceRecord, apiClearAllAttendance, fetchProxyLogs 
} from '../lib/apiService';
import { useToast } from '../context/ToastContext';

export default function Dashboard() {
  const { addToast } = useToast();
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [proxyLogs, setProxyLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'proxy'
  const [filterDate, setFilterDate] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, studs, plogs] = await Promise.all([
        fetchAttendance(),
        fetchStudents(),
        fetchProxyLogs()
      ]);
      setRecords(recs);
      setStudents(studs);
      setProxyLogs(plogs);
    } catch (e) {
      addToast({ message: 'Failed to load dashboard data: ' + e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Computed stats
  const today = new Date().toLocaleDateString('en-CA');
  const todayRecords = records.filter((r) => r.date === today);
  const uniqueStudentsToday = new Set(todayRecords.map((r) => r.studentId)).size;
  const totalStudents = students.length;
  const totalProxiesToday = proxyLogs.filter(log => log.timestamp.split('T')[0] === today).length;

  // Filter
  const filteredRecords = records.filter((r) => {
    const dateMatch = filterDate ? r.date === filterDate : true;
    const studentMatch = filterStudent ? r.studentId === filterStudent : true;
    const nameMatch = searchQuery
      ? r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.studentId.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return dateMatch && studentMatch && nameMatch;
  });

  // CSV Export
  function exportCSV() {
    const rows = [['Student ID', 'Name', 'Date', 'Time']];
    filteredRecords.forEach((r) => rows.push([r.studentId, r.name, r.date, r.time]));
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ message: 'CSV exported successfully!', type: 'success' });
  }

  async function handleDeleteRecord(id) {
    try {
      await apiDeleteAttendanceRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      addToast({ message: 'Record deleted.', type: 'info' });
    } catch (e) {
      addToast({ message: 'Failed to delete record: ' + e.message, type: 'error' });
    }
  }

  async function handleClearAll() {
    if (!confirm('Clear ALL attendance records? This cannot be undone.')) return;
    try {
      await apiClearAllAttendance();
      setRecords([]);
      addToast({ message: 'All attendance records cleared.', type: 'warning' });
    } catch (e) {
      addToast({ message: 'Failed to clear records: ' + e.message, type: 'error' });
    }
  }

  const statCards = [
    {
      label: 'Total Records',
      value: records.length,
      icon: LayoutDashboard,
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.1)',
    },
    {
      label: 'Present Today',
      value: uniqueStudentsToday,
      icon: TrendingUp,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.1)',
    },
    {
      label: 'Registered Students',
      value: totalStudents,
      icon: Users,
      color: '#06b6d4',
      bg: 'rgba(6,182,212,0.1)',
    },
    {
      label: 'Proxy Blocked Today',
      value: totalProxiesToday,
      icon: ShieldAlert,
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
    },
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <LayoutDashboard size={20} color="white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9' }}>
            Attendance Dashboard & Admin Monitor
          </h1>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginLeft: '52px' }}>
          View attendance records and monitor real-time anti-proxy liveness detection logs.
        </p>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}
      >
        {statCards.map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="glass-card"
            style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '10px' }}>
        <button
          className={activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('attendance')}
          style={{ padding: '8px 16px', fontSize: '14px' }}
        >
          Attendance Records
        </button>
        <button
          className={activeTab === 'proxy' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setActiveTab('proxy')}
          style={{ padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ShieldAlert size={14} /> Proxy Log Alerts ({proxyLogs.length})
        </button>
      </div>

      {activeTab === 'attendance' ? (
        /* Filters + Table */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card"
          style={{ padding: '28px' }}
        >
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                id="search-attendance-input"
                className="input-field"
                placeholder="Search name or ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>

            {/* Date filter */}
            <div style={{ position: 'relative', minWidth: '160px' }}>
              <Calendar size={14} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                id="filter-date-input"
                type="date"
                className="input-field"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ paddingLeft: '36px', colorScheme: 'dark' }}
              />
            </div>

            {/* Student filter */}
            <select
              id="filter-student-select"
              className="input-field"
              value={filterStudent}
              onChange={(e) => setFilterStudent(e.target.value)}
              style={{ minWidth: '160px', background: 'rgba(255,255,255,0.05)', cursor: 'pointer' }}
            >
              <option value="">All Students</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Actions */}
            <button
              id="refresh-btn"
              className="btn-secondary"
              onClick={loadData}
              style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <RefreshCw size={14} /> Refresh
            </button>

            {filterDate || filterStudent || searchQuery ? (
              <button
                className="btn-secondary"
                onClick={() => { setFilterDate(''); setFilterStudent(''); setSearchQuery(''); }}
                style={{ padding: '12px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Filter size={14} /> Clear
              </button>
            ) : null}

            <button
              id="export-csv-btn"
              className="btn-primary"
              onClick={exportCSV}
              disabled={filteredRecords.length === 0}
              style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <Download size={14} /> Export CSV
            </button>

            {records.length > 0 && (
              <button
                id="clear-all-btn"
                className="btn-danger"
                onClick={handleClearAll}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              >
                <Trash2 size={14} /> Clear All
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              <RefreshCw size={28} className="animate-spin" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
              <Calendar size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
              <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#64748b' }}>
                No attendance records found
              </p>
              <p style={{ fontSize: '13px' }}>
                {records.length === 0 ? 'Use the Scanner to mark attendance.' : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['#', 'Student', 'Student ID', 'Date', 'Time', 'Status', ''].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 16px', textAlign: 'left',
                          fontSize: '11px', fontWeight: 600, color: '#64748b',
                          textTransform: 'uppercase', letterSpacing: '0.7px',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredRecords.map((rec, i) => (
                      <motion.tr
                        key={rec.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569' }}>
                          {filteredRecords.length - i}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {rec.avatar ? (
                              <img src={rec.avatar} alt={rec.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(99,102,241,0.3)' }} />
                            ) : (
                              <div
                                style={{
                                  width: '32px', height: '32px', borderRadius: '50%',
                                  background: 'rgba(99,102,241,0.2)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '12px', fontWeight: 700, color: '#818cf8', flexShrink: 0,
                                }}
                              >
                                {rec.name.charAt(0)}
                              </div>
                            )}
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{rec.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {rec.studentId}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#94a3b8' }}>
                          {rec.date === today ? (
                            <span style={{ color: '#22d3ee', fontWeight: 600 }}>Today</span>
                          ) : rec.date}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {rec.time}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="badge badge-success">Present</span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={() => handleDeleteRecord(rec.id)}
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: '#334155', padding: '6px', borderRadius: '6px',
                              transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#334155'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '12px', color: '#475569' }}>
                Showing {filteredRecords.length} of {records.length} records
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        /* Proxy Log alerts */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card"
          style={{ padding: '28px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#ef4444" /> Suspicious Spoofing / Proxy Attempt Logs
            </h2>
            <button className="btn-secondary" onClick={loadData} style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={12} /> Reload Logs
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <RefreshCw size={24} className="animate-spin" color="#ef4444" />
            </div>
          ) : proxyLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
              <CheckCircle size={48} style={{ margin: '0 auto 16px', color: '#10b981', opacity: 0.4 }} />
              <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#64748b' }}>
                No proxy attempts detected
              </p>
              <p style={{ fontSize: '13px' }}>
                The liveness verification system has blocked 0 proxy attempts so far.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {proxyLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="glass-card" 
                  style={{ 
                    overflow: 'hidden', 
                    border: '1px solid rgba(239, 68, 68, 0.25)', 
                    background: 'rgba(239, 68, 68, 0.02)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ position: 'relative', height: '180px', background: '#0a0d14' }}>
                    <img 
                      src={log.imageUrl} 
                      alt="Suspicious Face" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div 
                      style={{ 
                        position: 'absolute', 
                        bottom: '10px', 
                        left: '10px', 
                        background: 'rgba(220, 38, 38, 0.85)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}
                    >
                      BLOCKED PROXY
                    </div>
                  </div>
                  <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>
                      {log.reason}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      <strong>Time:</strong> {new Date(log.timestamp).toLocaleString()}
                    </div>
                    {log.detectedStudentId && (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        <strong>Matched Target:</strong> {log.detectedStudentId}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
