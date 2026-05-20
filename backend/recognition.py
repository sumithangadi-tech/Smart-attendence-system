import os
import pickle
import cv2
import numpy as np

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BACKEND_DIR, 'data')
FACES_DIR = os.path.join(DATA_DIR, 'faces')
MODEL_PATH = os.path.join(DATA_DIR, 'lbph_model.yml')
MAP_PATH = os.path.join(DATA_DIR, 'id_map.pkl')

os.makedirs(FACES_DIR, exist_ok=True)

# In-memory recognizer and ID map
_recognizer = None
_int_to_str_map = {}  # maps integer labels to string student IDs
_str_to_int_map = {}  # maps string student IDs to integer labels

def load_lbph_model():
    global _recognizer, _int_to_str_map, _str_to_int_map
    
    # Load ID maps
    if os.path.exists(MAP_PATH):
        try:
            with open(MAP_PATH, 'rb') as f:
                data = pickle.load(f)
                _int_to_str_map = data.get('int_to_str', {})
                _str_to_int_map = data.get('str_to_int', {})
        except Exception as e:
            print("[ERROR] Error loading ID mapping:", e)
            _int_to_str_map = {}
            _str_to_int_map = {}
            
    # Load recognizer
    if os.path.exists(MODEL_PATH):
        try:
            r = cv2.face.LBPHFaceRecognizer_create()
            r.read(MODEL_PATH)
            _recognizer = r
            print("[INFO] LBPH model loaded from disk.")
        except Exception as e:
            print("[ERROR] Error loading LBPH model:", e)
            _recognizer = None
    else:
        _recognizer = None
        print("[WARNING] No LBPH model found. Recognition is inactive until students are registered.")

# Load initially
load_lbph_model()

def retrain_lbph_model():
    global _recognizer, _int_to_str_map, _str_to_int_map
    
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    faces = []
    labels = []
    
    # Scan faces directory
    student_files = [f for f in os.listdir(FACES_DIR) if f.endswith('.jpg')]
    if not student_files:
        # No files, reset model
        if os.path.exists(MODEL_PATH):
            os.remove(MODEL_PATH)
        if os.path.exists(MAP_PATH):
            os.remove(MAP_PATH)
        _recognizer = None
        _int_to_str_map = {}
        _str_to_int_map = {}
        print("[INFO] No student faces found. LBPH model cleared.")
        return True
        
    next_label = max(_int_to_str_map.keys()) + 1 if _int_to_str_map else 1
    
    for filename in student_files:
        # Filename format: studentID_sampleIdx.jpg (e.g. STU001_0.jpg)
        parts = filename.rsplit('_', 1)
        if len(parts) != 2:
            continue
            
        student_id = parts[0]
        
        # Read image
        img_path = os.path.join(FACES_DIR, filename)
        img = cv2.imread(img_path)
        if img is None:
            continue
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Detect face (to extract the cropped, aligned version)
        detected_faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(50, 50))
        
        if len(detected_faces) > 0:
            x, y, w, h = detected_faces[0]
            face_crop = gray[y:y+h, x:x+w]
        else:
            # Fallback to entire image if detection fails
            face_crop = gray
            
        # Resize to standard size for LBPH consistency
        face_resized = cv2.resize(face_crop, (200, 200))
        
        # Map string ID to integer
        if student_id not in _str_to_int_map:
            _str_to_int_map[student_id] = next_label
            _int_to_str_map[next_label] = student_id
            next_label += 1
            
        label = _str_to_int_map[student_id]
        
        faces.append(face_resized)
        labels.append(label)
        
    if len(faces) == 0:
        print("[WARNING] No faces detected in student photos. Training skipped.")
        return False
        
    try:
        # Train recognizer
        r = cv2.face.LBPHFaceRecognizer_create()
        r.train(faces, np.array(labels))
        r.write(MODEL_PATH)
        
        # Save mappings
        with open(MAP_PATH, 'wb') as f:
            pickle.dump({
                'int_to_str': _int_to_str_map,
                'str_to_int': _str_to_int_map
            }, f)
            
        _recognizer = r
        print(f"[INFO] LBPH recognizer trained on {len(faces)} samples representing {len(_str_to_int_map)} students.")
        return True
    except Exception as e:
        print("[ERROR] Failed to train LBPH recognizer:", e)
        return False

def register_student_face(student_id, image_path):
    """
    Save student face sample and retrain the LBPH recognizer.
    The temp image path points to the full snapshot captured by the user.
    """
    # The image is already saved under FACES_DIR/student_id_idx.jpg by app.py
    # We just need to trigger retraining
    success = retrain_lbph_model()
    if success:
        return True, "Face registered and model retrained."
    return False, "Retraining failed."

def delete_student_face(student_id):
    global _int_to_str_map, _str_to_int_map
    
    # Remove student from maps
    if student_id in _str_to_int_map:
        label = _str_to_int_map[student_id]
        del _str_to_int_map[student_id]
        if label in _int_to_str_map:
            del _int_to_str_map[label]
            
        # Write updated maps
        with open(MAP_PATH, 'wb') as f:
            pickle.dump({
                'int_to_str': _int_to_str_map,
                'str_to_int': _str_to_int_map
            }, f)
            
        # Retrain model (it will scan FACES_DIR which has had student files deleted)
        retrain_lbph_model()
        return True
    return False

def recognize_face(face_img, threshold=75.0):
    """
    face_img: BGR image crop of the face.
    threshold: LBPH distance threshold (lower is better, < 75.0 is standard).
    Returns: student_id or None, distance score
    """
    global _recognizer, _int_to_str_map
    
    if _recognizer is None:
        return None, 100.0
        
    try:
        # Convert crop to grayscale and resize
        gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
        resized = cv2.resize(gray, (200, 200))
        
        # Predict
        label, distance = _recognizer.predict(resized)
        
        # In LBPH, distance represents how different the face is.
        # 0 is a perfect match. 
        if distance < threshold:
            student_id = _int_to_str_map.get(label)
            confidence = max(0.0, 100.0 - distance)
            return student_id, confidence
            
        confidence = max(0.0, 100.0 - distance)
        return None, confidence
    except Exception as e:
        print("[ERROR] Face recognition error:", e)
        return None, 100.0
