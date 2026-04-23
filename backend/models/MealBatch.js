const mongoose = require('mongoose');

// The 10-second interval sensor schema
const sensorDataSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  total_people: { type: Number, default: 0 },
  trash_weight_kg: { type: Number, default: 0 }
}, { _id: false }); // Saves DB space

// The main 30-minute Batch schema
const mealBatchSchema = new mongoose.Schema({
  date: { type: String, required: true }, // e.g., "2026-04-22"
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner'], required: true },
  batchNumber: { type: Number, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date }, // Filled when "End Reading" or "Next Batch" is clicked
  
  foodPrepared: {
    roti: { type: Number, default: 0 },
    rice: { type: Number, default: 0 },
    sabzi: { type: Number, default: 0 }, 
    dal: { type: Number, default: 0 }
  },

  sensorData: [sensorDataSchema] // Will hold ~180 readings per batch
});

module.exports = mongoose.model('MealBatch', mealBatchSchema);