import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'attendance.db')

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Students table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            registered_at TEXT NOT NULL,
            avatar_path TEXT
        )
    ''')
    
    # Attendance table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
        )
    ''')
    
    # Proxy Logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS proxy_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            image_path TEXT NOT NULL,
            detected_student_id TEXT,
            reason TEXT NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()

# --- Student CRUD ---

def save_student(student_id, name, avatar_path=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    registered_at = datetime.now().isoformat()
    try:
        cursor.execute(
            "INSERT OR REPLACE INTO students (id, name, registered_at, avatar_path) VALUES (?, ?, ?, ?)",
            (student_id, name, registered_at, avatar_path)
        )
        conn.commit()
        return True
    except Exception as e:
        print("Error saving student:", e)
        return False
    finally:
        conn.close()

def get_all_students():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM students")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_student_by_id(student_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM students WHERE id = ?", (student_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_student(student_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM students WHERE id = ?", (student_id,))
        conn.commit()
        return True
    except Exception as e:
        print("Error deleting student:", e)
        return False
    finally:
        conn.close()

# --- Attendance CRUD ---

def save_attendance(student_id, name, status="Present"):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now()
    date_str = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%I:%M:%S %p')
    
    # Check if already marked today
    cursor.execute("SELECT id FROM attendance WHERE student_id = ? AND date = ?", (student_id, date_str))
    if cursor.fetchone():
        conn.close()
        return False, "Already marked today"
        
    try:
        cursor.execute(
            "INSERT INTO attendance (student_id, name, date, time, status) VALUES (?, ?, ?, ?, ?)",
            (student_id, name, date_str, time_str, status)
        )
        conn.commit()
        return True, "Success"
    except Exception as e:
        print("Error saving attendance:", e)
        return False, str(e)
    finally:
        conn.close()

def get_all_attendance():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM attendance ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def has_attendance_today(student_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    today = datetime.now().strftime('%Y-%m-%d')
    cursor.execute("SELECT id FROM attendance WHERE student_id = ? AND date = ?", (student_id, today))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def delete_attendance_record(record_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM attendance WHERE id = ?", (record_id,))
        conn.commit()
        return True
    except Exception as e:
        print("Error deleting attendance record:", e)
        return False
    finally:
        conn.close()

def clear_all_attendance():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM attendance")
        conn.commit()
        return True
    except Exception as e:
        print("Error clearing attendance:", e)
        return False
    finally:
        conn.close()

# --- Proxy Logs CRUD ---

def log_proxy_attempt(image_path, detected_student_id=None, reason="Spoofing Detected"):
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    try:
        cursor.execute(
            "INSERT INTO proxy_logs (timestamp, image_path, detected_student_id, reason) VALUES (?, ?, ?, ?)",
            (timestamp, image_path, detected_student_id, reason)
        )
        conn.commit()
        return True
    except Exception as e:
        print("Error logging proxy attempt:", e)
        return False
    finally:
        conn.close()

def get_all_proxy_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM proxy_logs ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
