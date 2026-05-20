import os
import cv2
import numpy as np
import base64
from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from datetime import datetime

# Import local modules
from database import (
    init_db, save_student, get_all_students, delete_student,
    save_attendance, get_all_attendance, delete_attendance_record,
    clear_all_attendance, log_proxy_attempt, get_all_proxy_logs
)
from liveness import LivenessDetector
from recognition import register_student_face, delete_student_face, recognize_face, retrain_lbph_model

app = Flask(__name__)
CORS(app)

# Ensure directories exist
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BACKEND_DIR, 'data')
FACES_DIR = os.path.join(DATA_DIR, 'faces')
PROXY_LOGS_DIR = os.path.join(BACKEND_DIR, 'logs', 'proxy_attempts')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(FACES_DIR, exist_ok=True)
os.makedirs(PROXY_LOGS_DIR, exist_ok=True)

# Initialize DB
init_db()

# Train LBPH on start if there are already registered students
try:
    retrain_lbph_model()
except Exception as e:
    print("[WARNING] Could not retrain LBPH on startup:", e)

# Initialize OpenCV Cascades
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

# Global state
camera = None
liveness_detector = LivenessDetector()

scanning_active = False
current_status = "idle"  # 'idle' | 'blink' | 'turn_left' | 'turn_right' | 'verified' | 'matched' | 'proxy' | 'unknown'
matched_student_name = ""

def get_camera():
    global camera
    if camera is None or not camera.isOpened():
        for idx in [0, 1, 2]:
            camera = cv2.VideoCapture(idx)
            if camera.isOpened():
                print(f"[INFO] Camera initialized on index {idx}")
                break
    return camera

def release_camera():
    global camera
    if camera is not None:
        camera.release()
        camera = None
        print("[INFO] Camera released.")

def generate_frames():
    global current_status, matched_student_name, scanning_active
    
    cam = get_camera()
    if cam is None or not cam.isOpened():
        print("[ERROR] Failed to open webcam.")
        return
        
    liveness_detector.reset()
    current_status = "idle"
    matched_student_name = ""
    
    # Track time for proxy timeouts
    face_detected_start = None
    proxy_logged = False
    
    while scanning_active:
        success, frame = cam.read()
        if not success:
            break
            
        # Flip frame horizontally for natural mirror effect
        frame = cv2.flip(frame, 1)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(100, 100))
        
        if len(faces) == 0:
            face_detected_start = None
            proxy_logged = False
            if current_status not in ["matched", "proxy", "unknown"]:
                current_status = "idle"
                liveness_detector.reset()
                
            # Draw standard UI on idle frame
            cv2.putText(frame, "Align your face in the camera", (150, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        else:
            # Process first face
            (x, y, w, h) = faces[0]
            
            # Start timer for proxy detection
            if face_detected_start is None:
                face_detected_start = datetime.now()
                
            # Check liveness status
            if current_status not in ["matched", "proxy", "unknown"]:
                stage, instruction, is_verified = liveness_detector.process_frame(gray, (x, y, w, h))
                current_status = stage
                
                # Check proxy timeout (static face for more than 7 seconds without completing stages)
                time_diff = (datetime.now() - face_detected_start).total_seconds()
                if time_diff > 7.0 and not is_verified and not proxy_logged:
                    current_status = "proxy"
                    proxy_logged = True
                    # Capture proxy frame
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    img_name = f"proxy_{timestamp}.jpg"
                    img_path = os.path.join(PROXY_LOGS_DIR, img_name)
                    cv2.imwrite(img_path, frame)
                    # Log in db
                    log_proxy_attempt(f"/logs/proxy_attempts/{img_name}", reason="Proxy Attempt: Landmark Liveness Timeout")
                
                # If verified, trigger face recognition
                if is_verified:
                    current_status = "verified"
                    # Crop face for recognition
                    face_crop = frame[y:y+h, x:x+w]
                    
                    # Recognize face
                    student_id, confidence = recognize_face(face_crop)
                    
                    if student_id:
                        # Fetch student details
                        students = get_all_students()
                        student_obj = next((s for s in students if s['id'] == student_id), None)
                        
                        if student_obj:
                            matched_student_name = student_obj['name']
                            # Mark attendance
                            success, msg = save_attendance(student_id, matched_student_name)
                            if success:
                                current_status = "matched"
                            else:
                                if msg == "Already marked today":
                                    current_status = "matched" # Still show matched
                        else:
                            current_status = "unknown"
                    else:
                        current_status = "unknown"
                        # Save unknown proxy attempt
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        img_name = f"unknown_{timestamp}.jpg"
                        img_path = os.path.join(PROXY_LOGS_DIR, img_name)
                        cv2.imwrite(img_path, frame)
                        log_proxy_attempt(f"/logs/proxy_attempts/{img_name}", reason="Proxy Attempt: Unknown Face")
            
            # --- Draw HUD Interface based on status ---
            color = (255, 255, 255)
            text = "Processing..."
            
            if current_status == "blink":
                color = (245, 158, 11)  # Amber
                text = "LIVENESS: Blink your eyes"
                
                # Optional: draw eye region box
                ey_start = y + int(h * 0.15)
                ey_height = int(h * 0.4)
                cv2.rectangle(frame, (x, ey_start), (x+w, ey_start+ey_height), (0, 255, 255), 1)
                
            elif current_status == "turn_left":
                color = (99, 102, 241)  # Indigo
                text = "LIVENESS: Turn head LEFT"
            elif current_status == "turn_right":
                color = (6, 182, 212)   # Cyan
                text = "LIVENESS: Turn head RIGHT"
            elif current_status == "verified":
                color = (139, 92, 246)  # Purple
                text = "LIVENESS VERIFIED! Matching..."
            elif current_status == "matched":
                color = (16, 185, 129)  # Green
                text = f"MATCHED: {matched_student_name}"
            elif current_status == "unknown":
                color = (239, 68, 68)   # Red
                text = "REJECTED: Unknown student"
            elif current_status == "proxy":
                color = (220, 38, 38)   # Deep Red
                text = "PROXY DETECTED: Anti-Spoof Block!"
                
            # Draw Face Bounding Box
            cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
            
            # Draw Text HUD
            cv2.rectangle(frame, (10, 10), (630, 50), (0, 0, 0), -1) # Dark HUD background
            cv2.putText(frame, text, (20, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

        # Encode frame as JPEG
        ret, jpeg = cv2.imencode('.jpg', frame)
        if not ret:
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')

# --- API Endpoints ---

@app.route('/api/video_feed')
def video_feed():
    global scanning_active
    scanning_active = True
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/stop_scanning', methods=['POST'])
def stop_scanning():
    global scanning_active
    scanning_active = False
    release_camera()
    return jsonify({"status": "success", "message": "Scanning stopped and camera released"})

@app.route('/api/status', methods=['GET'])
def get_status():
    global current_status, matched_student_name
    return jsonify({
        "status": current_status,
        "student_name": matched_student_name
    })

@app.route('/api/reset_liveness', methods=['POST'])
def reset_liveness():
    global current_status, matched_student_name
    liveness_detector.reset()
    current_status = "idle"
    matched_student_name = ""
    return jsonify({"status": "success"})

# --- Student Routes ---

@app.route('/api/students', methods=['GET'])
def list_students():
    students = get_all_students()
    formatted = []
    for s in students:
        avatar = None
        if s['avatar_path']:
            full_avatar_path = os.path.join(BACKEND_DIR, s['avatar_path'].lstrip('/'))
            if os.path.exists(full_avatar_path):
                with open(full_avatar_path, "rb") as image_file:
                    avatar = "data:image/jpeg;base64," + base64.b64encode(image_file.read()).decode('utf-8')
                
        formatted.append({
            "id": s['id'],
            "name": s['name'],
            "registeredAt": s['registered_at'],
            "avatar": avatar,
            "faceDescriptors": [[]]
        })
    return jsonify(formatted)

@app.route('/api/students', methods=['POST'])
def register_student():
    data = request.json
    student_id = data.get('id')
    name = data.get('name')
    image_data_list = data.get('images', [])
    
    if not student_id or not name or not image_data_list:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400
        
    avatar_relative_path = None
    
    try:
        for idx, img_b64 in enumerate(image_data_list):
            if ',' in img_b64:
                img_b64 = img_b64.split(',')[1]
                
            img_bytes = base64.b64decode(img_b64)
            
            temp_img_name = f"{student_id}_{idx}.jpg"
            temp_img_path = os.path.join(FACES_DIR, temp_img_name)
            with open(temp_img_path, 'wb') as f:
                f.write(img_bytes)
                
            if idx == 0:
                avatar_relative_path = f"/data/faces/{temp_img_name}"
                
        # Register in recognition module (retrains LBPH recognizer)
        success, msg = register_student_face(student_id, None)
        
        if not success:
            return jsonify({"status": "error", "message": f"Registration failed: {msg}"}), 400
            
        # Save to SQLite database
        success = save_student(student_id, name, avatar_relative_path)
        if success:
            return jsonify({"status": "success", "message": "Student registered successfully!"})
        else:
            return jsonify({"status": "error", "message": "Failed to save student record to database"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": f"Exception during registration: {str(e)}"}), 500

@app.route('/api/students/<student_id>', methods=['DELETE'])
def remove_student(student_id):
    student = get_all_students()
    student_obj = next((s for s in student if s['id'] == student_id), None)
    
    if student_obj:
        # Delete recognition embedding / mapping
        delete_student_face(student_id)
        
        # Clean up saved files
        for idx in range(3):
            file_path = os.path.join(FACES_DIR, f"{student_id}_{idx}.jpg")
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print("Error deleting file:", file_path, e)
                
        # Delete from DB
        success = delete_student(student_id)
        if success:
            return jsonify({"status": "success", "message": "Student removed"})
            
    return jsonify({"status": "error", "message": "Student not found or deletion failed"}), 400

# --- Attendance Routes ---

@app.route('/api/attendance', methods=['GET'])
def list_attendance():
    records = get_all_attendance()
    formatted = []
    student_list = get_all_students()
    for r in records:
        student = next((s for s in student_list if s['id'] == r['student_id']), None)
        avatar = None
        if student and student['avatar_path']:
            full_avatar_path = os.path.join(BACKEND_DIR, student['avatar_path'].lstrip('/'))
            if os.path.exists(full_avatar_path):
                with open(full_avatar_path, "rb") as image_file:
                    avatar = "data:image/jpeg;base64," + base64.b64encode(image_file.read()).decode('utf-8')
                
        formatted.append({
            "id": r['id'],
            "studentId": r['student_id'],
            "name": r['name'],
            "date": r['date'],
            "time": r['time'],
            "avatar": avatar
        })
    return jsonify(formatted)

@app.route('/api/attendance/<int:record_id>', methods=['DELETE'])
def remove_attendance_record(record_id):
    success = delete_attendance_record(record_id)
    if success:
        return jsonify({"status": "success", "message": "Record deleted"})
    return jsonify({"status": "error", "message": "Deletion failed"}), 400

@app.route('/api/attendance/clear', methods=['POST'])
def clear_attendance():
    success = clear_all_attendance()
    if success:
        return jsonify({"status": "success", "message": "All records cleared"})
    return jsonify({"status": "error", "message": "Clearing failed"}), 400

# --- Proxy Logs Route ---

@app.route('/api/proxy_logs', methods=['GET'])
def list_proxy_logs():
    logs = get_all_proxy_logs()
    formatted = []
    for l in logs:
        image_url = f"http://localhost:5000/api/images{l['image_path']}"
        formatted.append({
            "id": l['id'],
            "timestamp": l['timestamp'],
            "imageUrl": image_url,
            "detectedStudentId": l['detected_student_id'],
            "reason": l['reason']
        })
    return jsonify(formatted)

@app.route('/api/images/logs/proxy_attempts/<filename>')
def get_proxy_image(filename):
    file_path = os.path.join(PROXY_LOGS_DIR, filename)
    if os.path.exists(file_path):
        with open(file_path, "rb") as f:
            return Response(f.read(), mimetype="image/jpeg")
    return "Image not found", 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
