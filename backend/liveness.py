import cv2

class LivenessDetector:
    def __init__(self):
        # Load OpenCV Haar Cascades
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        self.profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
        
        # State tracking
        self.stage = 'blink'  # 'blink' | 'turn_left' | 'turn_right' | 'verified'
        self.blink_count = 0
        self.eyes_closed_frames = 0
        self.eyes_open_seen = False
        
    def reset(self):
        self.stage = 'blink'
        self.blink_count = 0
        self.eyes_closed_frames = 0
        self.eyes_open_seen = False
        
    def process_frame(self, gray_frame, face_box):
        """
        gray_frame: Grayscale image of the frame.
        face_box: (x, y, w, h) of detected frontal face. None if no face detected.
        Returns:
            stage: current active stage
            instruction: user prompt text
            is_verified: boolean
        """
        # If no face is detected, we cannot do liveness
        if face_box is None:
            return self.stage, "Align your face in the camera", False
            
        x, y, w, h = face_box
        
        if self.stage == 'blink':
            # Eyes are in the upper half of the face bounding box
            # Define eye Region of Interest (ROI)
            ey_start = y + int(h * 0.15)
            ey_height = int(h * 0.4)
            ex_start = x
            ex_width = w
            
            # Guard coordinates
            img_h, img_w = gray_frame.shape
            ey_start = max(0, min(ey_start, img_h - 1))
            ey_end = max(0, min(ey_start + ey_height, img_h))
            ex_start = max(0, min(ex_start, img_w - 1))
            ex_end = max(0, min(ex_start + ex_width, img_w))
            
            if (ey_end - ey_start) > 10 and (ex_end - ex_start) > 10:
                eye_roi = gray_frame[ey_start:ey_end, ex_start:ex_end]
                eyes = self.eye_cascade.detectMultiScale(eye_roi, scaleFactor=1.1, minNeighbors=4, minSize=(15, 15))
                
                # Check eye state
                if len(eyes) >= 1:
                    # Eyes are detected open
                    if self.eyes_closed_frames >= 1: # We saw them closed in previous frames
                        self.blink_count += 1
                        if self.blink_count >= 1:
                            self.stage = 'turn_left'
                    self.eyes_open_seen = True
                    self.eyes_closed_frames = 0
                else:
                    # No eyes detected (could be a blink if we saw them open before)
                    if self.eyes_open_seen:
                        self.eyes_closed_frames += 1
            
            return 'blink', "Please blink your eyes naturally", False
            
        elif self.stage == 'turn_left':
            # Profile cascade detects left profile faces
            profiles = self.profile_cascade.detectMultiScale(gray_frame, scaleFactor=1.1, minNeighbors=4, minSize=(50, 50))
            
            # If we detect a profile face, it means head turned
            if len(profiles) >= 1:
                # User turned their head left
                self.stage = 'turn_right'
                
            return 'turn_left', "Slowly turn your head to the LEFT", False
            
        elif self.stage == 'turn_right':
            # Profile cascade on flipped frame detects right profile faces
            flipped_gray = cv2.flip(gray_frame, 1)
            profiles = self.profile_cascade.detectMultiScale(flipped_gray, scaleFactor=1.1, minNeighbors=4, minSize=(50, 50))
            
            if len(profiles) >= 1:
                # User turned their head right
                self.stage = 'verified'
                
            return 'turn_right', "Slowly turn your head to the RIGHT", False
            
        elif self.stage == 'verified':
            return 'verified', "Liveness Verified! Recognizing...", True
            
        return self.stage, "Liveness check active", False
