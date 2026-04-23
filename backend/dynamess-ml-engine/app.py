# import numpy as np
# import tensorflow as tf
# import joblib
# from flask import Flask, request, jsonify
# import time

# app = Flask(__name__)

# # 1. LOAD ML ASSETS (The files created by Member 2)
# try:
#     model = tf.keras.models.load_model('latest_batch_brain.h5', compile=False)
#     scaler_x = joblib.load('scaler_x.pkl')
#     scaler_y = joblib.load('scaler_y.pkl')
#     print("AI Model & Scalers loaded successfully.")
# except Exception as e:
#     print(f"Error loading ML files: {e}. (Make sure Member 2 gave you the .h5 and .pkl files)")

# # 2. LIVE SYSTEM STATE (Stores data as it arrives from WiFi)
# live_data = {
#     "current_weight": 0.0,
#     "student_count": 0,
#     "batch_num": 1,
#     "day": 0, # 0 = Monday, etc.
#     "scores": {"rice": 0.8, "dal": 0.7, "sabzi": 0.6, "roti": 0.9} # Set these at start of meal
# }

# # --- ENDPOINT 1: RECEIVE FROM SCALE (Core2 #1) ---
# @app.route('/update_weight', methods=['POST'])
# def receive_weight():
#     global live_data
#     data = request.json
#     live_data["current_weight"] = float(data.get('weight', 0))
#     print(f"[SCALE] New Weight Received: {live_data['current_weight']}g")
#     return jsonify({"status": "ok"})

# # --- ENDPOINT 2: RECEIVE FROM CAMERA (ESP32-Cam) ---
# @app.route('/update_count', methods=['POST'])
# def receive_count():
#     global live_data
#     data = request.json
#     live_data["student_count"] = int(data.get('count', 0))
#     print(f"[CAMERA] New Student Count: {live_data['student_count']}")
#     return jsonify({"status": "ok"})

# # --- ENDPOINT 3: SEND PREDICTION (To Laptop Dashboard or Core2 #2) ---
# @app.route('/get_prediction', methods=['GET'])
# def calculate_recommendation():
#     # A. The "Decomposition" Logic (Split 1 total weight into 4 estimated items)
#     w_total = live_data["current_weight"]
#     w_rice = w_total * 0.4   # Assumption: 40% of waste is rice
#     w_dal = w_total * 0.2    # 20% is dal
#     w_sabzi = w_total * 0.3  # 30% is sabzi
#     w_roti = w_total * 0.1   # 10% is roti

#     # B. Build the Input Vector for the AI (12 features as trained)
#     input_list = [
#         live_data["day"], live_data["batch_num"], live_data["student_count"],
#         live_data["scores"]['rice'], live_data["scores"]['dal'], 
#         live_data["scores"]['sabzi'], live_data["scores"]['roti'],
#         w_rice, w_dal, w_sabzi, w_roti, w_total
#     ]

#     # C. Run AI Inference
#     try:
#         input_array = np.array(input_list).reshape(1, -1)
#         input_scaled = scaler_x.transform(input_array)
#         prediction_scaled = model.predict(input_scaled, verbose=0)
#         prediction_grams = scaler_y.inverse_transform(prediction_scaled)[0]

#         # D. Format the Result
#         results = {
#             "Rice": f"{round(prediction_grams[0])}g",
#             "Dal": f"{round(prediction_grams[1])}g",
#             "Sabzi": f"{round(prediction_grams[2])}g",
#             "Roti": f"{round(prediction_grams[3])}g",
#             "msg": "AI Plan Calculated"
#         }
#         print(f"\n>>> RECOMMENDATION: {results}\n")
#         return jsonify(results)
    
#     except Exception as e:
#         return jsonify({"msg": "Inference Error", "error": str(e)})

# if __name__ == '__main__':
#     # Use the IP from your last message
#     app.run(host='10.211.9.119', port=5000, debug=False)


# # from flask import Flask, request, jsonify

# # app = Flask(__name__)

# # @app.route('/update_weight', methods=['POST'])
# # def receive():
# #     data = request.json
# #     print(f"RECEIVED DATA: {data}")
# #     return jsonify({"status": "ok"})

# # if __name__ == '__main__':
# #     # REPLACE with YOUR laptop IP
# #     app.run(host='10.211.9.119', port=5000)




import cv2
import time
import csv
from datetime import datetime

# --- CONFIGURATION ---
URL = "http://10.211.9.1:80/stream.mjpg" # Your ESP32-CAM IP
LOG_INTERVAL = 10 # Send/Log data every 10 seconds
CSV_FILENAME = "people_count_log.csv"

# Load OpenCV's pre-trained Haar Cascade
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# Connect to the stream
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

# Create/Open the CSV file and write the header
with open(CSV_FILENAME, mode='a', newline='') as file:
    writer = csv.writer(file)
    # Only write header if file is totally empty
    if file.tell() == 0:
        writer.writerow(["Timestamp", "People_Count"])

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame. Reconnecting...")
        time.sleep(1)
        cap = cv2.VideoCapture(URL, cv2.CAP_FFMPEG)
        continue

    # Fix orientation (from your previous upside-down issue)
    frame = cv2.flip(frame, -1)
    
    # Convert to grayscale for the AI algorithm
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    current_face_count = len(faces)
    
    # Update the maximum faces seen in this specific interval
    if current_face_count > max_faces_in_interval:
        max_faces_in_interval = current_face_count
        
    # Draw boxes and text for the live display
    for (x, y, w, h) in faces:
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
    
    cv2.putText(frame, f"Live Count: {current_face_count}", (20, 40), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.imshow("ESP32-CAM People Counter", frame)
    
    # --- PERIODIC DATA LOGGING ---
    current_time = time.time()
    if current_time - last_log_time >= LOG_INTERVAL:
        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 1. Print to the console
        print(f"[{timestamp_str}] Data Sent: {max_faces_in_interval} people detected.")
        
        # 2. Append the data to the CSV file
        with open(CSV_FILENAME, mode='a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([timestamp_str, max_faces_in_interval])
            
        # 3. Reset the timer and max counter for the next interval
        last_log_time = current_time
        max_faces_in_interval = 0

    # Quit condition
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()