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
        canalVolume: 1.0, // in cc
        canalLength: 1.2, // in cm
        drumCompliance: 1.0, // multiplier
        leakage: 0.0 // 0-1 range
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
        const newIndex = direction === 'up' ? currentIndex - 1 : newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

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
        if (denom === 0) return { real: 0, imag: 0 };
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

    // --- NEW HELPER FUNCTION ---
    // Helper for a parallel RLC branch
    const parallelRLC = (R, L, C, omega) => {
        // Avoid division by zero
        if (R < 1e-9) R = 1e-9;
        if (L < 1e-12) L = 1e-12;
        if (C < 1e-15) C = 1e-15;

        const Z_R = { real: R, imag: 0 };
        const Z_L = { real: 0, imag: omega * L };
        // Avoid division by zero at DC (freq=0)
        const Z_C = { real: 0, imag: (omega > 1e-6) ? -1 / (omega * C) : -1e12 };

        // 1 / Z_total = 1/R + 1/Z_L + 1/Z_C
        const Y_R = { real: 1 / R, imag: 0 };
        const Y_L = { real: 0, imag: -1 / (omega * L) };
        const Y_C = { real: 0, imag: omega * C };

        const Y_total = complexAdd(Y_R, complexAdd(Y_L, Y_C));

        // Z_total = 1 / Y_total
        return complexDivide({ real: 1, imag: 0 }, Y_total);
    };

    // --- REPLACED FUNCTION 1: IEC 60318-4 (711) Ear Simulator ---

    // Pre-calculated acoustic impedance magnitude at 200 Hz for reference
    // This is from the standard model below with default parameters.
    const Z_EAR_REF_MAG = 163.5;

    /**
     * Calculates the ACOUSTIC IMPEDANCE (Za) of the IEC 60318-4 ear simulator.
     * This is based on the standard RLC equivalent circuit model.
     * The sliders for compliance, length, and volume now *perturb* this standard model.
     */
    const getEarSimulatorImpedance = (freq) => {
        if (!earSimulator.enabled) {
            // Return a flat, purely resistive impedance if disabled
            // This means earBoostDb will be 0
            return { real: Z_EAR_REF_MAG, imag: 0 };
        }

        const omega = 2 * Math.PI * freq;

        // --- Standard IEC 60318-4 Equivalent Circuit Parameters ---
        // These values represent the acoustic impedance in Pa*s/m^3

        // Main tube resonance (approximates the canal)
        const R0 = 155.8;
        const L0_base = 0.0076;

        // First parallel resonance (Helmholtz resonance of coupler main volume)
        const R1 = 292;
        const L1 = 0.021;
        const C1_base = 200e-9;

        // Second parallel resonance (Eardrum compliance and mass)
        const R2 = 1437;
        const L2 = 0.106;
        const C2_base = 30e-9;

        // --- Apply Simulator Settings ---
        // We use the sliders to "perturb" the standard model

        // Scale canal length (L0) and volume (C1)
        // Assumes defaults are 1.2cm and 1.0cc
        const L0_scaled = L0_base * (earSimulator.canalLength / 1.2);
        const C1_scaled = C1_base * (earSimulator.canalVolume / 1.0);

        // Scale drum compliance (C2)
        const C2_scaled = C2_base * earSimulator.drumCompliance;

        // --- Calculate Circuit Impedance ---

        // 1. Main branch (series R-L)
        const Z_branch0 = { real: R0, imag: omega * L0_scaled };

        // 2. First parallel branch (R-L-C)
        const Z_branch1 = parallelRLC(R1, L1, C1_scaled, omega);

        // 3. Second parallel branch (R-L-C)
        const Z_branch2 = parallelRLC(R2, L2, C2_scaled, omega);

        // Total acoustic impedance is the sum of the series branches
        let Zear = complexAdd(Z_branch0, complexAdd(Z_branch1, Z_branch2));

        // 4. Apply leakage as a parallel resistor
        if (earSimulator.leakage > 0) {
            // Create a high-value acoustic resistor for leakage
            // The (1 + ... * 100) is a quick scaling factor
            const R_leak = 1e9 / (1 + earSimulator.leakage * 100);
            Zear = parallelImpedance(Zear, { real: R_leak, imag: 0 });
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
            if (typeof baseValue === 'number' && (baseValue < 200 && baseValue > -200) /* Check if it's SPL */) {
                return baseValue + rolloffDb;
            }
            // For impedance/phase, just return last value
            return baseValue;
        }

        // Exact match
        if (lowerIdx === upperIdx) {
            return getValue(data[lowerIdx]);
        }

        // Linear interpolation
        const lower = data[lowerIdx];
        const upper = data[upperIdx];

        // Avoid division by zero if freqs are identical
        if (upper.freq - lower.freq < 1e-6) return getValue(lower);

        const t = (targetFreq - lower.freq) / (upper.freq - lower.freq);

        const lowerVal = getValue(lower);
        const upperVal = getValue(upper);

        if (typeof lowerVal === 'number' && typeof upperVal === 'number') {
            // Interpolate in log domain for SPL/Impedance, linear for phase
            if (getValue === ((p) => p.spl) || getValue === ((p) => p.impedance)) {
                const logLower = Math.log10(lowerVal);
                const logUpper = Math.log10(upperVal);
                return Math.pow(10, logLower + (logUpper - logLower) * t);
            }
            // Linear for phase
            return lowerVal + (upperVal - lowerVal) * t;
        }

        return lowerVal;
    };

    // --- REPLACED FUNCTION 2: Crossover Simulation ---

    /**
     * Calculates the crossover's effect on the driver.
     *
     * This function now correctly separates:
     * 1. Electrical Domain: The crossover circuit + driver's electrical impedance (Z.zma).
     * 2. Acoustic Domain: The SPL boost/cut from the ear simulator's acoustic impedance (Z_ear).
     */
    const calculateCrossoverImpedanceAndTransfer = (freq, elements, driverImpedanceData, sourceVoltage) => {
        const omega = 2 * Math.PI * freq;

        // --- 1. Get Driver ELECTRICAL Impedance (from ZMA file) ---
        let Zdriver = { real: 8, imag: 0 }; // Default if no ZMA
        if (driverImpedanceData && driverImpedanceData.length > 0) {
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

        // THIS IS THE CRITICAL FIX:
        // The load for the crossover network is JUST the driver's electrical impedance.
        let Zload = Zdriver;

        // --- 2. Calculate Crossover ELECTRICAL Impedance ---
        const sortedElements = [...elements].sort((a, b) => a.order - b.order);
        const seriesElements = sortedElements.filter(el => el.series);
        const parallelElements = sortedElements.filter(el => !el.series);

        // Start with the load (driver)
        let Z_network = Zload;

        // Apply parallel elements (closest to driver)
        // We reverse to work from load outwards, but order doesn't matter for parallel
        for (const element of parallelElements) {
            let Zelement;
            if (element.type === 'capacitor') Zelement = { real: 0, imag: (omega > 1e-6) ? -1 / (omega * element.value * 1e-6) : -1e12 };
            else if (element.type === 'inductor') Zelement = { real: 0, imag: omega * element.value * 1e-3 };
            else Zelement = { real: element.value, imag: 0 };

            Z_network = parallelImpedance(Z_network, Zelement);
        }

        let Z_series_elements = { real: 0, imag: 0 };
        // Apply series elements
        for (const element of seriesElements) {
            let Zelement;
            if (element.type === 'capacitor') Zelement = { real: 0, imag: (omega > 1e-6) ? -1 / (omega * element.value * 1e-6) : -1e12 };
            else if (element.type === 'inductor') Zelement = { real: 0, imag: omega * element.value * 1e-3 };
            else Zelement = { real: element.value, imag: 0 };

            Z_series_elements = complexAdd(Z_series_elements, Zelement);
        }

        // This is the total electrical impedance seen by the source
        const Z_total_electrical = complexAdd(Z_series_elements, Z_network);

        // --- 3. Calculate ELECTRICAL Voltage Gain ---
        // The voltage *at the driver* (or driver + parallel elements) is V_source * (Z_network / Z_total_electrical)
        const H_electrical = complexDivide(Z_network, Z_total_electrical);
        const electricalGainDb = 20 * Math.log10(complexMagnitude(H_electrical));

        // --- 4. Calculate ACOUSTIC Gain (from Ear Simulator) ---
        // This model assumes the .frd file is a "raw" driver response
        // (e.g., constant volume velocity) and we are adding the coupler's
        // acoustic impedance shape (the resonance peaks).
        const Zear_acoustic = getEarSimulatorImpedance(freq);
        const Zear_magnitude = complexMagnitude(Zear_acoustic);

        // We express the gain relative to a reference (200 Hz)
        // to turn the impedance shape into an SPL "boost" shape.
        const earBoostDb = 20 * Math.log10(Zear_magnitude / Z_EAR_REF_MAG);

        // --- 5. Calculate Final Gain ---
        const voltageGainDb = 20 * Math.log10(sourceVoltage);

        // This is the total gain/attenuation to be *added* to the raw SPL
        const totalGainDb = electricalGainDb + voltageGainDb + (earSimulator.enabled ? earBoostDb : 0);

        return {
            impedanceMagnitude: complexMagnitude(Z_total_electrical),
            impedancePhase: complexPhase(Z_total_electrical),
            attenuationDb: totalGainDb
        };
    };

    // Run simulation
    const runSimulation = () => {
        const freqRange = [];
        // More points for smoother curve
        for (let f = 20; f <= 20000; f *= 1.015) {
            freqRange.push(f);
        }

        const sourceVoltage = sourcePreset === 'custom'
            ? customVoltage
            : SOURCE_PRESETS[sourcePreset].voltage;

        const results = freqRange.map(freq => {
            const point = { freq: freq };

            let totalImpedance = { real: 0, imag: 0 };
            let driversInParallel = 0;

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
                    // 'attenuationDb' is now a total gain, so we add it
                    let spl = baseSpl + result.attenuationDb;

                    point[`driver${idx}_spl`] = spl;
                    point[`driver${idx}_impedance`] = result.impedanceMagnitude;
                    point[`driver${idx}_phase`] = result.impedancePhase;

                    // For total impedance, sum admittances (1/Z)
                    const phaseRad = (result.impedancePhase * Math.PI) / 180;
                    const Z = {
                        real: result.impedanceMagnitude * Math.cos(phaseRad),
                        imag: result.impedanceMagnitude * Math.sin(phaseRad)
                    };
                    const Y = complexDivide({ real: 1, imag: 0 }, Z);
                    totalImpedance = complexAdd(totalImpedance, Y);
                    driversInParallel++;
                }
            });

            // Sum SPL values in linear (pressure) domain
            const splValues = Object.keys(point)
                .filter(k => k.endsWith('_spl'))
                .map((k, idx) => {
                    const spl = point[k];
                    // Polarity is a 180-degree phase shift, or multiplying by -1
                    const polarity = drivers[idx]?.polarity ? -1 : 1;
                    // Convert dB to linear pressure, apply polarity
                    return polarity * Math.pow(10, spl / 20);
                });

            if (splValues.length > 0) {
                const sum = splValues.reduce((a, b) => a + b, 0);
                const absSum = Math.abs(sum);
                if (absSum > 1e-10) {
                    const totalSpl = 20 * Math.log10(absSum);
                    point.total_spl = totalSpl;
                } else {
                    point.total_spl = -200; // Very quiet
                }
            }

            // Finalize total impedance
            if (driversInParallel > 0) {
                const Z_total = complexDivide({ real: 1, imag: 0 }, totalImpedance);
                point.total_impedance = complexMagnitude(Z_total);
                point.total_phase = complexPhase(Z_total);
            }

            return point;
        });

        setSimulationData(results);
    };

    // Export results
    const exportResults = () => {
        if (!simulationData) return;

        let csv = 'Frequency(Hz),Total SPL(dB),Total Impedance(Ohm),Total Phase(deg)\n';

        simulationData.forEach(point => {
            csv += `${point.freq.toFixed(2)},${point.total_spl?.toFixed(2) || ''},${point.total_impedance?.toFixed(2) || ''},${point.total_phase?.toFixed(2) || ''}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'iem_simulation.csv';
        a.click();
        URL.revokeObjectURL(url);
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
            // drivers.forEach((_, idx) => {
            //   if (point[`driver${idx}_impedance`]) {
            //     impedanceValues.push(point[`driver${idx}_impedance`]);
            //   }
            // });
        });

        if (impedanceValues.length === 0) return [0, 50];

        const min = Math.min(...impedanceValues);
        const max = Math.max(...impedanceValues);
        const padding = Math.max(5, (max - min) * 0.1);

        return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
    };

    const getPhaseRange = () => {
        if (activeTab !== 'phase') return ['auto', 'auto'];
        // Clamp phase to a standard -180 to 180 view
        return [-180, 180];
    };

    const getYAxisDomain = () => {
        if (activeTab === 'impedance') return getImpedanceRange();
        if (activeTab === 'phase') return getPhaseRange();
        return ['auto', 'auto'];
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 font-sans">
            <div className="max-w-[1920px] mx-auto p-4 lg:p-8">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
                                Professional IEM Crossover Simulator
                            </h1>
                            <p className="text-gray-600">
                                Advanced RLC Network Designer with IEC 60318-4 Ear Simulator
                            </p>
                        </div>
                        <button
                            onClick={() => setShowInfo(!showInfo)}
                            className="self-start lg:self-auto p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            aria-label="Toggle information panel"
                        >
                            <Info size={24} />
                        </button>
                    </div>

                    {showInfo && (
                        <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 text-sm">
                            <h3 className="font-semibold mb-3 text-lg">Advanced Features</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-medium mb-2">IEC 60318-4 Ear Simulator</h4>
                                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                                        <li>Implements the standard RLC equivalent circuit.</li>
                                        <li>Models eardrum/coupler acoustic impedance.</li>
                                        <li>Generates the characteristic 2.7 kHz resonance.</li>
                                        <li>Sliders perturb the standard model parameters.</li>
                                        <li>Adjustable seal leakage (bass roll-off).</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-medium mb-2">Crossover Design</h4>
                                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                                        <li>Full RLC support with ordering.</li>
                                        <li>Polarity inversion per driver.</li>
                                        <li>Source voltage presets (simulates different amps).</li>
                                        <li>Correctly models electrical/acoustic domains.</li>
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
                                className={`p-3 rounded-lg border-2 transition-all ${sourcePreset === key
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold shadow-inner'
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
                            <label htmlFor="custom-voltage" className="block text-sm font-medium text-gray-700 mb-2">
                                Custom Voltage (V)
                            </label>
                            <input
                                id="custom-voltage"
                                type="number"
                                step="0.1"
                                min="0.1"
                                max="10"
                                value={customVoltage}
                                onChange={(e) => setCustomVoltage(parseFloat(e.target.value) || 0.1)}
                                className="w-full md:w-48 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}
                </div>

                {/* Ear Simulator Settings */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-lg border border-purple-200 p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">IEC 60318-4 Ear Simulator</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <label htmlFor="sim-enabled" className="block text-sm font-medium text-gray-700 mb-2">Enabled</label>
                            <input
                                id="sim-enabled"
                                type="checkbox"
                                checked={earSimulator.enabled}
                                onChange={(e) => setEarSimulator({ ...earSimulator, enabled: e.target.checked })}
                                className="w-6 h-6 rounded text-blue-600 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="sim-volume" className="block text-sm font-medium text-gray-700 mb-2">
                                Coupler Volume (cc)
                            </label>
                            <input
                                id="sim-volume"
                                type="number"
                                step="0.1"
                                value={earSimulator.canalVolume}
                                onChange={(e) => setEarSimulator({ ...earSimulator, canalVolume: parseFloat(e.target.value) || 1.0 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="sim-length" className="block text-sm font-medium text-gray-700 mb-2">
                                Canal Length (cm)
                            </label>
                            <input
                                id="sim-length"
                                type="number"
                                step="0.1"
                                value={earSimulator.canalLength}
                                onChange={(e) => setEarSimulator({ ...earSimulator, canalLength: parseFloat(e.target.value) || 1.2 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="sim-compliance" className="block text-sm font-medium text-gray-700 mb-2">
                                Drum Compliance (x)
                            </label>
                            <input
                                id="sim-compliance"
                                type="number"
                                step="0.1"
                                value={earSimulator.drumCompliance}
                                onChange={(e) => setEarSimulator({ ...earSimulator, drumCompliance: parseFloat(e.target.value) || 1.0 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="sim-leakage" className="block text-sm font-medium text-gray-700 mb-2">
                                Seal Leakage (0-1)
                            </label>
                            <input
                                id="sim-leakage"
                                type="number"
                                step="0.05"
                                min="0"
                                max="1"
                                value={earSimulator.leakage}
                                onChange={(e) => setEarSimulator({ ...earSimulator, leakage: parseFloat(e.target.value) || 0.0 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                                aria-label={`Driver ${idx + 1} name`}
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => togglePolarity(idx)}
                                                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${driver.polarity
                                                            ? 'bg-red-100 text-red-700 border border-red-300'
                                                            : 'bg-gray-200 text-gray-700 border border-gray-300'
                                                        }`}
                                                    title="Toggle polarity inversion"
                                                >
                                                    {driver.polarity ? '-180°' : '0°'}
                                                </button>
                                                <button
                                                    onClick={() => removeDriver(idx)}
                                                    className="text-red-600 hover:text-red-800 p-1"
                                                    aria-label={`Remove ${driver.name}`}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`frd-file-${idx}`}>
                                                    FRD File (Frequency Response)
                                                </label>
                                                <input
                                                    id={`frd-file-${idx}`}
                                                    type="file"
                                                    accept=".frd,.txt"
                                                    onChange={(e) => handleFileUpload(e, idx, 'frd')}
                                                    className="text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                />
                                                {driver.frd && (
                                                    <span className="text-xs text-green-600 mt-1 block">
                                                        ✔ Loaded: {driver.frd.length} points
                                                    </span>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`zma-file-${idx}`}>
                                                    ZMA File (Impedance)
                                                </label>
                                                <input
                                                    id={`zma-file-${idx}`}
                                                    type="file"
                                                    accept=".zma,.txt"
                                                    onChange={(e) => handleFileUpload(e, idx, 'zma')}
                                                    className="text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                                                />
                                                {driver.zma && (
                                                    <span className="text-xs text-green-600 mt-1 block">
                                                        ✔ Loaded: {driver.zma.length} points
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
                                                                    aria-label="Move element up"
                                                                >
                                                                    <ChevronUp size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => moveElement(element.id, 'down')}
                                                                    disabled={elemIdx === arr.length - 1}
                                                                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    aria-label="Move element down"
                                                                >
                                                                    <ChevronDown size={16} />
                                                                </button>
                                                            </div>

                                                            <select
                                                                value={element.type}
                                                                onChange={(e) => updateCrossoverElement(element.id, 'type', e.target.value)}
                                                                className="text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                aria-label="Element type"
                                                            >
                                                                <option value="capacitor">Capacitor</option>
                                                                <option value="inductor">Inductor</option>
                                                                <option value="resistor">Resistor</option>
                                                            </select>

                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={element.value}
                                                                onChange={(e) => updateCrossoverElement(element.id, 'value', parseFloat(e.target.value) || 0)}
                                                                className="text-sm border border-gray-300 rounded-lg px-2 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                aria-label="Element value"
                                                            />
                                                            <span className="text-xs text-gray-600 font-medium min-w-[35px]">
                                                                {getUnitLabel(element.type)}
                                                            </span>

                                                            <select
                                                                value={element.series}
                                                                onChange={(e) => updateCrossoverElement(element.id, 'series', e.target.value === 'true')}
                                                                className="text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                aria-label="Element position"
                                                            >
                                                                <option value="true">Series</option>
                                                                <option value="false">Parallel</option>
                                                            </select>

                                                            <button
                                                                onClick={() => removeCrossoverElement(element.id)}
                                                                className="text-red-600 hover:text-red-800 ml-auto p-1"
                                                                aria-label="Remove element"
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
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'magnitude'
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            Magnitude Response
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('individual')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'individual'
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            Individual Drivers
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('impedance')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'impedance'
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            Impedance
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('phase')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'phase'
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
                                                    tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value}
                                                    label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -10 }}
                                                    stroke="#666"
                                                />
                                                <YAxis
                                                    label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft' }}
                                                    domain={getYAxisDomain()}
                                                    stroke="#666"
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px' }}
                                                    formatter={(value) => {
                                                        if (activeTab === 'impedance') return `${value.toFixed(2)} Ohm`;
                                                        if (activeTab === 'phase') return `${value.toFixed(1)} deg`;
                                                        return `${value.toFixed(2)} dB`;
                                                    }}
                                                    labelFormatter={(value) => `${value.toFixed(0)} Hz`}
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
                                                        stroke={`hsl(${idx * 360 / Math.max(drivers.length, 1)}, 70%, 50%)`}
                                                        strokeWidth={2}
                                                        name={driver.name}
                                                        dot={false}
                                                        strokeDasharray={driver.polarity ? "5 5" : "0"}
                                                    />
                                                ))}

                                                {activeTab === 'impedance' && (
                                                    <Line
                                                        type="monotone"
                                                        dataKey="total_impedance"
                                                        stroke="#10b981"
                                                        strokeWidth={3}
                                                        name="Total Impedance"
                                                        dot={false}
                                                    />
                                                )}

                                                {activeTab === 'phase' && (
                                                    <Line
                                                        type="monotone"
                                                        dataKey="total_phase"
                                                        stroke="#8b5cf6"
                                                        strokeWidth={3}
                                                        name="Total Phase"
                                                        dot={false}
                                                    />
                                                )}
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
                            <h4 className="font-semibold mb-2 text-gray-800">IEC 60318-4 Ear Simulator</h4>
                            <ul className="list-disc list-inside space-y-1 text-gray-700">
                                <li>Standard RLC equivalent circuit</li>
                                <li>Eardrum/coupler acoustic impedance</li>
                                <li>Natural resonance at 2.7 kHz</li>
                                <li>Adjustable seal leakage (bass)</li>
                                <li>Correctly adds acoustic gain</li>
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
                                <li>Total system impedance & phase</li>
                                <li>Complex pressure summation</li>
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

