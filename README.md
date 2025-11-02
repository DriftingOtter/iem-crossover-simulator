# 🎧 IEM Crossover Simulator

A web-based tool for designing and simulating RLC crossover networks for In-Ear Monitors (IEMs). Upload driver data, build crossovers, and visualize how they affect the final sound with accurate ear canal simulation.

---

## Features

| Category | Features |
|----------|----------|
| **Driver Management** | Multi-driver support • Polarity control • Individual driver analysis • Upload FRD and ZMA files |
| **Crossover Design** | Capacitors, inductors, resistors • Series and parallel configurations • Real-time calculations |
| **Acoustic Simulation** | IEC 711 ear simulator • Source voltage presets • Accurate impedance loading |
| **Analysis Tools** | Magnitude response (SPL) • Phase response • Impedance curves • CSV export |
| **Processing** | Smart interpolation between data points • Realistic rolloff beyond measured ranges |

---

## How It Works

The simulator uses electrical and acoustic principles to model your IEM system:

1. **Driver Impedance** - Reads complex impedance (magnitude and phase) from your `.zma` file and interpolates between data points.

2. **Ear Canal Simulation** - Adds IEC 711 standard acoustic impedance to model the ear canal's transmission line effect.

3. **Component Impedance** - Calculates impedance for each component at every frequency:
   - Capacitor: Z_C = 1 / (j × 2πf × C)
   - Inductor: Z_L = j × 2πf × L
   - Resistor: Z_R = R

4. **Total Impedance** - Combines all impedances using circuit rules (series: Z_total = Z₁ + Z₂ + ..., parallel: 1/Z_total = 1/Z₁ + 1/Z₂ + ...).

5. **Transfer Function** - Calculates the voltage divider formed by the crossover and driver/ear load.

6. **Final SPL** - Applies the transfer function's attenuation to the driver's raw frequency response from the `.frd` file.

7. **Summation** - Converts all drivers' SPL to linear pressure (respecting polarity), sums them, and converts back to dB.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher)

### Installation

```bash
# Clone the repository
git clone https://github.com/DriftingOtter/iem-crossover-simulator.git
cd iem-crossover-simulator

# Install dependencies
npm install

# Start development server
npm start
```

Opens at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

---

## File Formats

### FRD Files (Frequency Response)

Space or tab-separated: `Frequency(Hz) SPL(dB)`

```
20    45.2
25    48.1
31.5  51.3
```

### ZMA Files (Impedance)

Space or tab-separated: `Frequency(Hz) Impedance(Ohm) Phase(degrees)`

```
20    8.5    -15.2
25    8.3    -12.1
31.5  8.2    -9.8
```

**Note:** First row should be data (no headers). Phase in degrees, not radians.

---

## Deployment to GitHub Pages

### Option 1: GitHub Actions (Automatic)

1. Go to **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Push to `main` branch

Live at: `https://driftingotter.github.io/iem-crossover-simulator/`

### Option 2: Manual

```bash
npm run deploy
```

Then go to **Settings** → **Pages**, select **Deploy from a branch**, choose `gh-pages` branch and `/ (root)` folder.

---

## Technology Stack

- **React 18** - UI framework
- **Tailwind CSS v3** - Styling
- **Recharts** - Charts and visualization
- **Lucide React** - Icons
- **Create React App** - Build tooling

---

## Disclaimer

This tool was created with AI assistance. While calculations are based on established electrical and acoustic principles, **verify results with other tools or measurements when possible**. Simulation accuracy depends on input data quality. Use at your own risk and always test physical builds carefully.

---

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

