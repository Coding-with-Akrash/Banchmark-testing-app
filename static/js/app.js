// PC Benchmark Pro - Frontend JavaScript
let currentSessionId = null;
let pollInterval = null;
let statsPollInterval = null;
let cpuChart = null;
let performanceChart = null;
let cpuLiveChart = null;
let memLiveChart = null;
let diskLiveChart = null;
let netLiveChart = null;

// Live monitoring data history (for charts)
const liveData = {
    cpu: { times: [], values: [] },
    mem: { times: [], values: [] },
    disk: { times: [], read: [], write: [] },
    net: { times: [], recv: [], sent: [] },
    maxHistory: 30
};

// Previous values for rate calculation
let prevNetStats = null;
let prevDiskStats = null;
let hardwarePollInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadSystemInfo();
    loadHardwareInfo();
    initLiveCharts();
    startLiveMonitoring();
});

// Start real-time system monitoring
function startLiveMonitoring() {
    loadLiveStats();
    statsPollInterval = setInterval(loadLiveStats, 1000);
    // Poll hardware details (sensors + processes) every 3 seconds
    hardwarePollInterval = setInterval(loadHardwareInfo, 3000);
}

// Load real-time system stats
async function loadLiveStats() {
    try {
        const response = await fetch('/api/system-stats');
        const stats = await response.json();
        
        updateMonitorCards(stats);
        updateLiveCharts(stats);
        updateDetailedSections(stats);
    } catch (error) {
        console.error('Failed to load live stats:', error);
    }
}

// Update detailed hardware sections with live stats
function updateDetailedSections(stats) {
    // Update CPU details tab with live frequency
    if (stats.cpu_freq_current) {
        document.getElementById('cpuCurrentFreq').textContent = 
            `${stats.cpu_freq_current} MHz`;
        document.getElementById('cpuBaseFreq').textContent = 
            `${stats.cpu_freq_max || stats.cpu_freq_current} MHz`;
    }
    
    // Update memory details tab
    if (window.hardwareInfo && window.hardwareInfo.total_memory) {
        const memPercent = stats.memory_percent || 0;
        document.getElementById('memTotal').textContent = 
            formatBytes(window.hardwareInfo.total_memory) + ` (${window.hardwareInfo.total_memory_gb} GB)`;
        document.getElementById('memUsed').textContent = 
            formatBytes(stats.memory_used) + ` (${stats.memory_used_gb} GB)`;
        document.getElementById('memAvailable').textContent = 
            formatBytes(stats.memory_available || 0) + ` (${stats.memory_available_gb || 0} GB)`;
        document.getElementById('memPercent').textContent = `${memPercent}%`;
        document.getElementById('memCached').textContent = 
            window.hardwareInfo.memory_cached ? formatBytes(window.hardwareInfo.memory_cached) : 'N/A';
        document.getElementById('memBuffers').textContent = 
            window.hardwareInfo.memory_buffers ? formatBytes(window.hardwareInfo.memory_buffers) : 'N/A';
    }
    
    // Update storage details tab
    if (stats.disk_usage && stats.disk_usage.length > 0) {
        const storageList = document.getElementById('storageList');
        let html = '';
        stats.disk_usage.forEach(disk => {
            const usagePercent = disk.percent || 0;
            const color = usagePercent > 85 ? '#ff6b6b' : usagePercent > 70 ? '#ffd93d' : '#4ecdc4';
            html += `
                <div class="storage-item">
                    <div class="device-name">${disk.device} (${disk.mountpoint})</div>
                    <div class="device-detail">${disk.fstype} | ${usagePercent}% used | ${disk.used_gb} GB / ${disk.total_gb} GB</div>
                    <div class="storage-bar"><div class="storage-fill" style="width: ${usagePercent}%; background: ${color};"></div></div>
                </div>
            `;
        });
        storageList.innerHTML = html;
    }
    
    // Update network tab
    if (stats.network_io) {
        const networkList = document.getElementById('networkList');
        let html = '';
        if (stats.network_interfaces) {
            stats.network_interfaces.forEach(ni => {
                const recvMB = stats.network_io.bytes_recv_mb || 0;
                const sentMB = stats.network_io.bytes_sent_mb || 0;
                html += `
                    <div class="network-item">
                        <div class="device-name">${ni.name}</div>
                        <div class="device-detail">${ni.count} address(es) | Recv: ${recvMB} MB | Sent: ${sentMB} MB</div>
                    </div>
                `;
            });
        }
        networkList.innerHTML = html;
    }
}

// Load detailed hardware info
async function loadHardwareInfo() {
    try {
        const response = await fetch('/api/hardware');
        const data = await response.json();
        window.hardwareInfo = data;
        populateHardwareDetails(data);
    } catch (error) {
        console.error('Failed to load hardware info:', error);
    }
}

// Populate detailed hardware information
function populateHardwareDetails(data) {
    // CPU Specification
    document.getElementById('cpuSocket').textContent = 
        data.processor_full || data.processor || 'Unknown';
    document.getElementById('cpuBaseFreq').textContent = 
        data.cpu_freq_current ? `${data.cpu_freq_current} MHz` : '--';
    document.getElementById('cpuMaxFreq').textContent = 
        data.cpu_freq_max ? `${data.cpu_freq_max} MHz` : '--';
    document.getElementById('cpuPhysicalCores').textContent = 
        data.cpu_count_physical || '--';
    document.getElementById('cpuLogicalCores').textContent = 
        data.cpu_count_logical || '--';
    document.getElementById('cpuArch').textContent = data.architecture || '--';
    document.getElementById('cpuUptime').textContent = data.uptime || '--';
    
    // Memory Details
    if (data.total_memory) {
        document.getElementById('memTotal').textContent = 
            `${formatBytes(data.total_memory)} (${data.total_memory_gb} GB)`;
        document.getElementById('memUsed').textContent = 
            `${formatBytes(data.memory_used)} (${data.memory_used_gb} GB)`;
        document.getElementById('memAvailable').textContent = 
            `${formatBytes(data.memory_available)} (${data.memory_available_gb} GB)`;
        document.getElementById('memPercent').textContent = 
            `${data.memory_percent}%`;
        document.getElementById('memCached').textContent = 
            data.memory_cached ? formatBytes(data.memory_cached) : 'N/A';
        document.getElementById('memBuffers').textContent = 
            data.memory_buffers ? formatBytes(data.memory_buffers) : 'N/A';
    }
    
    // Storage Details
    const storageList = document.getElementById('storageList');
    if (data.disk_usage && data.disk_usage.length > 0) {
        storageList.innerHTML = '';
        data.disk_usage.forEach(disk => {
            const usagePercent = disk.percent || 0;
            const color = usagePercent > 85 ? '#ff6b6b' : usagePercent > 70 ? '#ffd93d' : '#4ecdc4';
            storageList.innerHTML += `
                <div class="storage-item">
                    <div class="device-name">${disk.device} (${disk.mountpoint})</div>
                    <div class="device-detail">${disk.fstype} | ${usagePercent}% used | ${disk.used_gb} GB / ${disk.total_gb} GB</div>
                    <div class="storage-bar"><div class="storage-fill" style="width: ${usagePercent}%; background: ${color};"></div></div>
                </div>
            `;
        });
    }
    
    // Network Details
    const networkList = document.getElementById('networkList');
    if (data.network_interfaces && data.network_interfaces.length > 0) {
        networkList.innerHTML = '';
        data.network_interfaces.forEach(ni => {
            networkList.innerHTML += `
                <div class="network-item">
                    <div class="device-name">${ni.name}</div>
                    <div class="device-detail">${ni.count} address(es) configured</div>
                </div>
            `;
        });
    }
    
    // Sensors / Temperature
    const sensorList = document.getElementById('sensorList');
    if (data.sensors && data.sensors.length > 0) {
        sensorList.innerHTML = '';
        data.sensors.forEach(sensor => {
            let sensorText = '';
            if (sensor.type === 'temperature') {
                sensorText = `${sensor.label || sensor.sensor}: ${sensor.current}°C`;
                if (sensor.high) sensorText += ` (high: ${sensor.high}°C)`;
                if (sensor.critical) sensorText += ` (crit: ${sensor.critical}°C)`;
            } else if (sensor.type === 'fan') {
                sensorText = `${sensor.label || sensor.sensor}: ${sensor.current} RPM`;
            }
            sensorList.innerHTML += `
                <div class="sensor-item">
                    <div class="device-name">${sensorText}</div>
                    <div class="device-detail">${sensor.type}</div>
                </div>
            `;
        });
    } else {
        sensorList.innerHTML = '<p style="color: var(--text-muted);">No temperature sensors detected on this system.</p>';
    }
    
    // Top Processes
    const processTableBody = document.getElementById('processTableBody');
    if (data.top_processes && data.top_processes.length > 0) {
        processTableBody.innerHTML = '';
        data.top_processes.forEach(proc => {
            const cpuPercent = proc.cpu_percent || 0;
            const cpuColor = cpuPercent > 50 ? '#ff6b6b' : cpuPercent > 20 ? '#ffd93d' : '#4ecdc4';
            processTableBody.innerHTML += `
                <tr>
                    <td>${proc.pid}</td>
                    <td>${proc.name}</td>
                    <td>
                        ${cpuPercent}%
                        <span class="process-cpu-bar" style="background: var(--border);">
                            <span class="process-cpu-fill" style="width: ${Math.min(cpuPercent, 100)}%; background: ${cpuColor};"></span>
                        </span>
                    </td>
                    <td>${proc.memory_percent}%</td>
                    <td>${proc.threads}</td>
                </tr>
            `;
        });
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Tab switching
function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Update monitor cards with real-time data
function updateMonitorCards(stats) {
    // Update system info cards with live data
    if (window.systemInfo) {
        const memPercent = stats.memory_percent || window.systemInfo.memory_percent || 0;
        document.getElementById('memInfo').textContent = 
            `${window.systemInfo.total_memory_gb} GB (${memPercent}% used)`;
        
        const diskPercent = stats.disk_usage ? stats.disk_usage[0]?.percent || 0 : 0;
        if (window.systemInfo.free_disk_gb) {
            document.getElementById('diskInfo').textContent = 
                `${window.systemInfo.total_disk_gb} GB (${window.systemInfo.free_disk_gb} GB free)`;
        }
        
        if (stats.cpu_freq_current) {
            document.getElementById('cpuInfo').textContent = 
                `${window.systemInfo.processor_full || window.systemInfo.processor || 'Unknown'} | ${stats.cpu_freq_current} MHz`;
        }
    }
    
    // CPU
    const cpuPercent = stats.cpu_percent || 0;
    document.getElementById('cpuUsage').textContent = cpuPercent.toFixed(1) + '%';
    document.getElementById('cpuUsageBar').style.width = cpuPercent + '%';
    
    let cpuDetails = '';
    if (stats.cpu_freq_current) {
        cpuDetails += `${stats.cpu_freq_current} MHz`;
    }
    if (stats.cpu_per_core && stats.cpu_per_core.length > 0) {
        cpuDetails += ` | ${stats.cpu_per_core.length} cores`;
    }
    if (stats.load_average) {
        cpuDetails += ` | Load: ${stats.load_average['1m']} (1m)`;
    }
    document.getElementById('cpuDetails').textContent = cpuDetails || 'Monitoring...';
    
    // Apply color thresholds
    const cpuBar = document.getElementById('cpuUsageBar');
    cpuBar.style.background = cpuPercent > 80 ? 'var(--danger)' : 
                              cpuPercent > 60 ? 'var(--warning)' : 'var(--gradient-3)';
    
    // Update per-core CPU bars
    if (stats.cpu_per_core && stats.cpu_per_core.length > 0) {
        const perCoreContainer = document.getElementById('cpuPerCore');
        let coresHtml = '';
        stats.cpu_per_core.forEach((corePercent, idx) => {
            const coreColor = corePercent > 80 ? '#ff6b6b' : corePercent > 60 ? '#ffd93d' : '#00d4ff';
            coresHtml += `
                <div class="core-load">
                    <span class="core-label">Core ${idx}</span>
                    <div class="core-bar"><div class="core-fill" style="width: ${corePercent}%; background: ${coreColor};"></div></div>
                    <span class="core-val">${corePercent.toFixed(1)}%</span>
                </div>
            `;
        });
        perCoreContainer.innerHTML = coresHtml;
    }
    
    // Memory
    const memPercent = stats.memory_percent || 0;
    document.getElementById('memUsage').textContent = memPercent.toFixed(1) + '%';
    document.getElementById('memUsageBar').style.width = memPercent + '%';
    document.getElementById('memDetails').textContent = 
        `${stats.memory_used_gb || 0} GB / ${stats.memory_total_gb || 0} GB available`;
    
    // Disk
    if (stats.disk_io) {
        const readMB = stats.disk_io.read_bytes_mb || 0;
        const writeMB = stats.disk_io.write_bytes_mb || 0;
        document.getElementById('diskUsage').textContent = 
            `${readMB.toFixed(1)}/${writeMB.toFixed(1)} MB`;
        document.getElementById('diskUsageBar').style.width = 
            Math.min((readMB + writeMB) / 1024 * 100, 100) + '%';
        document.getElementById('diskDetails').textContent = 
            `R: ${stats.disk_io.read_count || 0} ops | W: ${stats.disk_io.write_count || 0} ops`;
    }
    
    // Network
    if (stats.network_io) {
        const recvMB = stats.network_io.bytes_recv_mb || 0;
        const sentMB = stats.network_io.bytes_sent_mb || 0;
        document.getElementById('netUsage').textContent = 
            `${recvMB.toFixed(2)}/${sentMB.toFixed(2)} MB`;
        document.getElementById('netUsageBar').style.width = 
            Math.min((recvMB + sentMB) / 1024 * 100, 100) + '%';
        document.getElementById('netDetails').textContent = 
            `R: ${stats.network_io.packets_recv || 0} pkt | S: ${stats.network_io.packets_sent || 0} pkt`;
    }
    
    // Store for rate calculation
    prevNetStats = stats.network_io;
    prevDiskStats = stats.disk_io;
}

// Update live charts
function updateLiveCharts(stats) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();
    
    // CPU chart
    liveData.cpu.times.push(timeLabel);
    liveData.cpu.values.push(stats.cpu_percent || 0);
    if (liveData.cpu.times.length > liveData.maxHistory) {
        liveData.cpu.times.shift();
        liveData.cpu.values.shift();
    }
    if (cpuLiveChart) {
        cpuLiveChart.data.labels = liveData.cpu.times;
        cpuLiveChart.data.datasets[0].data = liveData.cpu.values;
        cpuLiveChart.update('none');
    }
    
    // Memory chart
    liveData.mem.times.push(timeLabel);
    liveData.mem.values.push(stats.memory_percent || 0);
    if (liveData.mem.times.length > liveData.maxHistory) {
        liveData.mem.times.shift();
        liveData.mem.values.shift();
    }
    if (memLiveChart) {
        memLiveChart.data.labels = liveData.mem.times;
        memLiveChart.data.datasets[0].data = liveData.mem.values;
        memLiveChart.update('none');
    }
    
    // Disk chart (I/O rates)
    let diskReadRate = 0, diskWriteRate = 0;
    if (stats.disk_io && prevDiskStats) {
        // Rate = (current - prev) per second
        diskReadRate = ((stats.disk_io.read_bytes || 0) - (prevDiskStats.read_bytes || 0)) / 1024 / 1024;
        diskWriteRate = ((stats.disk_io.write_bytes || 0) - (prevDiskStats.write_bytes || 0)) / 1024 / 1024;
    }
    liveData.disk.times.push(timeLabel);
    liveData.disk.read.push(Math.max(0, diskReadRate));
    liveData.disk.write.push(Math.max(0, diskWriteRate));
    if (liveData.disk.times.length > liveData.maxHistory) {
        liveData.disk.times.shift();
        liveData.disk.read.shift();
        liveData.disk.write.shift();
    }
    if (diskLiveChart) {
        diskLiveChart.data.labels = liveData.disk.times;
        diskLiveChart.data.datasets[0].data = liveData.disk.read;
        diskLiveChart.data.datasets[1].data = liveData.disk.write;
        diskLiveChart.update('none');
    }
    
    // Network chart (bandwidth rates)
    let netRecvRate = 0, netSentRate = 0;
    if (stats.network_io && prevNetStats) {
        netRecvRate = ((stats.network_io.bytes_recv || 0) - (prevNetStats.bytes_recv || 0)) / 1024 / 1024;
        netSentRate = ((stats.network_io.bytes_sent || 0) - (prevNetStats.bytes_sent || 0)) / 1024 / 1024;
    }
    liveData.net.times.push(timeLabel);
    liveData.net.recv.push(Math.max(0, netRecvRate));
    liveData.net.sent.push(Math.max(0, netSentRate));
    if (liveData.net.times.length > liveData.maxHistory) {
        liveData.net.times.shift();
        liveData.net.recv.shift();
        liveData.net.sent.shift();
    }
    if (netLiveChart) {
        netLiveChart.data.labels = liveData.net.times;
        netLiveChart.data.datasets[0].data = liveData.net.recv;
        netLiveChart.data.datasets[1].data = liveData.net.sent;
        netLiveChart.update('none');
    }
}

// Initialize live charts when result cards are visible
function initLiveCharts() {
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                }
            },
            plugins: { legend: { display: false } },
            interpolation: { mode: 'monotone' }
        }
    };
    
    // CPU live chart
    cpuLiveChart = new Chart(document.getElementById('cpuChartLive').getContext('2d'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true
            }]
        }
    });
    
    // Memory live chart
    memLiveChart = new Chart(document.getElementById('memChartLive').getContext('2d'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#4ecdc4',
                backgroundColor: 'rgba(78, 205, 196, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true
            }]
        }
    });
    
    // Disk live chart
    diskLiveChart = new Chart(document.getElementById('diskChartLive').getContext('2d'), {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                }
            },
            plugins: { legend: { display: false } }
        },
        data: {
            labels: [],
            datasets: [
                {
                    data: [],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    label: 'Read'
                },
                {
                    data: [],
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    label: 'Write'
                }
            ]
        }
    });
    
    // Network live chart
    netLiveChart = new Chart(document.getElementById('netChartLive').getContext('2d'), {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                }
            },
            plugins: { legend: { display: false } }
        },
        data: {
            labels: [],
            datasets: [
                {
                    data: [],
                    borderColor: '#ffd93d',
                    backgroundColor: 'rgba(255, 217, 61, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    label: 'Recv'
                },
                {
                    data: [],
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    label: 'Sent'
                }
            ]
        }
    });
}

// Load system information
async function loadSystemInfo() {
    try {
        const response = await fetch('/api/system-info');
        const data = await response.json();
        window.systemInfo = data;
        
        // CPU - use full processor name if available
        const cpuDisplay = data.processor_full || data.processor || 'Unknown';
        document.getElementById('cpuInfo').textContent = cpuDisplay;
        
        // Cores
        document.getElementById('coreInfo').textContent = 
            `${data.cpu_count_physical || '?'} Physical / ${data.cpu_count_logical || '?'} Logical`;
        
        // Memory - show total and usage percentage
        const memDisplay = data.total_memory_gb ? 
            `${data.total_memory_gb} GB (${data.memory_percent || 0}% used)` : 'Unknown';
        document.getElementById('memInfo').textContent = memDisplay;
        
        // Disk - show total and free space
        const diskDisplay = data.total_disk_gb ? 
            `${data.total_disk_gb} GB (${data.free_disk_gb || 0} GB free)` : 'Unknown';
        document.getElementById('diskInfo').textContent = diskDisplay;
        
        // OS
        document.getElementById('osInfo').textContent = 
            `${data.system} ${data.release}`;
        
        // Architecture
        document.getElementById('archInfo').textContent = 
            `${data.architecture || 'Unknown'} (${data.machine})`;
    } catch (error) {
        console.error('Failed to load system info:', error);
    }
}

// Start benchmark
async function startBenchmark() {
    const cpuEnabled = document.getElementById('cpuToggle').checked;
    const ramEnabled = document.getElementById('ramToggle').checked;
    const diskEnabled = document.getElementById('diskToggle').checked;
    
    if (!cpuEnabled && !ramEnabled && !diskEnabled) {
        alert('Please select at least one benchmark type.');
        return;
    }
    
    // Disable start button
    const startBtn = document.getElementById('startBenchmark');
    startBtn.disabled = true;
    
    // Show cancel button
    document.getElementById('cancelBenchmark').style.display = 'flex';
    
    // Show progress section
    document.getElementById('progressSection').style.display = 'block';
    document.getElementById('progressSection').classList.add('fade-in');
    
    // Hide previous results
    document.getElementById('resultsSection').style.display = 'none';
    
    try {
        const response = await fetch('/api/benchmark/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cpu: cpuEnabled,
                ram: ramEnabled,
                disk: diskEnabled
            })
        });
        
        const data = await response.json();
        currentSessionId = data.session_id;
        
        // Start polling for progress
        pollProgress();
        
    } catch (error) {
        console.error('Failed to start benchmark:', error);
        alert('Failed to start benchmark. Please try again.');
        startBtn.disabled = false;
        document.getElementById('cancelBenchmark').style.display = 'none';
    }
}

// Poll for benchmark progress
function pollProgress() {
    if (!currentSessionId) return;
    
    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/benchmark/status/${currentSessionId}`);
            const data = await response.json();
            
            updateProgress(data);
            
            if (data.status === 'completed') {
                clearInterval(pollInterval);
                pollInterval = null;
                displayResults(data.results);
                document.getElementById('startBenchmark').disabled = false;
                document.getElementById('cancelBenchmark').style.display = 'none';
            } else if (data.status === 'cancelled') {
                clearInterval(pollInterval);
                pollInterval = null;
                document.getElementById('progressText').textContent = 'Benchmark cancelled';
                document.getElementById('startBenchmark').disabled = false;
                document.getElementById('cancelBenchmark').style.display = 'none';
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 500);
}

// Cancel benchmark
async function cancelBenchmark() {
    if (!currentSessionId) return;
    
    try {
        await fetch(`/api/benchmark/cancel/${currentSessionId}`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Failed to cancel benchmark:', error);
    }
    
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    
    document.getElementById('startBenchmark').disabled = false;
    document.getElementById('cancelBenchmark').style.display = 'none';
    document.getElementById('progressText').textContent = 'Benchmark cancelled';
}

// Update progress display
function updateProgress(data) {
    const progress = data.progress || {};
    const stage = progress.stage || 'initializing';
    const progressPercent = progress.progress || 0;
    
    // Update main progress bar
    document.getElementById('progressFill').style.width = `${progressPercent}%`;
    
    // Update progress text
    let progressText = '';
    switch(stage) {
        case 'cpu':
            progressText = `CPU Benchmark: Iteration ${progress.iteration || 0} of ${progress.total_iterations || 0}`;
            break;
        case 'ram':
            progressText = `Memory Benchmark: ${progress.current_stage || 'Running'} (${progress.stage_index || 0}/${progress.total_stages || 0})`;
            break;
        case 'disk':
            progressText = `Disk Benchmark: ${progress.current_stage || 'Running'} (${progress.stage_index || 0}/${progress.total_stages || 0})`;
            break;
        default:
            progressText = 'Initializing...';
    }
    document.getElementById('progressText').textContent = progressText;
    
    // Update mini progress bars
    if (stage === 'cpu') {
        const cpuProgress = document.getElementById('cpuProgress');
        cpuProgress.style.width = `${progressPercent}%`;
        document.getElementById('cpuStatus').textContent = `Running... ${progressPercent}%`;
    } else if (stage === 'ram') {
        const ramProgress = document.getElementById('ramProgress');
        ramProgress.style.width = `${progressPercent}%`;
        document.getElementById('ramStatus').textContent = progress.current_stage || 'Running...';
    } else if (stage === 'disk') {
        const diskProgress = document.getElementById('diskProgress');
        diskProgress.style.width = `${progressPercent}%`;
        document.getElementById('diskStatus').textContent = progress.current_stage || 'Running...';
    }
}

// Display results
function displayResults(results) {
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsSection').classList.add('fade-in');
    
    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Display overall score
    displayOverallScore(results);
    
    // Display individual results
    if (results.cpu) displayCPUResults(results.cpu);
    if (results.ram) displayRAMResults(results.ram);
    if (results.disk) displayDiskResults(results.disk);
    
    // Display timestamp
    document.getElementById('completedAt').textContent = results.completed_at || 'Unknown';
    document.getElementById('totalTime').textContent = 
        results.cpu && results.ram && results.disk ? 
        `${(results.cpu.total_time || 0) + (results.ram.total_time || 0) + (results.disk.total_time || 0)}s` : '--';
    
    // Create charts
    createCharts(results);
    
    // Create breakdown table
    createBreakdown(results);
}

// Display overall score
function displayOverallScore(results) {
    const score = results.overall_score || 0;
    const scoreValue = document.getElementById('scoreValue');
    const scoreCircle = document.getElementById('scoreCircle');
    const scoreDescription = document.getElementById('scoreDescription');
    
    // Animate score counting
    animateValue(scoreValue, 0, score, 1500);
    
    // Update circle
    const circumference = 283; // 2 * PI * 45
    const offset = circumference - (score / 10000) * circumference;
    setTimeout(() => {
        scoreCircle.style.strokeDashoffset = offset;
    }, 100);
    
    // Update description
    let rating, colorClass;
    if (score >= 8000) {
        rating = 'Excellent Performance';
        colorClass = 'rating-excellent';
    } else if (score >= 6000) {
        rating = 'Good Performance';
        colorClass = 'rating-good';
    } else if (score >= 4000) {
        rating = 'Average Performance';
        colorClass = 'rating-average';
    } else {
        rating = 'Below Average';
        colorClass = 'rating-poor';
    }
    
    scoreDescription.textContent = rating;
    scoreDescription.className = 'score-description ' + colorClass;
}

// Animate value counting
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Display CPU results
function displayCPUResults(cpuResults) {
    document.getElementById('cpuScore').textContent = cpuResults.score?.toLocaleString() || '--';
    
    const details = document.getElementById('cpuDetails');
    if (cpuResults.error) {
        details.innerHTML = `<p style="color: var(--danger);">Error: ${cpuResults.error}</p>`;
    } else {
        details.innerHTML = `
            <ul>
                <li><span>Total Time</span><strong>${cpuResults.total_time}s</strong></li>
                <li><span>Iterations</span><strong>${cpuResults.iterations}</strong></li>
                <li><span>Score</span><strong>${cpuResults.score?.toLocaleString()}</strong></li>
            </ul>
            <p style="margin-top: 10px; color: var(--text-muted); font-size: 0.9em;">
                Real mathematical operations including floating point, integer, and memory access patterns.
            </p>
        `;
    }
    
    document.getElementById('cpuProgress').style.width = '100%';
    document.getElementById('cpuStatus').textContent = 'Completed';
}

// Display RAM results
function displayRAMResults(ramResults) {
    const details = document.getElementById('ramDetails');
    
    if (ramResults.error) {
        document.getElementById('ramScore').textContent = '--';
        details.innerHTML = `<p style="color: var(--danger);">Error: ${ramResults.error}</p>`;
    } else {
        const stages = ramResults.stages || {};
        const writeSeq = stages['Sequential Write'];
        const readSeq = stages['Sequential Read'];
        
        let ramScore = 0;
        if (writeSeq && writeSeq.throughput_mbps) ramScore += writeSeq.throughput_mbps;
        if (readSeq && readSeq.throughput_mbps) ramScore += readSeq.throughput_mbps;
        
        document.getElementById('ramScore').textContent = Math.round(ramScore).toLocaleString();
        
        let html = '<ul>';
        for (const [name, data] of Object.entries(stages)) {
            html += `<li><span>${name}</span><strong>${data.time}s</strong></li>`;
            if (data.throughput_mbps) {
                html += `<li><span>${name} Throughput</span><strong>${data.throughput_mbps} MB/s</strong></li>`;
            }
            if (data.ops_per_sec) {
                html += `<li><span>${name} Ops</span><strong>${data.ops_per_sec.toLocaleString()} ops/s</strong></li>`;
            }
        }
        html += '</ul>';
        details.innerHTML = html;
    }
    
    document.getElementById('ramProgress').style.width = '100%';
    document.getElementById('ramStatus').textContent = 'Completed';
}

// Display Disk results
function displayDiskResults(diskResults) {
    const details = document.getElementById('diskDetails');
    
    if (diskResults.error) {
        document.getElementById('diskScore').textContent = '--';
        details.innerHTML = `<p style="color: var(--danger);">Error: ${diskResults.error}</p>`;
    } else {
        const stages = diskResults.stages || {};
        const writeSeq = stages['Write Sequential'];
        const readSeq = stages['Read Sequential'];
        
        let diskScore = 0;
        if (writeSeq && writeSeq.throughput_mbps) diskScore += writeSeq.throughput_mbps;
        if (readSeq && readSeq.throughput_mbps) diskScore += readSeq.throughput_mbps;
        
        document.getElementById('diskScore').textContent = Math.round(diskScore).toLocaleString();
        
        let html = '<ul>';
        for (const [name, data] of Object.entries(stages)) {
            html += `<li><span>${name}</span><strong>${data.time}s</strong></li>`;
            html += `<li><span>${name} Throughput</span><strong>${data.throughput_mbps} MB/s</strong></li>`;
        }
        html += '</ul>';
        details.innerHTML = html;
    }
    
    document.getElementById('diskProgress').style.width = '100%';
    document.getElementById('diskStatus').textContent = 'Completed';
}

// Create charts
function createCharts(results) {
    // Performance comparison chart
    const perfCtx = document.getElementById('performanceChart').getContext('2d');
    
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    const labels = [];
    const data = [];
    const colors = [];
    
    if (results.cpu) {
        labels.push('CPU');
        data.push(results.cpu.score || 0);
        colors.push('#00d4ff');
    }
    if (results.ram) {
        labels.push('Memory');
        const ramScore = results.ram.stages ? 
            Object.values(results.ram.stages).reduce((sum, s) => sum + (s.throughput_mbps || 0), 0) : 0;
        data.push(Math.round(ramScore));
        colors.push('#4ecdc4');
    }
    if (results.disk) {
        labels.push('Disk');
        const diskScore = results.disk.stages ? 
            Object.values(results.disk.stages).reduce((sum, s) => sum + (s.throughput_mbps || 0), 0) : 0;
        data.push(Math.round(diskScore));
        colors.push('#ffd93d');
    }
    
    performanceChart = new Chart(perfCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Performance Score',
                data: data,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#b0b8d1'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#b0b8d1'
                    }
                }
            }
        }
    });
    
    // CPU iteration chart
    if (results.cpu && results.cpu.results) {
        const cpuCtx = document.getElementById('cpuChart').getContext('2d');
        
        if (cpuChart) {
            cpuChart.destroy();
        }
        
        const cpuIterations = results.cpu.results.map(r => r.iteration);
        const cpuScores = results.cpu.results.map(r => r.score);
        const cpuTimes = results.cpu.results.map(r => r.time_per_iter);
        
        cpuChart = new Chart(cpuCtx, {
            type: 'line',
            data: {
                labels: cpuIterations,
                datasets: [
                    {
                        label: 'Score',
                        data: cpuScores,
                        borderColor: '#00d4ff',
                        backgroundColor: 'rgba(0, 212, 255, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Time (s)',
                        data: cpuTimes,
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#b0b8d1'
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Iteration',
                            color: '#b0b8d1'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b8d1'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Score',
                            color: '#b0b8d1'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b0b8d1'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Time (s)',
                            color: '#b0b8d1'
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: '#b0b8d1'
                        }
                    }
                }
            }
        });
    }
}

// Create breakdown table
function createBreakdown(results) {
    const breakdownContent = document.getElementById('breakdownContent');
    let html = '<table><thead><tr><th>Benchmark</th><th>Score</th><th>Time</th><th>Details</th></tr></thead><tbody>';
    
    if (results.cpu && !results.cpu.error) {
        html += `
            <tr>
                <td>CPU</td>
                <td>${results.cpu.score?.toLocaleString()}</td>
                <td>${results.cpu.total_time}s</td>
                <td>${results.cpu.iterations} iterations</td>
            </tr>
        `;
    }
    
    if (results.ram && !results.ram.error) {
        const ramScore = results.ram.stages ? 
            Object.values(results.ram.stages).reduce((sum, s) => sum + (s.throughput_mbps || 0), 0) : 0;
        html += `
            <tr>
                <td>Memory</td>
                <td>${Math.round(ramScore).toLocaleString()}</td>
                <td>${results.ram.total_time}s</td>
                <td>${Object.keys(results.ram.stages || {}).length} stages</td>
            </tr>
        `;
    }
    
    if (results.disk && !results.disk.error) {
        const diskScore = results.disk.stages ? 
            Object.values(results.disk.stages).reduce((sum, s) => sum + (s.throughput_mbps || 0), 0) : 0;
        html += `
            <tr>
                <td>Disk</td>
                <td>${Math.round(diskScore).toLocaleString()}</td>
                <td>${results.disk.total_time}s</td>
                <td>${Object.keys(results.disk.stages || {}).length} stages</td>
            </tr>
        `;
    }
    
    html += '</tbody></table>';
    breakdownContent.innerHTML = html;
}
