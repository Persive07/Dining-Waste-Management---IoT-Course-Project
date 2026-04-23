import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Users, Trash2, ChefHat, Activity, AlertTriangle, Play, Square, RefreshCw, Clock, BrainCircuit } from 'lucide-react';

const socket = io('http://localhost:5001');

function App() {
  const [state, setState] = useState({
    isReading: false,
    expectedMeal: 'Loading...',
    mealType: 'none',
    batchNumber: 0,
    live_count: 0,
    rate: 0,
    current_waste: 0.0,
    predictions: { rice: '', dal: '', roti: '', sabzi: '', status: '' }
  });

  const [foodInput, setFoodInput] = useState({ rice: 0, dal: 0, roti: 0, sabzi: 0 });
  const EXPECTED_CROWD = 300;

  useEffect(() => {
    socket.on('system_update', (data) => setState(data));
    return () => socket.off('system_update');
  }, []);

  const handleStartOrRestock = async () => {
    await fetch('http://localhost:5001/api/control/start-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodPrepared: foodInput })
    });
  };

  const handleEndReading = async () => {
    await fetch('http://localhost:5001/api/control/end', { method: 'POST' });
  };

  const handleInputChange = (e) => {
    setFoodInput({ ...foodInput, [e.target.name]: Number(e.target.value) });
  };

  const crowdPercentage = Math.min((state.live_count / EXPECTED_CROWD) * 100, 100);
  const isWasteHigh = state.current_waste > 15;

  return (
    <div className="min-h-screen bg-slate-900 p-8 font-sans text-white">
      <header className="mb-8 flex items-center justify-between border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Amingoan's Michelin Dining
          </h1>
          <div className="flex items-center gap-2 text-slate-400 mt-2">
            <Clock size={16} />
            <span>Auto-Detected Timeframe: <strong>{state.expectedMeal}</strong></span>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${state.isReading ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
          <Activity size={18} className={state.isReading ? 'animate-pulse' : ''} />
          <span className="text-sm font-semibold uppercase tracking-wide">
            {state.isReading ? `${state.mealType} (Batch ${state.batchNumber}) - LOGGING LIVE` : 'SYSTEM STANDBY'}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1 bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">Control Panel</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div><label className="block text-xs text-slate-400 mb-1">Rice (g)</label><input type="number" name="rice" value={foodInput.rice} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-blue-500" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Dal (g)</label><input type="number" name="dal" value={foodInput.dal} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-blue-500" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Roti (count)</label><input type="number" name="roti" value={foodInput.roti} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-blue-500" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Sabzi (g)</label><input type="number" name="sabzi" value={foodInput.sabzi} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none focus:border-blue-500" /></div>
          </div>
          <div className="space-y-3">
            {!state.isReading ? (
              <button onClick={handleStartOrRestock} className="w-full flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"><Play size={20} /> Start {state.expectedMeal} Sensors</button>
            ) : (
              <>
                <button onClick={handleStartOrRestock} className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"><RefreshCw size={20} /> Restock (Start Batch {state.batchNumber + 1})</button>
                <button onClick={handleEndReading} className="w-full flex justify-center items-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 font-bold py-3 px-4 rounded-lg transition-colors"><Square size={20} /> End {state.mealType}</button>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-200 mb-4"><Users className="text-blue-400" /> The Crowd</h2>
            <div className="flex items-end gap-2 mb-2"><span className="text-6xl font-bold text-white">{state.live_count}</span><span className="text-lg text-slate-400 mb-2">/ {EXPECTED_CROWD}</span></div>
            <div className="w-full bg-slate-700 rounded-full h-4 mt-4 overflow-hidden"><div className="bg-blue-500 h-4 rounded-full transition-all duration-500 ease-out" style={{ width: `${crowdPercentage}%` }}></div></div>
          </div>
          <div className={`bg-slate-800 rounded-2xl p-6 border shadow-xl transition-colors duration-300 ${isWasteHigh ? 'border-red-500/50 bg-red-900/10' : 'border-slate-700'}`}>
            <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-200 mb-4"><Trash2 className={isWasteHigh ? "text-red-400" : "text-amber-400"} /> The Bin {isWasteHigh && <AlertTriangle className="text-red-400 animate-bounce" size={20} />}</h2>
            <div className="flex items-end gap-2"><span className={`text-6xl font-bold ${isWasteHigh ? 'text-red-400' : 'text-amber-400'}`}>{Number(state.current_waste).toFixed(1)}</span><span className="text-lg text-slate-400 mb-2">kg</span></div>
          </div>
        </div>
      </div>
      
      <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">{state.isReading ? `Predictive AI (For Batch ${state.batchNumber + 1})` : `AI Predictions`}</h2>
      <p className="text-slate-400 mb-6 text-sm bg-slate-800 inline-block px-3 py-1 rounded border border-slate-700">Status: {state.predictions.status}</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700"><p className="text-sm text-slate-400 mb-2">Target Rice</p><p className={`text-xl font-bold ${state.predictions.rice.includes('URGENT') ? 'text-red-400' : 'text-white'}`}>{state.predictions.rice}</p></div>
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700"><p className="text-sm text-slate-400 mb-2">Target Dal</p><p className="text-xl font-bold text-white">{state.predictions.dal}</p></div>
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700"><p className="text-sm text-slate-400 mb-2">Roti Velocity</p><p className="text-xl font-bold text-white">{state.predictions.roti}</p></div>
        <div className={`bg-slate-800 rounded-2xl p-5 border ${state.predictions.sabzi.includes('WAIT') ? 'border-orange-500/50 bg-orange-900/20' : 'border-slate-700'}`}><p className="text-sm text-slate-400 mb-2">Sabzi Protocol</p><p className={`text-xl font-bold ${state.predictions.sabzi.includes('WAIT') ? 'text-orange-400' : 'text-white'}`}>{state.predictions.sabzi}</p></div>
      </div>
    </div>
  );
}

export default App;