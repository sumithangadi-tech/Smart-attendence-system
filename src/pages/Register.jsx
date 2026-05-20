import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Camera, CheckCircle, Trash2, AlertCircle, Loader } from 'lucide-react';
import { fetchStudents, apiRegisterStudent, apiDeleteStudent } from '../lib/apiService';
import { useToast } from '../context/ToastContext';

const videoConstraints = {
  width: 480,
  height: 360,
  facingMode: 'user',
};

export default function Register() {
  const { addToast } = useToast();
  const webcamRef = useRef(null);

  const [form, setForm] = useState({ id: '', name: '' });
  const [formErrors, setFormErrors] = useState({});
  const [capturing, setCapturing] = useState(false);
  const [samplePreviews, setSamplePreviews] = useState([]); // array of base64 image strings
  const [step, setStep] = useState('form'); // 'form' | 'capture' | 'done'
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [savingStudent, setSavingStudent] = useState(false);

  useEffect(() => {
    refreshStudents();
  }, []);

  async function refreshStudents() {
    setLoadingStudents(true);
    try {
      const all = await fetchStudents();
      setStudents(all);
    } catch (e) {
      addToast({ message: 'Failed to load students: ' + e.message, type: 'error' });
    } finally {
      setLoadingStudents(false);
    }
  }

  function validateForm() {
    const errs = {};
    if (!form.id.trim()) errs.id = 'Student ID is required';
    if (!form.name.trim()) errs.name = 'Name is required';
    if (students.some((s) => s.id === form.id.trim()))
      errs.id = 'Student ID already registered';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleFormNext(e) {
    e.preventDefault();
    if (validateForm()) setStep('capture');
  }

  const captureOneSample = useCallback(async () => {
    if (!webcamRef.current) return;
    setCapturing(true);
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        addToast({ message: 'Failed to capture screenshot. Check webcam.', type: 'warning' });
        setCapturing(false);
        return;
      }
      
      setSamplePreviews((prev) => [...prev, imageSrc]);
      addToast({ message: `Sample ${samplePreviews.length + 1} captured!`, type: 'success' });
    } catch (err) {
      addToast({ message: 'Capture failed: ' + err.message, type: 'error' });
    } finally {
      setCapturing(false);
    }
  }, [webcamRef, samplePreviews.length, addToast]);

  async function handleRegister() {
    if (samplePreviews.length < 1) {
      addToast({ message: 'Please capture at least 1 face sample.', type: 'warning' });
      return;
    }
    setSavingStudent(true);
    try {
      await apiRegisterStudent(
        form.id.trim(),
        form.name.trim(),
        samplePreviews
      );
      addToast({ message: `${form.name} registered successfully!`, type: 'success' });
      setStep('done');
      refreshStudents();
    } catch (err) {
      addToast({ message: 'Failed to save student: ' + err.message, type: 'error' });
    } finally {
      setSavingStudent(false);
    }
  }

  function handleReset() {
    setForm({ id: '', name: '' });
    setFormErrors({});
    setSamplePreviews([]);
    setStep('form');
  }

  async function handleDeleteStudent(student) {
    if (!confirm(`Remove ${student.name} from the system?`)) return;
    try {
      await apiDeleteStudent(student.id);
      addToast({ message: `${student.name} removed.`, type: 'info' });
      refreshStudents();
    } catch (e) {
      addToast({ message: 'Deletion failed: ' + e.message, type: 'error' });
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '32px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <UserPlus size={20} color="white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9' }}>
            Student Registration
          </h1>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginLeft: '52px' }}>
          Register students by capturing their face samples for recognition.
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left: Registration Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card"
          style={{ padding: '28px' }}
        >
          <AnimatePresence mode="wait">
            {step === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0', marginBottom: '24px' }}>
                  Student Details
                </h2>
                <form onSubmit={handleFormNext} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label className="input-label">Student ID</label>
                    <input
                      id="student-id-input"
                      className="input-field"
                      placeholder="e.g. STU2024001"
                      value={form.id}
                      onChange={(e) => setForm({ ...form, id: e.target.value })}
                    />
                    {formErrors.id && (
                      <p style={{ color: '#f87171', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} /> {formErrors.id}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="input-label">Full Name</label>
                    <input
                      id="student-name-input"
                      className="input-field"
                      placeholder="e.g. Jane Doe"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    {formErrors.name && (
                      <p style={{ color: '#f87171', fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} /> {formErrors.name}
                      </p>
                    )}
                  </div>
                  <button
                    id="next-to-capture-btn"
                    type="submit"
                    className="btn-primary"
                    style={{ marginTop: '8px' }}
                  >
                    Continue to Face Capture →
                  </button>
                </form>
              </motion.div>
            )}

            {step === 'capture' && (
              <motion.div
                key="capture"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
                    Capture Face Samples
                  </h2>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    for <strong style={{ color: '#c7d2fe' }}>{form.name}</strong>
                  </span>
                </div>

                {/* Webcam */}
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', background: '#0d1424' }}>
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    style={{ width: '100%', height: '240px', objectFit: 'cover', display: 'block' }}
                  />
                  <div className="corner-tl" /><div className="corner-tr" />
                  <div className="corner-bl" /><div className="corner-br" />
                  {capturing && <div className="scan-line" />}
                  <div
                    style={{
                      position: 'absolute', top: '10px', right: '10px',
                      background: 'rgba(0,0,0,0.5)', borderRadius: '8px',
                      padding: '4px 10px', fontSize: '12px', color: '#94a3b8',
                    }}
                  >
                    {samplePreviews.length} / 3 samples
                  </div>
                </div>

                {/* Previews */}
                {samplePreviews.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {samplePreviews.map((src, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{
                          width: '56px', height: '56px', borderRadius: '10px',
                          overflow: 'hidden', border: '2px solid rgba(99,102,241,0.5)',
                        }}
                      >
                        <img src={src} alt={`sample ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </motion.div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    id="capture-sample-btn"
                    className="btn-primary"
                    onClick={captureOneSample}
                    disabled={capturing || samplePreviews.length >= 3}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {capturing ? <Loader size={16} className="animate-spin" /> : <Camera size={16} />}
                    {capturing ? 'Detecting…' : samplePreviews.length >= 3 ? 'Max Samples Captured' : 'Capture Sample'}
                  </button>

                  {samplePreviews.length > 0 && (
                    <button
                      id="register-student-btn"
                      className="btn-secondary"
                      onClick={handleRegister}
                      disabled={savingStudent}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {savingStudent ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                      {savingStudent ? 'Saving & Generating Embeddings…' : 'Complete Registration'}
                    </button>
                  )}
                  <button className="btn-secondary" onClick={() => setStep('form')} style={{ fontSize: '13px', padding: '10px' }}>
                    ← Back
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div
                key="done"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ textAlign: 'center', padding: '20px 0' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  style={{
                    width: '72px', height: '72px', borderRadius: '50%',
                    background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}
                >
                  <CheckCircle size={36} color="#10b981" />
                </motion.div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>
                  Registration Successful!
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
                  <strong style={{ color: '#e2e8f0' }}>{form.name}</strong> has been registered with {samplePreviews.length} face sample{samplePreviews.length !== 1 ? 's' : ''}.
                </p>
                <button id="register-another-btn" className="btn-primary" onClick={handleReset}>
                  Register Another Student
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Right: Registered Students List */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card"
          style={{ padding: '28px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
              Registered Students
            </h2>
            <span className="badge badge-info">{students.length} total</span>
          </div>

          {loadingStudents ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <Loader size={24} className="animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#475569' }}>
              <UserPlus size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '14px' }}>No students registered yet.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Register a student using the form.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '440px', overflowY: 'auto' }}>
              <AnimatePresence>
                {students.map((student, i) => (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {student.avatar ? (
                      <img
                        src={student.avatar}
                        alt={student.name}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(99,102,241,0.4)' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          background: `hsl(${parseInt(student.id, 36) % 360}, 60%, 40%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '14px', fontWeight: 700,
                        }}
                      >
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {student.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {student.id}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteStudent(student)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569', padding: '6px', borderRadius: '8px', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.target.style.color = '#475569'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
