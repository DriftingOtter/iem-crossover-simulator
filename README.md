# 🎧 IEM Crossover Simulator

This is a web-based tool for designing and simulating RLC crossover networks for In-Ear Monitors (IEMs). It allows you to upload driver data, build a crossover, and see how it affects the final sound, including a simulation of the human ear's acoustics.

## ✨ Key Features

* **Multi-Driver Support:** Add multiple drivers, each with its own frequency response (`.frd`) and impedance (`.zma`) files.
* **RLC Crossover Builder:** Design circuits using capacitors, inductors, and resistors in both series and parallel.
* **IEC 711 Ear Simulator:** Models the acoustic load of the human ear, including canal resonance and eardrum properties.
* **Source Voltage Presets:** See how different amplifier outputs (e.g., "Apple Dongle," "Desktop DAC") can change the final SPL.
* **Interactive Analysis:**
    * View the final summed **Magnitude Response (SPL)**.
    * See the response of **Individual Drivers** after the crossover.
    * Check the final **Impedance Curve** of the whole system.
    * Analyze the **Phase Response** for driver alignment.
* **Polarity Control:** Instantly flip a driver's polarity by 180 degrees.
* **CSV Export:** Download your simulation results for further analysis.
* **Advanced Interpolation:** Properly interpolates between frequency data points and applies realistic rolloff beyond measured ranges.

## 🧮 How It Works (A Brief Overview)

The simulation is calculated using fundamental electrical and acoustic principles:

1.  **Driver Impedance (ZMA):** Your `.zma` file provides the driver's complex impedance (resistance and phase) at different frequencies. The tool interpolates between data points for smooth curves.
2.  **Ear Simulator:** An acoustic impedance model of the IEC 711 standard (a transmission line model of the ear canal) is calculated and added to the driver's impedance.
3.  **Crossover Elements:** The impedance of each capacitor ($Z_C = 1 / (j\\omega C)$), inductor ($Z_L = j\\omega L$), and resistor ($Z_R = R$) is calculated at each frequency ($\\omega = 2\\pi f$).
4.  **Total Impedance:** The tool calculates the total complex impedance of the driver, ear simulator, and all crossover elements (using rules for series and parallel circuits).
5.  **Voltage Divider:** The crossover and driver/ear load form a complex voltage divider. The tool calculates the transfer function (how much voltage reaches the driver).
6.  **Final SPL:** The attenuation (or gain) from the transfer function is applied to the driver's original `.frd` data (its "raw" SPL) to get the final SPL. Linear interpolation is used between measured points, with realistic rolloff applied beyond the measured frequency range.
7.  **Summing:** For the "Total Response," the SPL values from all drivers are converted from decibels to linear pressure values (respecting polarity/phase), summed together, and then converted back to decibels.

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

You must have [Node.js](https://nodejs.org/) (which includes npm) installed on your system.

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/DriftingOtter/iem-crossover-simulator.git
    cd iem-crossover-simulator
    ```

2.  **Install NPM packages:**
    ```bash
    npm install
    ```
    This will install React, Tailwind CSS, Recharts, and all other dependencies.

3.  **Run the development server:**
    ```bash
    npm start
    ```
    The application will open in your browser at `http://localhost:3000`.

    The development server uses Tailwind CSS via PostCSS (configured automatically with Create React App).

### Building for Production

To build the app for production:

```bash
npm run build
```

This creates an optimized production build in the `build/` folder.

### Deploying to GitHub Pages

The repository is configured to deploy to GitHub Pages:

```bash
npm run deploy
```

This will build the app and deploy it to the `gh-pages` branch, making it available at:
`https://driftingotter.github.io/iem-crossover-simulator/`

## 🛠️ Technology Stack

* **React 18** - UI framework
* **Tailwind CSS v3** - Styling (via PostCSS)
* **Recharts** - Data visualization
* **Lucide React** - Icons
* **Create React App** - Build tooling

## 📝 File Format Support

### FRD Files (Frequency Response Data)
Format: `Frequency(Hz) SPL(dB)` or space/tab separated
```
20    45.2
25    48.1
...
```

### ZMA Files (Impedance Data)
Format: `Frequency(Hz) Impedance(Ohm) Phase(degrees)` or space/tab separated
```
20    8.5    -15.2
25    8.3    -12.1
...
```

## ⚠️ Disclaimer

This tool was created with AI assistance. While the calculations are based on fundamental electrical and acoustic principles, **take results with a grain of salt** on accuracy, especially if you don't understand the math going on. Always double-check results with other tools or real-world measurements if possible.

## 📄 License

This project is open source and available for educational purposes.
