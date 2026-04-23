from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf
import joblib

app = Flask(__name__)

try:
    model = tf.keras.models.load_model('lstm_mess_brain.h5', compile=False)
    scaler_x = joblib.load('scaler_x.pkl')
    scaler_y = joblib.load('scaler_y.pkl')
    print("✅ LSTM Brain & Scalers loaded successfully.")
except Exception as e:
    print(f"❌ Error loading ML files: {e}")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        sequence_data = data.get('sequence', [])
        
        if len(sequence_data) != 6:
            return jsonify({"error": f"LSTM requires 6 time steps, got {len(sequence_data)}"}), 400
        
        scaled_sequence = scaler_x.transform(sequence_data)
        
        scaled_sequence = scaled_sequence[:, :10] 
        
        # Reshape for LSTM to 3D Tensor -> (1 batch, 6 time steps, 10 features)
        input_tensor = np.array([scaled_sequence])
        
        prediction_scaled = model.predict(input_tensor, verbose=0)
        
        prediction_kg = scaler_y.inverse_transform(prediction_scaled)[0]
        results = np.round(prediction_kg, 2)
        
        return jsonify({
            "Rice": float(results[0]),
            "Dal": float(results[1]),
            "Sabzi": float(results[2]),
            "Roti": float(results[3]) 
        })
    except Exception as e:
        print(f"Prediction Error: {e}") 
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5002)