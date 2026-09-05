# PC Benchmark Pro

Real-time PC benchmark web application with live system monitoring. No dummy data — all benchmarks run real CPU, memory, and disk operations against your actual hardware.

![Python](https://img.shields.io/badge/Python-3.8%2B-blue)
![Flask](https://img.shields.io/badge/Flask-2.0%2B-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

## Features

- **Real CPU Benchmark** — actual floating-point/integer math across multiple iterations
- **Real Memory Benchmark** — sequential/random read/write throughput in MB/s
- **Real Disk I/O Benchmark** — 100MB file sequential read/write with actual file I/O
- **Live System Monitor** — real-time CPU%, memory%, disk I/O rates, network bandwidth (1s refresh)
- **Detailed Hardware Detection** — processor model, core counts, frequencies, partitions, sensors, top processes, uptime
- **Responsive Dark UI** — modern dashboard with animated charts and progress tracking

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Flask (Python) |
| Frontend | HTML5 + Chart.js |
| System Detection | psutil, platform, subprocess/WMI |
| Styling | Custom CSS (dark theme, animations) |

## Screenshots

The app provides:
- Live monitor cards with per-second CPU/memory/disk/network updates
- 4 live Chart.js line charts with 30-second history
- 6 detailed hardware tabs: CPU, Memory, Storage, Network, Sensors, Processes
- Benchmark progress bars and animated score display

## Setup

### Prerequisites

- Python 3.8+
- pip

### Installation

```bash
# Clone the repository
git clone https://github.com/Coding-with-Akrash/Banchmark-testing-app.git
cd Banchmark-testing-app

# Install dependencies
pip install -r requirements.txt
```

### Run

```bash
python app.py
```

Open `http://localhost:5000` in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Main dashboard |
| GET | `/api/system-info` | Basic system detection |
| GET | `/api/system-stats` | Live system stats (CPU%, memory, disk I/O, network) |
| GET | `/api/hardware` | Detailed hardware info (sensors, processes, uptime) |
| POST | `/api/benchmark/start` | Start benchmark |
| GET | `/api/benchmark/status/<id>` | Check benchmark progress/results |
| POST | `/api/benchmark/cancel/<id>` | Cancel running benchmark |

## Benchmark Details

### CPU
- 5 iterations of mixed mathematical operations
- Tests floating-point (`sqrt`, `sin`, `cos`), integer math, list sorting, and memory access
- Reports average score and per-iteration timing

### Memory (RAM)
- Sequential Write/Read: 50MB bytearray fill + checksum validation
- Random Write/Read: 100,000 dictionary operations with timing
- Reports throughput in MB/s and operations per second

### Disk I/O
- 100MB test file written to system temp directory
- Sequential read with checksum to prevent cache optimization
- Reports throughput in MB/s for both read and write

## Project Structure

```
.
├── app.py                  # Flask backend
├── requirements.txt        # Dependencies
├── .gitignore
├── README.md
├── templates/
│   └── index.html          # Main dashboard
└── static/
    ├── css/
    │   └── style.css       # Dark theme styles
    └── js/
        └── app.js          # Live monitoring + charts
```

## Notes

- Disk benchmarks write/read a 100MB temporary file — ensure adequate disk space and write permissions
- Temperature/fan sensors depend on OS/hardware support via `psutil.sensors_*`
- Windows processor names are resolved via `wmic cpu get name` for accurate model detection
- Benchmark results are not persisted; refresh the page to start fresh

## License

MIT
