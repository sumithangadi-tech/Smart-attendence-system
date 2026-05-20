import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle, UserX, Zap, AlertTriangle, Loader, Users, RefreshCw } from 'lucide-react';
import { 
  fetchStudents, fetchAttendance, apiStopScanning, apiResetLiveness, fetchBackendStatus 
} from '../lib/apiService';
import { useToast } from '../context/ToastContext';

const STATUS_POLL_INTERVAL_MS = 600;

export default function Attendance() {
  const { addToast } = useToast();
  const pollIntervalRef = useRef(null);

  const [students, setStudents] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'blink' | 'turn_left' | 'turn_right' | 'verified' | 'matched' | 'unknown' | 'proxy'
  const [matchedStudentName, setMatchedStudentName] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [recentRecords, setRecentRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [studs, records] = await Promise.all([fetchStudents(), fetchAttendance()]);
      setStudents(studs);
      
      const today = new Date().toLocaleDateString('en-CA');
      const todayRecords = records.filter(r => r.date === today);
      setTodayCount(todayRecords.length);
      setRecentRecords(records.slice(0, 5));
    } catch (e) {
      addToast({ message: 'Failed to load backend data: ' + e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
    return () => {
      stopScanning();
    };
  }, []);

  const stopScanning = useCallback(async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setScanning(false);
    setScanStatus('idle');
    setMatchedStudentName('');
    try {
      await apiStopScanning();
    } catch (e) {
      console.error(e);
    }
  }, []);

  const doPollStatus = useCallback(async () => {
    try {
      const data = await fetchBackendStatus();
      const newStatus = data.status; // 'idle' | 'blink' | 'turn_left' | 'turn_right' | 'verified' | 'matched' | 'unknown' | 'proxy'
      
      if (newStatus !== scanStatus) {
        setScanStatus(newStatus);
        
        if (newStatus === 'matched') {
          const name = data.student_name || 'Student';
          setMatchedStudentName(name);
          addToast({ message: `✓ Attendance marked for ${name}`, type: 'success' });
          loadData(); // Refresh logs
          
          // Hold the matched screen for 3 seconds, then reset liveness to scan again
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setTimeout(async () => {
            await apiResetLiveness();
            setMatchedStudentName('');
            setScanStatus('idle');
            // Resume polling if still scanning
            if (scanning) {
              pollIntervalRef.current = setInterval(doPollStatus, STATUS_POLL_INTERVAL_MS);
            }
          }, 3500);
        } else if (newStatus === 'proxy') {
          addToast({ message: `⚠ Proxy Attempt Detected! Suspicious photo/video rejected.`, type: 'error' });
          
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setTimeout(async () => {
            await apiResetLiveness();
            setScanStatus('idle');
            if (scanning) {
              pollIntervalRef.current = setInterval(doPollStatus, STATUS_POLL_INTERVAL_MS);
            }
          }, 3500);
        } else if (newStatus === 'unknown') {
          addToast({ message: `✗ Unknown face detected. Attendance rejected.`, type: 'error' });
          
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setTimeout(async () => {
            await apiResetLiveness();
            setScanStatus('idle');
            if (scanning) {
              pollIntervalRef.current = setInterval(doPollStatus, STATUS_POLL_INTERVAL_MS);
            }
          }, 3500);
        }
      }
    } catch (e) {
      console.error("Status poll error:", e);
    }
  }, [scanStatus, scanning, addToast, loadData]);

  const startScanning = useCallback(async () => {
    if (students.length === 0) {
      addToast({ message: 'No students registered. Please register first.', type: 'warning' });
      return;
    }
    setScanning(true);
    setScanStatus('scanning');
    setMatchedStudentName('');
    
    // Reset liveness tracker first
    try {
      await apiResetLiveness();
    } catch (e) {
      console.error(e);
    }
    
    // Start polling status
    pollIntervalRef.current = setInterval(doPollStatus, STATUS_POLL_INTERVAL_MS);
  }, [students, doPollStatus, addToast]);

  const statusConfig = {
    idle: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Ready to scan', icon: Camera },
    scanning: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', label: 'Initializing Camera…', icon: Zap },
    blink: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Step 1: Blink your eyes', icon: AlertTriangle },
    turn_left: { color: '#818cf8', bg: 'rgba(129,140,248,0.1)', label: 'Step 2: Turn head left', icon: Zap },
    turn_right: { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', label: 'Step 3: Turn head right', icon: Zap },
    verified: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', label: 'Liveness Verified! Matching...', icon: CheckCircle },
    matched: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Face Matched!', icon: CheckCircle },
    unknown: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Unknown Person', icon: UserX },
    proxy: { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', label: 'Proxy Attempt Detected!', icon: AlertTriangle },
  };

  const sConfig = statusConfig[scanStatus] || statusConfig.idle;
  const StatusIcon = sConfig.icon;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Camera size={20} color="white" />
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9' }}>
                Attendance Scanner (Liveness Enabled)
              </h1>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginLeft: '52px' }}>
              Anti-proxy face verification requiring live eye blinks and head movements.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#22d3ee' }}>{todayCount}</div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today</div>
            </div>
            <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#818cf8' }}>{students.length}</div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registered</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px' }}>
        {/* Webcam Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card"
          style={{ padding: '24px' }}
        >
          {/* Status Bar */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: '16px', padding: '10px 16px', borderRadius: '10px',
              background: sConfig.bg, border: `1px solid ${sConfig.color}33`,
              transition: 'all 0.4s ease',
            }}
          >
            <StatusIcon size={16} color={sConfig.color} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: sConfig.color }}>
              {sConfig.label}
            </span>
            {scanStatus === 'matched' && matchedStudentName && (
              <span style={{ fontSize: '13px', color: '#94a3b8', marginLeft: 'auto' }}>
                — {matchedStudentName}
              </span>
            )}
          </div>

          {/* Camera Feed */}
          <div
            style={{
              position: 'relative', borderRadius: '14px', overflow: 'hidden',
              background: '#070b14', marginBottom: '20px', height: '320px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {scanning ? (
              <img
                src="http://localhost:5000/api/video_feed"
                alt="Webcam stream from Flask"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  addToast({ message: "Could not connect to Python webcam feed. Make sure the backend server is running.", type: 'error' });
                  stopScanning();
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#475569' }}>
                <Camera size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <p style={{ fontSize: '14px' }}>Camera is offline</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Click Start Scanning to initialize camera</p>
              </div>
            )}
            
            <div className="corner-tl" />
            <div className="corner-tr" />
            <div className="corner-bl" />
            <div className="corner-br" />

            {scanning && scanStatus === 'scanning' && (
              <div
                style={{
                  position: 'absolute', inset: 0, background: 'rgba(7,11,20,0.85)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
                }}
              >
                <RefreshCw size={28} color="#6366f1" className="animate-spin" />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Starting camera & loading models…</span>
              </div>
            )}

            {scanning && scanStatus !== 'scanning' && <div className="scan-line" />}

            {/* Overlay on match */}
            <AnimatePresence>
              {scanStatus === 'matched' && matchedStudentName && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(16,185,129,0.12)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '12px',
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    style={{
                      width: '70px', height: '70px', borderRadius: '50%',
                      background: 'rgba(16,185,129,0.25)', border: '2px solid #10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <CheckCircle size={36} color="#10b981" />
                  </motion.div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#34d399' }}>
                      {matchedStudentName}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6ee7b7' }}>Attendance Marked</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Overlay on proxy warning */}
            <AnimatePresence>
              {scanStatus === 'proxy' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(239,68,68,0.15)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '12px',
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    style={{
                      width: '70px', height: '70px', borderRadius: '50%',
                      background: 'rgba(239,68,68,0.25)', border: '2px solid #ef4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <AlertTriangle size={36} color="#ef4444" />
                  </motion.div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#f87171' }}>
                      PROXY BLOCKED
                    </div>
                    <div style={{ fontSize: '13px', color: '#fca5a5' }}>Real Person Required</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {!scanning ? (
              <button
                id="start-scanning-btn"
                className="btn-primary"
                onClick={startScanning}
                disabled={loading}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Zap size={16} /> Start Scanning
              </button>
            ) : (
              <button
                id="stop-scanning-btn"
                className="btn-secondary"
                onClick={stopScanning}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Camera size={16} /> Stop Camera
              </button>
            )}
          </div>
        </motion.div>

        {/* Right Panel: Recent Marks + Registered List */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          {/* Recent Marks */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} color="#10b981" /> Recent Marks
            </h3>
            {recentRecords.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                No attendance marked yet this session.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <AnimatePresence>
                  {recentRecords.map((rec, i) => (
                    <motion.div
                      key={`${rec.studentId}-${rec.time}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '10px',
                        background: 'rgba(16,185,129,0.06)',
                        border: '1px solid rgba(16,185,129,0.15)',
                      }}
                    >
                      {rec.avatar ? (
                        <img src={rec.avatar} alt={rec.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div
                          style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'rgba(99,102,241,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700, color: '#c7d2fe',
                          }}
                        >
                          {rec.name.charAt(0)}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{rec.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{rec.time}</div>
                      </div>
                      <span className="badge badge-success">✓</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Registered Students */}
          <div className="glass-card" style={{ padding: '24px', flex: 1 }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="#818cf8" /> Registered ({students.length})
            </h3>
            {students.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                No students registered yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {students.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'rgba(99,102,241,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700,
                        color: '#818cf8',
                      }}
                    >
                      {s.name.charAt(0)}
                    </div>
                    <span style={{ fontSize: '13px', color: '#94a3b8', flex: 1 }}>{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
