require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const MealBatch = require('./models/MealBatch');

const CSV_FILE_PATH = './mess_10s_kg_data.csv';
const READINGS_PER_BATCH = 180; // 180 readings * 10s = 30 minutes

async function seedDatabase() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected. Preparing to read CSV...");

    const allRows = [];

    // Read the CSV File into memory
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', (data) => allRows.push(data))
      .on('end', async () => {
        console.log(`📄 Successfully read ${allRows.length} rows from CSV.`);
        
        let batchCounter = 1;
        let mealCounter = 0; 
        const meals = ['breakfast', 'lunch', 'dinner'];
        
        let currentDate = new Date('2026-01-01T08:00:00Z'); // Start date for historical data
        
        // Process data in chunks of 180 rows (1 Batch)
        for (let i = 0; i < allRows.length; i += READINGS_PER_BATCH) {
          const chunk = allRows.slice(i, i + READINGS_PER_BATCH);
          
          let cumulativePeople = 0;
          let cumulativeWasteKg = 0;
          let sensorDataArray = [];

          // Process the 10-second intervals for this specific batch
          chunk.forEach((row, index) => {
            cumulativePeople += parseInt(row.inflow_10s || 0);
            cumulativeWasteKg += parseFloat(row.total_waste_g || 0) / 1000.0; // Convert g to kg

            // Simulate the exact 10-second timestamps
            let logTime = new Date(currentDate.getTime() + index * 10000); 

            sensorDataArray.push({
              timestamp: logTime,
              total_people: cumulativePeople,
              trash_weight_kg: Number(cumulativeWasteKg.toFixed(2))
            });
          });

          // Use the target columns from the first row of the chunk as the "Food Prepared"
          const firstRow = chunk[0];
          const foodPrepared = {
            rice: parseFloat(firstRow.target_rice_kg || 0),
            dal: parseFloat(firstRow.target_dal_kg || 0),
            sabzi: parseFloat(firstRow.target_sabzi_kg || 0),
            roti: parseFloat(firstRow.target_roti_kg || 0) 
          };

          // Build the Final Batch Document
          const newBatch = new MealBatch({
            date: currentDate.toISOString().split('T')[0],
            mealType: meals[mealCounter],
            batchNumber: batchCounter,
            startTime: currentDate,
            endTime: new Date(currentDate.getTime() + (READINGS_PER_BATCH * 10000)), // +30 mins
            foodPrepared: foodPrepared,
            sensorData: sensorDataArray
          });

          await newBatch.save();
          console.log(`✅ Saved: ${newBatch.date} | ${newBatch.mealType} | Batch ${newBatch.batchNumber} (${chunk.length} readings)`);

          // Shift Time and Metadata for the next chunk 
          currentDate = new Date(currentDate.getTime() + (READINGS_PER_BATCH * 10000));
          batchCounter++;

          // If we reach 6 batches, switch to the next Meal
          if (batchCounter > 6) {
            batchCounter = 1;
            mealCounter++;
            
            // Fast forward time to the next meal (e.g., jump 4 hours)
            currentDate = new Date(currentDate.getTime() + (4 * 60 * 60 * 1000));
          }

          // If we finish dinner, move to the next Day
          if (mealCounter > 2) {
            mealCounter = 0;
            // Fast forward to next morning
            currentDate = new Date(currentDate.getTime() + (10 * 60 * 60 * 1000));
          }
        }

        console.log("🎉 Database Seeding Complete!");
        process.exit();
      });

  } catch (error) {
    console.error("❌ Seeding Error:", error);
    process.exit(1);
  }
}

seedDatabase();