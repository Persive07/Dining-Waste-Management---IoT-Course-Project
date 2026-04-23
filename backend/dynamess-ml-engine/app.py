import cv2
import time
import csv
from datetime import datetime

URL = "http://10.211.9.1:80/stream.mjpg" 
LOG_INTERVAL = 10 # Send/Log data every 10 seconds
CSV_FILENAME = "people_count_log.csv"

# Load OpenCV's pre-trained Haar Cascade
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

print(f"Connecting to stream at {URL}...")
cap = cv2.VideoCapture(URL, cv2.CAP_FFMPEG)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) # Reduce lag

if not cap.isOpened():
    print("Error: Could not open the stream.")
    exit()

print(f"Stream connected! Logging data every {LOG_INTERVAL} seconds. Press 'q' to quit.")

# Initialize tracking variables
last_log_time = time.time()
max_faces_in_interval = 0

with open(CSV_FILENAME, mode='a', newline='') as file:
    writer = csv.writer(file)
    if file.tell() == 0:
        writer.writerow(["Timestamp", "People_Count"])

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame. Reconnecting...")
        time.sleep(1)
        cap = cv2.VideoCapture(URL, cv2.CAP_FFMPEG)
        continue

    frame = cv2.flip(frame, -1)
    
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    current_face_count = len(faces)
    
    if current_face_count > max_faces_in_interval:
        max_faces_in_interval = current_face_count
        
    # Draw boxes and text for the live display
    for (x, y, w, h) in faces:
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
    
    cv2.putText(frame, f"Live Count: {current_face_count}", (20, 40), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.imshow("ESP32-CAM People Counter", frame)
    
    current_time = time.time()
    if current_time - last_log_time >= LOG_INTERVAL:
        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        print(f"[{timestamp_str}] Data Sent: {max_faces_in_interval} people detected.")
        
        with open(CSV_FILENAME, mode='a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([timestamp_str, max_faces_in_interval])
            
        last_log_time = current_time
        max_faces_in_interval = 0

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()