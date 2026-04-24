const mongoose = require('mongoose');

// The 10-second interval sensor schema
const sensorDataSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  total_people: { type: Number, default: 0 },
  trash_weight_g: { type: Number, default: 0 }
}, { _id: false }); 

// The main 30-minute Batch schema
const mealBatchSchema = new mongoose.Schema({
  date: { type: String, required: true }, 
  mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner'], required: true },
  batchNumber: { type: Number, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date }, 
  
  foodPrepared: {
    roti: { type: Number, default: 0 },
    rice: { type: Number, default: 0 },
    sabzi: { type: Number, default: 0 }, 
    dal: { type: Number, default: 0 }
  },

  sensorData: [sensorDataSchema] 
});

module.exports = mongoose.model('MealBatch', mealBatchSchema);