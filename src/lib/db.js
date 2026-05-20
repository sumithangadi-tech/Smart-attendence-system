import { openDB } from 'idb';

const DB_NAME = 'SmartAttendanceDB';
const DB_VERSION = 1;

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Students store
        if (!db.objectStoreNames.contains('students')) {
          const studentStore = db.createObjectStore('students', { keyPath: 'id' });
          studentStore.createIndex('name', 'name', { unique: false });
        }
        // Attendance store
        if (!db.objectStoreNames.contains('attendance')) {
          const attendanceStore = db.createObjectStore('attendance', {
            keyPath: 'id',
            autoIncrement: true,
          });
          attendanceStore.createIndex('studentId', 'studentId', { unique: false });
          attendanceStore.createIndex('date', 'date', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

// ---- Students ----

export async function saveStudent(student) {
  const db = await getDB();
  // Convert Float32Array descriptors to regular arrays for storage
  const storable = {
    ...student,
    faceDescriptors: student.faceDescriptors.map((d) =>
      Array.from(d)
    ),
  };
  await db.put('students', storable);
}

export async function getAllStudents() {
  const db = await getDB();
  const students = await db.getAll('students');
  // Convert arrays back to Float32Array
  return students.map((s) => ({
    ...s,
    faceDescriptors: s.faceDescriptors.map((d) => new Float32Array(d)),
  }));
}

export async function getStudentById(id) {
  const db = await getDB();
  const student = await db.get('students', id);
  if (!student) return null;
  return {
    ...student,
    faceDescriptors: student.faceDescriptors.map((d) => new Float32Array(d)),
  };
}

export async function deleteStudent(id) {
  const db = await getDB();
  await db.delete('students', id);
}

// ---- Attendance ----

export async function saveAttendance(record) {
  const db = await getDB();
  return db.add('attendance', record);
}

export async function getAllAttendance() {
  const db = await getDB();
  return db.getAll('attendance');
}

export async function hasAttendanceToday(studentId) {
  const db = await getDB();
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const all = await db.getAllFromIndex('attendance', 'studentId', studentId);
  return all.some((r) => r.date === today);
}

export async function deleteAttendanceRecord(id) {
  const db = await getDB();
  await db.delete('attendance', id);
}

export async function clearAllAttendance() {
  const db = await getDB();
  await db.clear('attendance');
}
