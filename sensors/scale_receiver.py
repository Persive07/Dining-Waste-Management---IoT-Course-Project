from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Your Node.js server endpoint for waste data
NODE_JS_URL = "http://127.0.0.1:5001/api/sensors/waste"

@app.route('/update_weight', methods=['POST'])
def receive():
    data = request.json
    
    # Extract the weight. Assuming it comes in as grams, divide by 1000 for kg.
    # If it is already in kg, remove the "/ 1000.0"
    weight_kg = float(data.get('weight', 0)) / 1000.0 
    
    print(f"[SCALE] Received {weight_kg * 1000}g from ESP32. Forwarding to UI...")
    
    # Forward it instantly to the Node.js Dashboard
    try:
        payload = {"current_waste": weight_kg}
        res = requests.post(NODE_JS_URL, json=payload, timeout=2)
        print(f" -> Forward Success. Node.js Status: {res.status_code}")
    except Exception as e:
        print(" -> Forward Failed. Is Node.js running?")

    return jsonify({"status": "ok"})

if __name__ == '__main__':
    # Your laptop's IP so the ESP32 can find this Flask server
    app.run(host='10.211.9.119', port=5000)