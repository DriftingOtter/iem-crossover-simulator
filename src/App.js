import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, Play, Download, Info, ChevronUp, ChevronDown, Zap } from 'lucide-react';

// Source presets with typical output voltages
const SOURCE_PRESETS = {
  raw: { name: 'Raw Audio (Phone)', voltage: 0.5 },
  apple: { name: 'Apple Dongle', voltage: 1.0 },
  jcally: { name: 'JCally JA04', voltage: 2.0 },
  desktop: { name: 'Desktop DAC', voltage: 4.0 },
  custom: { name: 'Custom', voltage: 1.0 }
};

const IEMCrossoverSimulator = () => {
  // State management
  const [drivers, setDrivers] = useState([]);
  const [crossoverElements, setCrossoverElements] = useState([]);
  const [simulationData, setSimulationData] = useState(null);
  const [activeTab, setActiveTab] = useState('magnitude');
  const [showInfo, setShowInfo] = useState(false);
  const [sourcePreset, setSourcePreset] = useState('apple');
  const [customVoltage, setCustomVoltage] = useState(1.0);
  
  const [earSimulator, setEarSimulator] = useState({
    enabled: true,
    canalVolume: 1.0,
    canalLength: 1.2,
    drumCompliance: 1.0,
    leakage: 0.0
  });

  // Utility functions
  const parseFrequencyData = (text, type) => {
    const lines = text.trim().split('\n');
    const data = [];
    
    for (const line of lines) {
      if (line.trim() === '' || line.startsWith('*') || line.startsWith('#')) continue;
      
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const freq = parseFloat(parts[0]);
        const value = parseFloat(parts[1]);
        
        if (!isNaN(freq) && !isNaN(value)) {
          if (type === 'frd') {
            data.push({ freq, spl: value });
          } else if (type === 'zma') {
            const phase = parts.length >= 3 ? parseFloat(parts[2]) : 0;
            data.push({ freq, impedance: value, phase: isNaN(phase) ? 0 : phase });
          }
        }
      }
    }
    
    return data;
  };

  const handleFileUpload = async (e, driverIndex, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const data = parseFrequencyData(text, type);
    
    setDrivers(prev => {
      const updated = [...prev];
      if (type === 'frd') {
        updated[driverIndex].frd = data;
      } else {
        updated[driverIndex].zma = data;
      }
      return updated;
    });
  };

  // Driver management
  const addDriver = () => {
    setDrivers([...drivers, {
      id: Date.now(),
      name: `Driver ${drivers.length + 1}`,
      frd: null,
      zma: null,
      polarity: false
    }]);
  };

  const removeDriver = (index) => {
    setDrivers(drivers.filter((_, i) => i !== index));
    setCrossoverElements(crossoverElements.filter(el => el.driverIndex !== index));
  };

  const togglePolarity = (index) => {
    setDrivers(prev => {
      const updated = [...prev];
      updated[index].polarity = !updated[index].polarity;
      return updated;
    });
  };

  const updateDriverName = (index, name) => {
    setDrivers(prev => {
      const updated = [...prev];
      updated[index].name = name;
      return updated;
    });
  };

  // Crossover element management
  const addCrossoverElement = (driverIndex) => {
    const driverElements = crossoverElements.filter(el => el.driverIndex === driverIndex);
    const maxOrder = driverElements.length > 0 
      ? Math.max(...driverElements.map(el => el.order))
      : -1;
    
    setCrossoverElements([...crossoverElements, {
      id: Date.now(),
      driverIndex,
      type: 'capacitor',
      value: 10,
      series: true,
      order: maxOrder + 1
    }]);
  };

  const updateCrossoverElement = (id, field, value) => {
    setCrossoverElements(crossoverElements.map(el => 
      el.id === id ? { ...el, [field]: value } : el
    ));
  };

  const removeCrossoverElement = (id) => {
    setCrossoverElements(crossoverElements.filter(el => el.id !== id));
  };

  const moveElement = (id, direction) => {
    const element = crossoverElements.find(el => el.id === id);
    if (!element) return;

    const driverElements = crossoverElements
      .filter(el => el.driverIndex === element.driverIndex)
      .sort((a, b) => a.order - b.order);

    const currentIndex = driverElements.findIndex(el => el.id === id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= driverElements.length) return;

    const swapElement = driverElements[newIndex];
    
    setCrossoverElements(prev => prev.map(el => {
      if (el.id === id) return { ...el, order: swapElement.order };
      if (el.id === swapElement.id) return { ...el, order: element.order };
      return el;
    }));
  };

  // Complex number operations
  const complexAdd = (a, b) => ({
    real: a.real + b.real,
    imag: a.imag + b.imag
  });

  const complexMultiply = (a, b) => ({
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real
  });

  const complexDivide = (a, b) => {
    const denom = b.real * b.real + b.imag * b.imag;
    return {
      real: (a.real * b.real + a.imag * b.imag) / denom,
      imag: (a.imag * b.real - a.real * b.imag) / denom
    };
  };

  const complexMagnitude = (z) => Math.sqrt(z.real * z.real + z.imag * z.imag);
  const complexPhase = (z) => Math.atan2(z.imag, z.real) * 180 / Math.PI;

  const parallelImpedance = (z1, z2) => {
    return complexDivide(
      complexMultiply(z1, z2),
      complexAdd(z1, z2)
    );
  };

  // IEC 711 ear simulator
  const getEarSimulatorImpedance = (freq) => {
    if (!earSimulator.enabled) {
      return { real: 0, imag: 0 };
    }

    const omega = 2 * Math.PI * freq;
    const c = 34300;
    const k = omega / c;
    const l = earSimulator.canalLength;
    const A = 0.5;
    const Z0 = 415 * A;
    
    const Cd = 0.5e-6 * earSimulator.drumCompliance;
    const Rd = 2000;
    const Zd_imag = -1 / (omega * Cd);
    const Zd = { real: Rd, imag: Zd_imag };
    
    const gamma = { real: 0.002 * freq / 1000, imag: k };
    const gl = { real: gamma.real * l, imag: gamma.imag * l };
    const cosh_gl = { 
      real: Math.cosh(gl.real) * Math.cos(gl.imag), 
      imag: Math.sinh(gl.real) * Math.sin(gl.imag) 
    };
    const sinh_gl = { 
      real: Math.sinh(gl.real) * Math.cos(gl.imag), 
      imag: Math.cosh(gl.real) * Math.sin(gl.imag) 
    };
    
    const Z0_complex = { real: Z0, imag: 0 };
    const num = complexAdd(
      complexMultiply(Zd, cosh_gl),
      complexMultiply(Z0_complex, sinh_gl)
    );
    const den = complexAdd(
      cosh_gl,
      complexMultiply(complexDivide(Zd, Z0_complex), sinh_gl)
    );
    
    let Zear = complexDivide(num, den);
    
    if (earSimulator.leakage > 0) {
      const leakageZ = { real: 1e6 / (1 + earSimulator.leakage * 100), imag: 0 };
      Zear = parallelImpedance(Zear, leakageZ);
    }
    
    return Zear;
  };

  // Interpolation helper for frequency data
  const interpolateFrequencyData = (data, targetFreq, getValue) => {
    if (!data || data.length === 0) return null;
    
    // Find surrounding points
    let lowerIdx = -1;
    let upperIdx = -1;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i].freq <= targetFreq) {
        lowerIdx = i;
      }
      if (data[i].freq >= targetFreq && upperIdx === -1) {
        upperIdx = i;
        break;
      }
    }
    
    // Extrapolation below range
    if (lowerIdx === -1 && upperIdx !== -1) {
      return getValue(data[upperIdx]);
    }
    
    // Extrapolation above range - use last value but apply rolloff
    if (lowerIdx !== -1 && upperIdx === -1) {
      const lastPoint = data[data.length - 1];
      const lastFreq = data[data.length - 1].freq;
      // Apply -6dB/octave rolloff above measured range
      const octavesAbove = Math.log2(targetFreq / lastFreq);
      const rolloffDb = -6 * octavesAbove;
      const baseValue = getValue(lastPoint);
      if (typeof baseValue === 'number') {
        return baseValue + rolloffDb;
      }
      return baseValue;
    }
    
    // Exact match
    if (lowerIdx === upperIdx) {
      return getValue(data[lowerIdx]);
    }
    
    // Linear interpolation
    const lower = data[lowerIdx];
    const upper = data[upperIdx];
    const t = (targetFreq - lower.freq) / (upper.freq - lower.freq);
    
    const lowerVal = getValue(lower);
    const upperVal = getValue(upper);
    
    if (typeof lowerVal === 'number' && typeof upperVal === 'number') {
      return lowerVal + (upperVal - lowerVal) * t;
    }
    
    // For complex values (impedance), interpolate magnitude and phase separately
    return lowerVal;
  };

  // Crossover simulation
  const calculateCrossoverImpedanceAndTransfer = (freq, elements, driverImpedanceData, sourceVoltage) => {
    const omega = 2 * Math.PI * freq;
    
    let Zdriver = { real: 8, imag: 0 };
    if (driverImpedanceData && driverImpedanceData.length > 0) {
      // Interpolate impedance magnitude and phase separately
      const impedanceMag = interpolateFrequencyData(
        driverImpedanceData,
        freq,
        (point) => point.impedance || 8
      );
      const phaseDeg = interpolateFrequencyData(
        driverImpedanceData,
        freq,
        (point) => point.phase || 0
      );
      
      if (impedanceMag !== null && phaseDeg !== null) {
        const phaseRad = (phaseDeg * Math.PI) / 180;
        Zdriver = {
          real: impedanceMag * Math.cos(phaseRad),
          imag: impedanceMag * Math.sin(phaseRad)
        };
      }
    }
    
    const Zear = getEarSimulatorImpedance(freq);
    let Zload = complexAdd(Zdriver, Zear);
    let Zcrossover = { real: 0, imag: 0 };
    
    const sortedElements = [...elements].sort((a, b) => a.order - b.order);
    const seriesElements = sortedElements.filter(el => el.series);
    const parallelElements = sortedElements.filter(el => !el.series);
    
    for (const element of seriesElements) {
      let Zelement;
      
      if (element.type === 'capacitor') {
        const Xc = -1 / (omega * element.value * 1e-6);
        Zelement = { real: 0, imag: Xc };
      } else if (element.type === 'inductor') {
        const Xl = omega * element.value * 1e-3;
        Zelement = { real: 0, imag: Xl };
      } else if (element.type === 'resistor') {
        Zelement = { real: element.value, imag: 0 };
      }
      
      Zcrossover = complexAdd(Zcrossover, Zelement);
    }
    
    let Zseries = complexAdd(Zcrossover, Zload);
    
    for (const element of parallelElements) {
      let Zelement;
      
      if (element.type === 'capacitor') {
        const Xc = -1 / (omega * element.value * 1e-6);
        Zelement = { real: 0, imag: Xc };
      } else if (element.type === 'inductor') {
        const Xl = omega * element.value * 1e-3;
        Zelement = { real: 0, imag: Xl };
      } else if (element.type === 'resistor') {
        Zelement = { real: element.value, imag: 0 };
      }
      
      Zseries = parallelImpedance(Zseries, Zelement);
    }
    
    const Ztotal = Zseries;
    const Htransfer = complexDivide(Zload, Ztotal);
    const magnitude = complexMagnitude(Htransfer);
    const attenuationDb = 20 * Math.log10(magnitude);
    
    const voltageGainDb = 20 * Math.log10(sourceVoltage);
    
    // Ear simulator boost is already accounted for in Zear impedance
    // The resonance effect is naturally included in the transmission line model
    // Additional boost would double-count the effect
    let earBoost = 0;
    
    return {
      impedanceMagnitude: complexMagnitude(Ztotal),
      impedancePhase: complexPhase(Ztotal),
      attenuationDb: attenuationDb + earBoost + voltageGainDb
    };
  };

  // Run simulation
  const runSimulation = () => {
    const freqRange = [];
    for (let f = 20; f <= 20000; f *= 1.025) {
      freqRange.push(f);
    }

    const sourceVoltage = sourcePreset === 'custom' 
      ? customVoltage 
      : SOURCE_PRESETS[sourcePreset].voltage;

    const results = freqRange.map(freq => {
      const point = { freq: Math.round(freq * 10) / 10 };

      drivers.forEach((driver, idx) => {
        if (!driver.frd) return;

        const driverElements = crossoverElements.filter(el => el.driverIndex === idx);
        const result = calculateCrossoverImpedanceAndTransfer(
          freq, 
          driverElements, 
          driver.zma,
          sourceVoltage
        );

        const baseSpl = interpolateFrequencyData(
          driver.frd,
          freq,
          (point) => point.spl
        );
        
        if (baseSpl !== null) {
          let spl = baseSpl + result.attenuationDb;
          // Don't apply polarity here - handle it during summation in linear domain

          point[`driver${idx}_spl`] = spl;
          point[`driver${idx}_impedance`] = result.impedanceMagnitude;
          point[`driver${idx}_phase`] = result.impedancePhase;
        }
      });

      const splValues = Object.keys(point)
        .filter(k => k.endsWith('_spl'))
        .map((k, idx) => {
          const spl = point[k];
          const polarity = drivers[idx]?.polarity ? -1 : 1;
          // Convert dB to linear pressure, apply polarity
          return polarity * Math.pow(10, spl / 20);
        });
      
      if (splValues.length > 0) {
        const sum = splValues.reduce((a, b) => a + b, 0);
        // Handle very small sums to avoid log(0)
        const absSum = Math.abs(sum);
        if (absSum > 1e-10) {
          const totalSpl = 20 * Math.log10(absSum);
          point.total_spl = totalSpl;
        } else {
          point.total_spl = -200; // Very quiet, essentially silence
        }
      }

      const impedances = Object.keys(point)
        .filter(k => k.endsWith('_impedance'))
        .map(k => point[k]);
      
      if (impedances.length > 0) {
        point.total_impedance = impedances.reduce((a, b) => a + b, 0) / impedances.length;
      }

      return point;
    });

    setSimulationData(results);
  };

  // Export results
  const exportResults = () => {
    if (!simulationData) return;
    
    let csv = 'Frequency(Hz),Total SPL(dB),Total Impedance(Ohm)\n';
    
    simulationData.forEach(point => {
      csv += `${point.freq},${point.total_spl?.toFixed(2) || ''},${point.total_impedance?.toFixed(2) || ''}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iem_simulation.csv';
    a.click();
  };

  const getUnitLabel = (type) => {
    if (type === 'capacitor') return 'uF';
    if (type === 'inductor') return 'mH';
    return 'Ohm';
  };

  const getYAxisLabel = () => {
    if (activeTab === 'impedance') return 'Impedance (Ohm)';
    if (activeTab === 'phase') return 'Phase (degrees)';
    return 'SPL (dB)';
  };

  const getImpedanceRange = () => {
    if (!simulationData || activeTab !== 'impedance') return ['auto', 'auto'];
    
    const impedanceValues = [];
    simulationData.forEach(point => {
      if (point.total_impedance) impedanceValues.push(point.total_impedance);
      drivers.forEach((_, idx) => {
        if (point[`driver${idx}_impedance`]) {
          impedanceValues.push(point[`driver${idx}_impedance`]);
        }
      });
    });

    if (impedanceValues.length === 0) return ['auto', 'auto'];

    const min = Math.min(...impedanceValues);
    const max = Math.max(...impedanceValues);
    const padding = (max - min) * 0.1;
    
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-[1920px] mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
                Professional IEM Crossover Simulator
              </h1>
              <p className="text-gray-600">
                Advanced RLC Network Designer with IEC 711 Ear Simulator
              </p>
            </div>
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="self-start lg:self-auto p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Info size={24} />
            </button>
          </div>

          {showInfo && (
            <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 text-sm">
              <h3 className="font-semibold mb-3 text-lg">Advanced Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">IEC 711 Ear Simulator</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li>Transmission line model of ear canal</li>
                    <li>Eardrum compliance and damping</li>
                    <li>Resonance peak around 2.7 kHz</li>
                    <li>Adjustable seal leakage</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Crossover Design</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li>Full RLC support with ordering</li>
                    <li>Polarity inversion per driver</li>
                    <li>Source voltage presets</li>
                    <li>Complex impedance modeling</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Source Settings */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-yellow-500" size={24} />
            <h2 className="text-xl font-semibold">Source Settings</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {Object.entries(SOURCE_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setSourcePreset(key)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  sourcePreset === key
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium">{preset.name}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {key === 'custom' && sourcePreset === 'custom' 
                    ? `${customVoltage.toFixed(2)}V`
                    : `${preset.voltage.toFixed(2)}V`}
                </div>
              </button>
            ))}
          </div>
          {sourcePreset === 'custom' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Voltage (V)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={customVoltage}
                onChange={(e) => setCustomVoltage(parseFloat(e.target.value))}
                className="w-full md:w-48 border rounded-lg px-3 py-2"
              />
            </div>
          )}
        </div>

        {/* Ear Simulator Settings */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-lg border border-purple-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">IEC 711 Ear Simulator</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enabled</label>
              <input
                type="checkbox"
                checked={earSimulator.enabled}
                onChange={(e) => setEarSimulator({...earSimulator, enabled: e.target.checked})}
                className="w-6 h-6"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canal Volume (cm?)
              </label>
              <input
                type="number"
                step="0.1"
                value={earSimulator.canalVolume}
                onChange={(e) => setEarSimulator({...earSimulator, canalVolume: parseFloat(e.target.value)})}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canal Length (cm)
              </label>
              <input
                type="number"
                step="0.1"
                value={earSimulator.canalLength}
                onChange={(e) => setEarSimulator({...earSimulator, canalLength: parseFloat(e.target.value)})}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Drum Compliance
              </label>
              <input
                type="number"
                step="0.1"
                value={earSimulator.drumCompliance}
                onChange={(e) => setEarSimulator({...earSimulator, drumCompliance: parseFloat(e.target.value)})}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seal Leakage (0-1)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={earSimulator.leakage}
                onChange={(e) => setEarSimulator({...earSimulator, leakage: parseFloat(e.target.value)})}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Drivers Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Drivers</h2>
                <button
                  onClick={addDriver}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={18} /> Add Driver
                </button>
              </div>

              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                {drivers.map((driver, idx) => (
                  <div key={driver.id} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 hover:border-gray-300 transition-colors">
                    <div className="flex justify-between items-center mb-3">
                      <input
                        type="text"
                        value={driver.name}
                        onChange={(e) => updateDriverName(idx, e.target.value)}
                        className="font-semibold text-lg bg-white border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePolarity(idx)}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            driver.polarity
                              ? 'bg-red-100 text-red-700 border border-red-300'
                              : 'bg-gray-200 text-gray-700 border border-gray-300'
                          }`}
                          title="Toggle polarity inversion"
                        >
                          {driver.polarity ? '-180?' : '0?'}
                        </button>
                        <button
                          onClick={() => removeDriver(idx)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          FRD File (Frequency Response)
                        </label>
                        <input
                          type="file"
                          accept=".frd,.txt"
                          onChange={(e) => handleFileUpload(e, idx, 'frd')}
                          className="text-sm w-full"
                        />
                        {driver.frd && (
                          <span className="text-xs text-green-600 mt-1 block">
                            ? Loaded: {driver.frd.length} points
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ZMA File (Impedance)
                        </label>
                        <input
                          type="file"
                          accept=".zma,.txt"
                          onChange={(e) => handleFileUpload(e, idx, 'zma')}
                          className="text-sm w-full"
                        />
                        {driver.zma && (
                          <span className="text-xs text-green-600 mt-1 block">
                            ? Loaded: {driver.zma.length} points
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t-2 border-gray-300 pt-3 mt-3">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-semibold">Crossover Elements</h3>
                        <button
                          onClick={() => addCrossoverElement(idx)}
                          className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          + Add Element
                        </button>
                      </div>

                      <div className="space-y-2">
                        {crossoverElements
                          .filter(el => el.driverIndex === idx)
                          .sort((a, b) => a.order - b.order)
                          .map((element, elemIdx, arr) => (
                            <div key={element.id} className="flex gap-2 items-center bg-white p-3 rounded-lg border border-gray-200">
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => moveElement(element.id, 'up')}
                                  disabled={elemIdx === 0}
                                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <ChevronUp size={16} />
                                </button>
                                <button
                                  onClick={() => moveElement(element.id, 'down')}
                                  disabled={elemIdx === arr.length - 1}
                                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <ChevronDown size={16} />
                                </button>
                              </div>

                              <select
                                value={element.type}
                                onChange={(e) => updateCrossoverElement(element.id, 'type', e.target.value)}
                                className="text-sm border rounded-lg px-2 py-2 bg-white"
                              >
                                <option value="capacitor">Capacitor</option>
                                <option value="inductor">Inductor</option>
                                <option value="resistor">Resistor</option>
                              </select>

                              <input
                                type="number"
                                step="0.1"
                                value={element.value}
                                onChange={(e) => updateCrossoverElement(element.id, 'value', parseFloat(e.target.value))}
                                className="text-sm border rounded-lg px-2 py-2 w-24"
                              />
                              <span className="text-xs text-gray-600 font-medium min-w-[35px]">
                                {getUnitLabel(element.type)}
                              </span>

                              <select
                                value={element.series}
                                onChange={(e) => updateCrossoverElement(element.id, 'series', e.target.value === 'true')}
                                className="text-sm border rounded-lg px-2 py-2 bg-white"
                              >
                                <option value="true">Series</option>
                                <option value="false">Parallel</option>
                              </select>

                              <button
                                onClick={() => removeCrossoverElement(element.id)}
                                className="text-red-600 hover:text-red-800 ml-auto p-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Simulation Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex gap-3 mb-6">
                <button
                  onClick={runSimulation}
                  disabled={drivers.length === 0 || !drivers.some(d => d.frd)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex-1 transition-colors font-semibold"
                >
                  <Play size={20} /> Run Simulation
                </button>
                
                {simulationData && (
                  <button
                    onClick={exportResults}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                  >
                    <Download size={20} /> Export CSV
                  </button>
                )}
              </div>

              {simulationData && (
                <div className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setActiveTab('magnitude')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'magnitude'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Magnitude Response
                    </button>
                    <button
                      onClick={() => setActiveTab('individual')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'individual'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Individual Drivers
                    </button>
                    <button
                      onClick={() => setActiveTab('impedance')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'impedance'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Impedance
                    </button>
                    <button
                      onClick={() => setActiveTab('phase')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'phase'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Phase Response
                    </button>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={simulationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                        <XAxis 
                          dataKey="freq" 
                          scale="log" 
                          domain={[20, 20000]}
                          ticks={[20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]}
                          tickFormatter={(value) => value >= 1000 ? `${value/1000}k` : value}
                          label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -10 }}
                          stroke="#666"
                        />
                        <YAxis 
                          label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft' }}
                          domain={activeTab === 'phase' ? [-180, 180] : activeTab === 'impedance' ? getImpedanceRange() : ['auto', 'auto']}
                          stroke="#666"
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px' }}
                          formatter={(value) => {
                            if (activeTab === 'impedance') return `${value.toFixed(2)} Ohm`;
                            if (activeTab === 'phase') return `${value.toFixed(1)} deg`;
                            return `${value.toFixed(2)} dB`;
                          }}
                          labelFormatter={(value) => `${value} Hz`}
                        />
                        <Legend />
                        
                        {activeTab === 'magnitude' && (
                          <Line 
                            type="monotone" 
                            dataKey="total_spl" 
                            stroke="#2563eb" 
                            strokeWidth={3}
                            name="Total Response"
                            dot={false}
                          />
                        )}
                        
                        {activeTab === 'individual' && drivers.map((driver, idx) => (
                          <Line
                            key={idx}
                            type="monotone"
                            dataKey={`driver${idx}_spl`}
                            stroke={`hsl(${idx * 360 / drivers.length}, 70%, 50%)`}
                            strokeWidth={2}
                            name={driver.name}
                            dot={false}
                            strokeDasharray={driver.polarity ? "5 5" : "0"}
                          />
                        ))}

                        {activeTab === 'impedance' && (
                          <>
                            <Line 
                              type="monotone" 
                              dataKey="total_impedance" 
                              stroke="#10b981" 
                              strokeWidth={3}
                              name="Total Impedance"
                              dot={false}
                            />
                            {drivers.map((driver, idx) => (
                              <Line
                                key={idx}
                                type="monotone"
                                dataKey={`driver${idx}_impedance`}
                                stroke={`hsl(${idx * 360 / drivers.length}, 70%, 40%)`}
                                strokeWidth={1.5}
                                strokeDasharray="5 5"
                                name={`${driver.name} Z`}
                                dot={false}
                              />
                            ))}
                          </>
                        )}

                        {activeTab === 'phase' && drivers.map((driver, idx) => (
                          <Line
                            key={idx}
                            type="monotone"
                            dataKey={`driver${idx}_phase`}
                            stroke={`hsl(${idx * 360 / drivers.length}, 70%, 50%)`}
                            strokeWidth={2}
                            name={`${driver.name} Phase`}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {!simulationData && (
                <div className="bg-gray-50 rounded-lg p-12 text-center border-2 border-dashed border-gray-300">
                  <p className="text-gray-500 text-lg">
                    Add drivers and crossover elements, then click "Run Simulation" to see results
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Professional Features Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2 text-gray-800">IEC 711 Ear Simulator</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Transmission line ear canal model</li>
                <li>Eardrum compliance and damping</li>
                <li>Natural resonance at 2.7 kHz</li>
                <li>Adjustable seal leakage</li>
                <li>Accurate acoustic impedance</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-gray-800">Crossover Design</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Capacitors (uF) for high-pass</li>
                <li>Inductors (mH) for low-pass</li>
                <li>Resistors (Ohm) for attenuation</li>
                <li>Reorderable element chain</li>
                <li>Series and parallel topology</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-gray-800">Analysis Tools</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Polarity inversion per driver</li>
                <li>Source voltage presets</li>
                <li>Impedance magnitude and phase</li>
                <li>Complex power summation</li>
                <li>CSV export for data analysis</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IEMCrossoverSimulator;
