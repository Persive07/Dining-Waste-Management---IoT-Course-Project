from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

NODE_JS_URL = "http://127.0.0.1:5001/api/sensors/waste"

@app.route('/update_weight', methods=['POST'])
def receive():
    data = request.json

    weight_kg = float(data.get('weight', 0))
    
    print(f"[SCALE] Received {weight_kg * 1000}g from ESP32. Forwarding to UI...")
    
    try:
        payload = {"current_waste": weight_kg}
        res = requests.post(NODE_JS_URL, json=payload, timeout=2)
        print(f" -> Forward Success. Node.js Status: {res.status_code}")
    except Exception as e:
        print(" -> Forward Failed. Is Node.js running?")

    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(host='10.211.9.119', port=5000)