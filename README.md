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

## 🧮 How It Works (A Brief Overview)

The simulation is calculated using fundamental electrical and acoustic principles:

1.  **Driver Impedance (ZMA):** Your `.zma` file provides the driver's complex impedance (resistance and phase) at different frequencies.
2.  **Ear Simulator:** An acoustic impedance model of the IEC 711 standard (a transmission line model of the ear canal) is calculated and added to the driver's impedance.
3.  **Crossover Elements:** The impedance of each capacitor ($Z_C = 1 / (j\omega C)$), inductor ($Z_L = j\omega L$), and resistor ($Z_R = R$) is calculated at each frequency ($\omega = 2\pi f$).
4.  **Total Impedance:** The tool calculates the total complex impedance of the driver, ear simulator, and all crossover elements (using rules for series and parallel circuits).
5.  **Voltage Divider:** The crossover and driver/ear load form a complex voltage divider. The tool calculates the transfer function (how much voltage reaches the driver).
6.  **Final SPL:** The attenuation (or gain) from the transfer function is applied to the driver's original `.frd` data (its "raw" SPL) to get the final SPL.
7.  **Summing:** For the "Total Response," the SPL values from all drivers are converted from decibels to linear pressure values (respecting polarity/phase), summed together, and then converted back to decibels.

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

You must have [Node.js](https://nodejs.org/) (which includes npm) installed on your system.

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/your-repo-name.git](https://github.com/your-username/your-repo-name.git)
    cd your-repo-name
    ```
2.  **Install NPM packages:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm start
    ```
    The application will open in your browser at `http://localhost:3000`.

## ⚠️ Disclaimer

This was made in like an hour with AI, so **TAKE IT WITH A GRAIN OF SALT** on accuracy, especially if you don't understand the math going on. Always double-check results with other tools or real-world measurements if possible.
