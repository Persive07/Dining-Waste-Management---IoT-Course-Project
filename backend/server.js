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

// --- SYSTEM STATE & LSTM SLIDING WINDOW ---
let systemState = {
  isReading: false, expectedMeal: determineMealType(), mealType: 'none', batchNumber: 0,
  activeBatchId: null, live_count: 0, rate: 0, current_waste: 0.0,
  predictions: { rice: 'Standby', dal: 'Standby', roti: 'Standby', sabzi: 'Standby', status: 'Awaiting Start...' }
};

// Variables to track the last 10 seconds of activity
let last_snapshot_people = 0;
let last_snapshot_waste = 0.0;
let slidingWindow = []; // Will hold the 6 most recent 10-second data arrays

// Reset tracking when a new session starts
function resetTracking() {
  last_snapshot_people = 0;
  last_snapshot_waste = 0.0;
  slidingWindow = [];
}

// --- CALL THE PYTHON LSTM SERVER ---
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
      roti: `Prepare ${Math.round(aiData.Roti)} count`, // Adjust logic if model outputs kg vs count
      sabzi: `Cook ${aiData.Sabzi.toFixed(1)} kg`,
      status: `Live LSTM Optimization (Batch ${systemState.batchNumber + 1})`
    };
  } catch (error) {
    console.error("AI Error:", error.message);
    return { ...systemState.predictions, status: "AI Backend Offline" };
  }
}

// --- SENSORS POST ENDPOINTS ---
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

// --- UI CONTROLS ---
app.post('/api/control/start-batch', async (req, res) => {
  if (systemState.activeBatchId) await MealBatch.findByIdAndUpdate(systemState.activeBatchId, { endTime: new Date() });
  
  const isNewMeal = !systemState.isReading;
  const mealType = isNewMeal ? systemState.expectedMeal : systemState.mealType;
  const batchNum = isNewMeal ? 1 : systemState.batchNumber + 1;
  
  const newBatch = new MealBatch({ date: new Date().toISOString().split('T')[0], mealType: mealType.toLowerCase(), batchNumber: batchNum, foodPrepared: req.body.foodPrepared });
  const savedBatch = await newBatch.save();
  
  systemState.isReading = true; systemState.mealType = mealType; systemState.batchNumber = batchNum; systemState.activeBatchId = savedBatch._id;
  
  if (isNewMeal) resetTracking(); // Clear the window for a fresh meal
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

// --- THE 10-SECOND HEARTBEAT (DB Logging & LSTM Assembly) ---
setInterval(async () => {
  if (!systemState.isReading || !systemState.activeBatchId) return;

  // 1. Calculate Deltas (What happened in the last 10 seconds?)
  const delta_people = Math.max(0, systemState.live_count - last_snapshot_people);
  const delta_waste_kg = Math.max(0, systemState.current_waste - last_snapshot_waste);
  
  // Update snapshots for the next loop
  last_snapshot_people = systemState.live_count;
  last_snapshot_waste = systemState.current_waste;

  // 2. Format 10 Features for the LSTM
  const total_waste_g = delta_waste_kg * 1000;
  const scores = { rice: 0.8, dal: 0.7, sabzi: 0.6, roti: 0.9 }; // Configurable
  
  const features = [
    new Date().getDay(), // Day (0-6)
    delta_people,        // Inflow in last 10s
    scores.rice, scores.dal, scores.sabzi, scores.roti, // 4 Scores
    total_waste_g * 0.4, // waste_rice_g
    total_waste_g * 0.2, // waste_dal_g
    total_waste_g * 0.3, // waste_sabzi_g
    total_waste_g * 0.1  // waste_roti_g
  ];

  // 3. Add to Sliding Window
  slidingWindow.push(features);
  if (slidingWindow.length > 6) {
    slidingWindow.shift(); // Keep only the last 6 steps
  }

  // 4. Trigger AI if we have a full 60-second sequence
  if (slidingWindow.length === 6) {
    systemState.predictions = await fetchAIPrediction(slidingWindow);
  } else {
    // If we only have 3 readings, UI says "Gathering Initial Sequence (30/60s)..."
    systemState.predictions.status = `Gathering Sequence (${slidingWindow.length * 10}/60s)...`;
  }

  io.emit('system_update', systemState); // Push UI updates

  // 5. Log to MongoDB
  try {
    await MealBatch.findByIdAndUpdate(systemState.activeBatchId, { 
      $push: { sensorData: { timestamp: new Date(), total_people: systemState.live_count, trash_weight_kg: systemState.current_waste } } 
    });
  } catch (error) { console.error("DB push failed:", error); }

}, SENSOR_INTERVAL_MS);

io.on('connection', (socket) => { socket.emit('system_update', systemState); });
server.listen(5001, () => console.log(`🚀 DynaMess Node Server running on port 5001`));