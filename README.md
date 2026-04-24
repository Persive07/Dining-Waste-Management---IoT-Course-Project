# Dining Waste Management - IoT Course Project

This repository contains the full codebase, integrating a MERN stack dashboard with LSTM projections and hardware sensor microservices.

## Folder Structure

```text
IoT_UI (Root)
 ┣ 📂 backend                 # Database & Aggregation Server (Node.js)
 ┃ ┣ 📂 models                # MongoDB Schemas (MealBatch.js)
 ┃ ┗ 📄 server.js             # Main backend server (Runs on Port 5001)
 ┃
 ┣ 📂 frontend                # The React Web Dashboard
 ┃ ┣ 📂 src                   # React components (App.jsx)
 ┃
 ┣ 📂 sensors                 # Sensors & LSTM
 ┃ ┣ 📂 config                # Hardware Setup Scripts
 ┃ ┃ ┣ 📄 camera_config.ino   # ESP32-CAM Arduino script
 ┃ ┃ ┗ 📄 weight_config.py    # Weight Sensor micropython script
 ┃ ┣ 📄 gatekeeper.py         # Live crowd counting
 ┃ ┣ 📄 scale_receiver.py     # Live weight feed (Runs on Port 5000)
 ┃ ┣ 📄 ml_server.py          # LSTM (Runs on Port 5002)
 ┃ ┣ 📄 lstm_mess_brain.h5    # LSTM weights
 ┃ ┣ 📄 scaler_x.pkl          # ML Input normalizer
 ┃ ┗ 📄 scaler_y.pkl          # ML Output normalizer
```

## Prerequisites & First-Time Setup
Before running the system, ensure you have Node.js, Python 3, and an active MongoDB Atlas URI inside your backend/.env file.
```
1. Install Backend Dependencies:
cd backend
npm install

2. Install Frontend Dependencies:
cd frontend
npm install

3. Setup Python Virtual Environment:
cd sensors
python3 -m venv venv
source venv/bin/activate
pip install flask tensorflow scikit-learn joblib numpy pandas requests opencv-python
```

## Running the setup
```
1. Backend Server
cd backend
node server.js

2. Frontend Server
cd frontend
npm run dev

3. LSTM
cd sensors
source venv/bin/activate
python3 ml_server.py

4. Live Camera feed
cd sensors
source venv/bin/activate
python3 gatekeeper.py

5. Live Weight feed
cd sensors
source venv/bin/activate
python3 scale_receiver.py
```

## Sensors Configuration 
```
If you need to flash or recalibrate the physical sensors, refer to the scripts located in the sensors/config/ directory:

Camera: Flash camera_config.ino to the ESP32-CAM using the Arduino IDE. Note the assigned IP address in the Serial Monitor and update gatekeeper.py if necessary.

Scale: Use weight_config.py to establish the baseline tare and calibration factor for the HX711 load cell.
```