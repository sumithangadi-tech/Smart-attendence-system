const API_BASE = 'http://localhost:5000/api';

export async function fetchStudents() {
  const res = await fetch(`${API_BASE}/students`);
  if (!res.ok) throw new Error('Failed to fetch students');
  return res.json();
}

export async function apiRegisterStudent(id, name, images) {
  const res = await fetch(`${API_BASE}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, images }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to register student');
  return data;
}

export async function apiDeleteStudent(id) {
  const res = await fetch(`${API_BASE}/students/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete student');
  return data;
}

export async function fetchAttendance() {
  const res = await fetch(`${API_BASE}/attendance`);
  if (!res.ok) throw new Error('Failed to fetch attendance logs');
  return res.json();
}

export async function apiDeleteAttendanceRecord(id) {
  const res = await fetch(`${API_BASE}/attendance/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete record');
  return data;
}

export async function apiClearAllAttendance() {
  const res = await fetch(`${API_BASE}/attendance/clear`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to clear records');
  return data;
}

export async function fetchProxyLogs() {
  const res = await fetch(`${API_BASE}/proxy_logs`);
  if (!res.ok) throw new Error('Failed to fetch proxy logs');
  return res.json();
}

export async function apiResetLiveness() {
  await fetch(`${API_BASE}/reset_liveness`, { method: 'POST' });
}

export async function apiStopScanning() {
  await fetch(`${API_BASE}/stop_scanning`, { method: 'POST' });
}

export async function fetchBackendStatus() {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) return { status: 'idle' };
  return res.json();
}
