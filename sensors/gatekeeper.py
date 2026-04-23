import cv2
import time
import csv
import requests
from datetime import datetime

URL = "http://10.211.9.1:80/stream.mjpg" 
NODE_JS_URL = "http://127.0.0.1:5001/api/sensors/entrance"
LOG_INTERVAL = 10 
CSV_FILENAME = "people_count_log.csv"

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

print(f"Connecting to stream at {URL}...")
cap = cv2.VideoCapture(URL) # Removed FFMPEG flag for stability

if not cap.isOpened():
    print("Error: Could not open the stream.")
    exit()

print(f"Stream connected! Logging data every {LOG_INTERVAL} seconds. Press 'q' to quit.")

last_log_time = time.time()
new_faces_this_interval = 0
cooldown_frames = 0 # Prevents counting the same person 30x a second

with open(CSV_FILENAME, mode='a', newline='') as file:
    writer = csv.writer(file)
    if file.tell() == 0:
        writer.writerow(["Timestamp", "New_People_Entered"])

while True:
    ret, frame = cap.read()
    if not ret: continue

    frame = cv2.flip(frame, -1)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    current_face_count = len(faces)
    
    # If we see a face, and the cooldown is 0, count them!
    if current_face_count > 0 and cooldown_frames == 0:
        new_faces_this_interval += current_face_count
        cooldown_frames = 30 # Wait ~1 to 2 seconds before counting a new person
        print(f"BEEP! Person counted. Interval total: {new_faces_this_interval}")

    # Reduce cooldown timer every frame
    if cooldown_frames > 0:
        cooldown_frames -= 1
        
    for (x, y, w, h) in faces:
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
    
    cv2.putText(frame, f"Count: {new_faces_this_interval}", (20, 40), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.imshow("ESP32-CAM People Counter", frame)
    
    current_time = time.time()
    if current_time - last_log_time >= LOG_INTERVAL:
        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        with open(CSV_FILENAME, mode='a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([timestamp_str, new_faces_this_interval])
            
        try:
            payload = { "new_entries": new_faces_this_interval }
            res = requests.post(NODE_JS_URL, json=payload, timeout=2)
            print(f"[{timestamp_str}] Camera -> Node.js (Added {new_faces_this_interval}) | Status: {res.status_code}")
        except Exception as e:
            pass

        # Reset the interval counter for the next 10 seconds
        last_log_time = current_time
        new_faces_this_interval = 0

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()