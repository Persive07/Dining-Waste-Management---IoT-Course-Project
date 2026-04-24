require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const MealBatch = require('./models/MealBatch');

const SENSOR_INTERVAL_MS = 10000; // 10 seconds

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas!"))
  .catch((err) => console.error("❌ DB Error:", err));

function determineMealType() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'Breakfast';
  if (hour >= 11 && hour < 16) return 'Lunch'; 
  return 'Dinner';
}

let systemState = {
  isReading: false, expectedMeal: determineMealType(), mealType: 'none', batchNumber: 0,
  activeBatchId: null, live_count: 0, rate: 0, current_waste: 0.0,
  predictions: { rice: 'Standby', dal: 'Standby', roti: 'Standby', sabzi: 'Standby', status: 'Awaiting Start...' }
};

let last_snapshot_people = 0;
let last_snapshot_waste = 0.0;
let slidingWindow = []; 

function resetTracking() {
  last_snapshot_people = 0;
  last_snapshot_waste = 0.0;
  slidingWindow = [];
}

async function fetchAIPrediction(sequenceWindow) {
  try {
    const response = await fetch('http://127.0.0.1:5002/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: sequenceWindow })
    });

    const aiData = await response.json();
    if (aiData.error) throw new Error(aiData.error);

    return {
      rice: `Cook ${aiData.Rice.toFixed(1)} kg`,
      dal: `Cook ${aiData.Dal.toFixed(1)} kg`,
      roti: `Cook ${aiData.Roti.toFixed(1)} kg`,
      sabzi: `Cook ${aiData.Sabzi.toFixed(1)} kg`,
      status: `Live LSTM Optimization (Batch ${systemState.batchNumber + 1})`
    };
  } catch (error) {
    console.error("AI Error:", error.message);
    return { ...systemState.predictions, status: "AI Backend Offline" };
  }
}

// SENSORS POST ENDPOINTS 
app.post('/api/sensors/entrance', (req, res) => {
  if(systemState.isReading) {
    systemState.live_count += req.body.new_entries || 0;
    systemState.rate = req.body.rate ?? systemState.rate;
    io.emit('system_update', systemState); 
  }
  res.status(200).send("OK");
});

app.post('/api/sensors/waste', (req, res) => {
  if(systemState.isReading) {
    systemState.current_waste = req.body.current_waste ?? systemState.current_waste;
    io.emit('system_update', systemState); 
  }
  res.status(200).send("OK");
});

// UI CONTROLS
app.post('/api/control/start-batch', async (req, res) => {
  if (systemState.activeBatchId) await MealBatch.findByIdAndUpdate(systemState.activeBatchId, { endTime: new Date() });
  
  const isNewMeal = !systemState.isReading;
  const mealType = isNewMeal ? systemState.expectedMeal : systemState.mealType;
  const batchNum = isNewMeal ? 1 : systemState.batchNumber + 1;
  
  const newBatch = new MealBatch({ date: new Date().toISOString().split('T')[0], mealType: mealType.toLowerCase(), batchNumber: batchNum, foodPrepared: req.body.foodPrepared });
  const savedBatch = await newBatch.save();
  
  systemState.isReading = true; systemState.mealType = mealType; systemState.batchNumber = batchNum; systemState.activeBatchId = savedBatch._id;
  
  if (isNewMeal) resetTracking(); 
  systemState.predictions.status = "Gathering Initial Sequence (0/60s)...";
  
  io.emit('system_update', systemState);
  res.status(200).json(savedBatch);
});

app.post('/api/control/end', async (req, res) => {
  if (systemState.activeBatchId) await MealBatch.findByIdAndUpdate(systemState.activeBatchId, { endTime: new Date() });
  systemState = { isReading: false, expectedMeal: determineMealType(), mealType: 'none', batchNumber: 0, activeBatchId: null, live_count: 0, rate: 0, current_waste: 0.0, predictions: { rice: '-', dal: '-', roti: '-', sabzi: '-', status: 'Session Ended.' } };
  resetTracking();
  io.emit('system_update', systemState);
  res.status(200).send("Ended");
});

setInterval(async () => {
  if (!systemState.isReading || !systemState.activeBatchId) return;

  const delta_people = Math.max(0, systemState.live_count - last_snapshot_people);
  const delta_waste_g = Math.max(0, systemState.current_waste - last_snapshot_waste);
  
  last_snapshot_people = systemState.live_count;
  last_snapshot_waste = systemState.current_waste;

  const total_waste_g = delta_waste_g;
  const scores = { rice: 0.8, dal: 0.7, sabzi: 0.6, roti: 0.9 }; 
  
  const features = [
    new Date().getDay(), 
    delta_people,        
    scores.rice, scores.dal, scores.sabzi, scores.roti, 
    total_waste_g * 0.4, 
    total_waste_g * 0.2, 
    total_waste_g * 0.3, 
    total_waste_g * 0.1  
  ];

  // Add to Sliding Window
  slidingWindow.push(features);
  if (slidingWindow.length > 6) {
    slidingWindow.shift(); 
  }

  if (slidingWindow.length === 6) {
    systemState.predictions = await fetchAIPrediction(slidingWindow);
  } else {
    systemState.predictions.status = `Gathering Sequence (${slidingWindow.length * 10}/60s)...`;
  }

  io.emit('system_update', systemState); // Push UI updates

  // Log to MongoDB
  try {
    await MealBatch.findByIdAndUpdate(systemState.activeBatchId, { 
      $push: { sensorData: { timestamp: new Date(), total_people: systemState.live_count, trash_weight_g: systemState.current_waste } } 
    });
  } catch (error) { console.error("DB push failed:", error); }

}, SENSOR_INTERVAL_MS);

io.on('connection', (socket) => { socket.emit('system_update', systemState); });
server.listen(5001, () => console.log(`🚀 DynaMess Node Server running on port 5001`));