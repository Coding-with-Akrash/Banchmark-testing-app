"""
PC Benchmark Web Application
Real system benchmarks with no dummy data
"""
import os
import sys
import time
import json
import math
import random
import platform
import tempfile
import threading
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import psutil
except ImportError:
    psutil = None

try:
    import flask
    from flask import Flask, render_template, jsonify, request
except ImportError:
    print("Flask not installed. Run: pip install flask psutil")
    sys.exit(1)

app = Flask(__name__)
app.secret_key = os.urandom(32)

# Store benchmark progress for real-time updates
benchmark_sessions = {}

# Store live stats for real-time monitoring
live_stats = {
    'cpu_percent': 0.0,
    'cpu_per_core': [],
    'memory_percent': 0.0,
    'memory_used_gb': 0.0,
    'memory_total_gb': 0.0,
    'disk_io': {},
    'network_io': {},
    'cpu_freq_current': 0.0,
    'timestamp': None
}

# Initialize CPU monitoring baseline
if psutil:
    psutil.cpu_percent(interval=None)
    psutil.cpu_freq()


def get_live_stats():
    """Get real-time system stats"""
    stats = {}
    now = time.time()
    
    if psutil:
        # CPU usage (instantaneous)
        stats['cpu_percent'] = psutil.cpu_percent(interval=0.1)
        stats['cpu_per_core'] = psutil.cpu_percent(interval=None, percpu=True)
        
        # CPU frequency
        freq = psutil.cpu_freq()
        if freq:
            stats['cpu_freq_current'] = round(freq.current, 2)
            stats['cpu_freq_max'] = round(freq.max, 2) if freq.max else None
            stats['cpu_freq_min'] = round(freq.min, 2) if freq.min else None
        else:
            stats['cpu_freq_current'] = None
            stats['cpu_freq_max'] = None
            stats['cpu_freq_min'] = None
        
        # CPU load average (Unix only)
        try:
            load1, load5, load15 = os.getloadavg()
            stats['load_average'] = {'1m': round(load1, 2), '5m': round(load5, 2), '15m': round(load15, 2)}
        except (AttributeError, OSError):
            stats['load_average'] = None
        
        # Memory
        mem = psutil.virtual_memory()
        stats['memory_percent'] = round(mem.percent, 1)
        stats['memory_used'] = mem.used
        stats['memory_total'] = mem.total
        stats['memory_used_gb'] = round(mem.used / (1024**3), 2)
        stats['memory_total_gb'] = round(mem.total / (1024**3), 2)
        stats['memory_available'] = mem.available
        stats['memory_available_gb'] = round(mem.available / (1024**3), 2)
        stats['memory_cached'] = getattr(mem, 'cached', 0)
        stats['memory_buffers'] = getattr(mem, 'buffers', 0)
        
        # Disk usage per partition
        stats['disk_usage'] = []
        for partition in psutil.disk_partitions():
            try:
                usage = psutil.disk_usage(partition.mountpoint)
                stats['disk_usage'].append({
                    'device': partition.device,
                    'mountpoint': partition.mountpoint,
                    'fstype': partition.fstype,
                    'total_gb': round(usage.total / (1024**3), 2),
                    'used_gb': round(usage.used / (1024**3), 2),
                    'free_gb': round(usage.free / (1024**3), 2),
                    'percent': usage.percent
                })
            except PermissionError:
                pass
        
        # Disk I/O
        disk_io = psutil.disk_io_counters()
        if disk_io:
            stats['disk_io'] = {
                'read_bytes': disk_io.read_bytes,
                'write_bytes': disk_io.write_bytes,
                'read_count': disk_io.read_count,
                'write_count': disk_io.write_count,
                'read_bytes_mb': round(disk_io.read_bytes / (1024*1024), 2),
                'write_bytes_mb': round(disk_io.write_bytes / (1024*1024), 2)
            }
        
        # Per-disk I/O
        try:
            per_disk = psutil.disk_io_counters(perdisk=True)
            if per_disk:
                stats['disk_io_per_disk'] = {}
                for disk_name, disk_counters in per_disk.items():
                    if not disk_name.startswith('loop') and not disk_name.startswith('ram'):
                        stats['disk_io_per_disk'][disk_name] = {
                            'read_bytes': disk_counters.read_bytes,
                            'write_bytes': disk_counters.write_bytes,
                            'read_count': disk_counters.read_count,
                            'write_count': disk_counters.write_count
                        }
        except:
            stats['disk_io_per_disk'] = {}
        
        # Network I/O
        net_io = psutil.net_io_counters()
        if net_io:
            stats['network_io'] = {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv,
                'bytes_sent_mb': round(net_io.bytes_sent / (1024*1024), 2),
                'bytes_recv_mb': round(net_io.bytes_recv / (1024*1024), 2)
            }
        
        # Network interfaces
        stats['network_interfaces'] = []
        for name, addrs in psutil.net_if_addrs().items():
            stats['network_interfaces'].append({'name': name, 'count': len(addrs)})
        
        stats['timestamp'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    return stats


def get_detailed_hardware_info():
    """Get detailed real hardware information including sensors"""
    hw = get_system_info()
    
    # CPU detailed info
    if psutil:
        # Get more CPU details
        try:
            ctx = psutil.cpu_times_percent(interval=0.5)
            hw['cpu_detailed'] = {
                'user': round(ctx.user, 2),
                'system': round(ctx.system, 2),
                'idle': round(ctx.idle, 2),
                'nice': round(ctx.nice, 2),
                'iowait': round(getattr(ctx, 'iowait', 0), 2),
                'irq': round(getattr(ctx, 'irq', 0), 2),
                'softirq': round(getattr(ctx, 'softirq', 0), 2)
            }
        except:
            hw['cpu_detailed'] = None
    
    # GPU info - try multiple methods
    gpu_data = []
    
    # Method 1: psutil sensors (temperatures)
    if psutil:
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                for name, entries in temps.items():
                    for entry in entries:
                        gpu_data.append({
                            'type': 'temperature',
                            'sensor': name,
                            'label': entry.label or name,
                            'current': entry.current,
                            'high': entry.high,
                            'critical': entry.critical
                        })
        except:
            pass
        
        # Method 2: psutil fans
        try:
            fans = psutil.sensors_fans()
            if fans:
                for name, entries in fans.items():
                    for entry in entries:
                        gpu_data.append({
                            'type': 'fan',
                            'sensor': name,
                            'label': entry.label or name,
                            'current': entry.current,
                            'high': getattr(entry, 'high', None),
                        })
        except:
            pass
    
    hw['sensors'] = gpu_data
    
    # Battery info (laptops)
    if psutil:
        try:
            battery = psutil.sensors_battery()
            if battery:
                hw['battery'] = {
                    'percent': battery.percent,
                    'power_plugged': battery.power_plugged,
                    'seconds_left': battery.secsleft if battery.secsleft and battery.secsleft > 0 else None
                }
        except:
            hw['battery'] = None
    
    # Process info (top processes by CPU)
    try:
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'num_threads']):
            try:
                processes.append({
                    'pid': proc.info['pid'],
                    'name': proc.info['name'],
                    'cpu_percent': round(proc.info['cpu_percent'], 1),
                    'memory_percent': round(proc.info['memory_percent'], 1) if proc.info['memory_percent'] else 0,
                    'threads': proc.info['num_threads']
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        # Sort by CPU usage, get top 10
        processes.sort(key=lambda x: x['cpu_percent'], reverse=True)
        hw['top_processes'] = processes[:10]
    except:
        hw['top_processes'] = []
    
    # System uptime
    if psutil:
        uptime_seconds = time.time() - psutil.boot_time()
        days, remainder = divmod(int(uptime_seconds), 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes, seconds = divmod(remainder, 60)
        hw['uptime'] = f'{days}d {hours}h {minutes}m {seconds}s'
    
    return hw


def get_gpu_info():
    """Get GPU info from system"""
    gpu_info = []
    if psutil:
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                for name, entries in temps.items():
                    for entry in entries:
                        gpu_info.append({
                            'sensor': name,
                            'label': entry.label or name,
                            'current': entry.current,
                            'high': entry.high,
                            'critical': entry.critical
                        })
        except:
            pass
    return gpu_info


def get_system_info():
    """Get real system information"""
    info = {}
    
    # Basic system info
    info['system'] = platform.system()
    info['node'] = platform.node()
    info['release'] = platform.release()
    info['version'] = platform.version()
    info['machine'] = platform.machine()
    info['processor'] = platform.processor()
    info['architecture'] = platform.architecture()[0]
    
    # Try to get a better processor name on Windows via WMI
    if platform.system() == 'Windows' and not info['processor'] or info['processor'].startswith('Intel64'):
        try:
            import subprocess
            result = subprocess.run(['wmic', 'cpu', 'get', 'name'], capture_output=True, text=True, timeout=5)
            lines = [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]
            if len(lines) > 1:
                info['processor_full'] = lines[1]
            else:
                info['processor_full'] = None
        except:
            info['processor_full'] = None
    else:
        info['processor_full'] = info['processor']
    
    # CPU info
    if psutil:
        info['cpu_count_physical'] = psutil.cpu_count(logical=False)
        info['cpu_count_logical'] = psutil.cpu_count(logical=True)
        info['cpu_freq'] = psutil.cpu_freq()
        if info['cpu_freq']:
            info['cpu_freq_current'] = round(info['cpu_freq'].current, 2)
            info['cpu_freq_max'] = round(info['cpu_freq'].max, 2) if info['cpu_freq'].max else None
        else:
            info['cpu_freq_current'] = None
            info['cpu_freq_max'] = None
    else:
        info['cpu_count_physical'] = os.cpu_count()
        info['cpu_count_logical'] = os.cpu_count()
        info['cpu_freq_current'] = None
        info['cpu_freq_max'] = None
    
    # Memory info
    if psutil:
        mem = psutil.virtual_memory()
        info['total_memory'] = mem.total
        info['available_memory'] = mem.available
        info['memory_percent'] = mem.percent
        info['total_memory_gb'] = round(mem.total / (1024**3), 2)
        info['available_memory_gb'] = round(mem.available / (1024**3), 2)
    else:
        info['total_memory_gb'] = None
        info['available_memory_gb'] = None
    
    # Disk info
    if psutil:
        disk = psutil.disk_usage('/')
        info['total_disk'] = disk.total
        info['used_disk'] = disk.used
        info['free_disk'] = disk.free
        info['total_disk_gb'] = round(disk.total / (1024**3), 2)
        info['free_disk_gb'] = round(disk.free / (1024**3), 2)
    else:
        info['total_disk_gb'] = None
        info['free_disk_gb'] = None
    
    # Boot time
    if psutil:
        info['boot_time'] = datetime.fromtimestamp(psutil.boot_time()).strftime('%Y-%m-%d %H:%M:%S')
    
    return info


def cpu_benchmark_worker(session_id, iterations, callback):
    """Real CPU benchmark - actual mathematical computations"""
    try:
        results = []
        start_time = time.time()
        
        for i in range(iterations):
            # Real mathematical operations
            score = 0
            iter_start = time.time()
            
            # Mix of operations to test different CPU aspects
            for _ in range(100000):
                # Floating point operations
                score += math.sqrt(random.random() * 10000)
                score += math.sin(random.random() * math.pi * 2)
                score += math.cos(random.random() * math.pi * 2)
                # Integer operations
                score += (random.randint(1, 1000) * random.randint(1, 1000)) % 1000
                # Memory access pattern
                x = [random.random() for _ in range(100)]
                x.sort()
                score += sum(x)
            
            iter_time = time.time() - iter_start
            results.append({
                'iteration': i + 1,
                'score': round(score, 2),
                'time': round(iter_time, 4)
            })
            
            # Update progress
            if callback:
                callback(session_id, {
                    'stage': 'cpu',
                    'progress': int(((i + 1) / iterations) * 100),
                    'iteration': i + 1,
                    'total_iterations': iterations,
                    'current_score': round(score, 2),
                    'time_per_iter': round(iter_time, 4)
                })
        
        total_time = time.time() - start_time
        avg_score = sum(r['score'] for r in results) / len(results)
        
        return {
            'name': 'CPU Benchmark',
            'score': round(avg_score, 2),
            'total_time': round(total_time, 2),
            'iterations': iterations,
            'results': results[-10:]  # Last 10 iterations for detail
        }
    except Exception as e:
        return {'error': str(e)}


def ram_benchmark_worker(session_id, callback):
    """Real RAM benchmark - actual memory allocation and access"""
    try:
        results = {}
        start_time = time.time()
        
        stages = [
            {'name': 'Sequential Write', 'size': 50000000, 'operation': 'write_seq'},
            {'name': 'Sequential Read', 'size': 50000000, 'operation': 'read_seq'},
            {'name': 'Random Write', 'size': 10000000, 'operation': 'write_rand'},
            {'name': 'Random Read', 'size': 10000000, 'operation': 'read_rand'},
        ]
        
        total_stages = len(stages)
        
        for idx, stage in enumerate(stages):
            stage_start = time.time()
            size = stage['size']
            
            if stage['operation'] == 'write_seq':
                # Sequential write - allocate and fill
                data = bytearray(size)
                for i in range(0, size, 1024):
                    data[i:i+1024] = os.urandom(min(1024, size - i))
                stage_time = time.time() - stage_start
                results[stage['name']] = {
                    'time': round(stage_time, 4),
                    'throughput_mbps': round(size / (1024*1024) / stage_time, 2) if stage_time > 0 else 0
                }
                del data
                
            elif stage['operation'] == 'read_seq':
                # Sequential read
                data = bytearray(size)
                for i in range(0, size, 1024):
                    data[i:i+1024] = os.urandom(min(1024, size - i))
                
                read_start = time.time()
                checksum = 0
                for i in range(0, size, 4096):
                    checksum += sum(data[i:i+4096])
                read_time = time.time() - read_start
                results[stage['name']] = {
                    'time': round(read_time, 4),
                    'throughput_mbps': round(size / (1024*1024) / read_time, 2) if read_time > 0 else 0,
                    'checksum': checksum
                }
                del data
                
            elif stage['operation'] == 'write_rand':
                # Random write pattern
                data = {}
                for i in range(100000):
                    key = random.randint(0, size - 1024)
                    data[key] = os.urandom(1024)
                stage_time = time.time() - stage_start
                results[stage['name']] = {
                    'time': round(stage_time, 4),
                    'operations': 100000,
                    'ops_per_sec': int(100000 / stage_time) if stage_time > 0 else 0
                }
                del data
                
            elif stage['operation'] == 'read_rand':
                # Random read pattern
                data = {}
                for i in range(100000):
                    key = random.randint(0, size - 1024)
                    data[key] = os.urandom(1024)
                
                read_start = time.time()
                ops = 0
                for i in range(100000):
                    key = random.randint(0, size - 1024)
                    if key in data:
                        _ = sum(data[key])
                        ops += 1
                read_time = time.time() - read_start
                results[stage['name']] = {
                    'time': round(read_time, 4),
                    'operations': ops,
                    'ops_per_sec': int(ops / read_time) if read_time > 0 else 0
                }
                del data
            
            if callback:
                callback(session_id, {
                    'stage': 'ram',
                    'progress': int(((idx + 1) / total_stages) * 100),
                    'current_stage': stage['name'],
                    'stage_index': idx + 1,
                    'total_stages': total_stages
                })
        
        total_time = time.time() - start_time
        return {
            'name': 'Memory (RAM) Benchmark',
            'total_time': round(total_time, 2),
            'stages': results
        }
    except Exception as e:
        return {'error': str(e)}


def disk_benchmark_worker(session_id, callback):
    """Real Disk I/O benchmark - actual file operations"""
    try:
        results = {}
        start_time = time.time()
        
        # Use temp directory for benchmark
        temp_dir = tempfile.gettempdir()
        test_file = os.path.join(temp_dir, f'benchmark_test_{session_id}.bin')
        file_size = 100 * 1024 * 1024  # 100MB
        
        stages = [
            {'name': 'Write Sequential', 'mode': 'write'},
            {'name': 'Read Sequential', 'mode': 'read'},
        ]
        
        total_stages = len(stages)
        
        for idx, stage in enumerate(stages):
            stage_start = time.time()
            
            if stage['mode'] == 'write':
                # Write test
                with open(test_file, 'wb') as f:
                    # Write in chunks
                    chunk_size = 4 * 1024 * 1024  # 4MB chunks
                    chunks = file_size // chunk_size
                    for _ in range(chunks):
                        f.write(os.urandom(chunk_size))
                    # Write remainder
                    remainder = file_size % chunk_size
                    if remainder > 0:
                        f.write(os.urandom(remainder))
                
                stage_time = time.time() - stage_start
                results[stage['name']] = {
                    'time': round(stage_time, 4),
                    'size_mb': file_size / (1024*1024),
                    'throughput_mbps': round(file_size / (1024*1024) / stage_time, 2) if stage_time > 0 else 0
                }
                
            elif stage['mode'] == 'read':
                # Read test
                read_start = time.time()
                with open(test_file, 'rb') as f:
                    while True:
                        chunk = f.read(4 * 1024 * 1024)
                        if not chunk:
                            break
                        # Do something with data to prevent caching optimization
                        _ = sum(chunk)
                
                read_time = time.time() - read_start
                results[stage['name']] = {
                    'time': round(read_time, 4),
                    'size_mb': file_size / (1024*1024),
                    'throughput_mbps': round(file_size / (1024*1024) / read_time, 2) if read_time > 0 else 0
                }
            
            if callback:
                callback(session_id, {
                    'stage': 'disk',
                    'progress': int(((idx + 1) / total_stages) * 100),
                    'current_stage': stage['name'],
                    'stage_index': idx + 1,
                    'total_stages': total_stages
                })
        
        # Cleanup
        try:
            os.remove(test_file)
        except:
            pass
        
        total_time = time.time() - start_time
        return {
            'name': 'Disk I/O Benchmark',
            'total_time': round(total_time, 2),
            'stages': results
        }
    except Exception as e:
        return {'error': str(e)}


def get_gpu_info():
    """Get GPU info from system"""
    gpu_info = []
    if psutil and hasattr(psutil, 'sensors_temperatures'):
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                for name, entries in temps.items():
                    for entry in entries:
                        gpu_info.append({
                            'sensor': name,
                            'label': entry.label or name,
                            'current': entry.current,
                            'high': entry.high,
                            'critical': entry.critical
                        })
        except:
            pass
    return gpu_info


def overall_score(cpu_score, ram_score, disk_score):
    """Calculate overall score using logarithmic normalization"""
    if not all([cpu_score, ram_score, disk_score]):
        return None
    # Use logarithmic scale for better normalization across different units
    import math
    cpu_norm = min(math.log10(max(cpu_score, 1)) / 8, 1.0)  # CPU scores ~10^7
    ram_norm = min(math.log10(max(ram_score, 1)) / 4, 1.0)   # RAM ~10^3 MB/s
    disk_norm = min(math.log10(max(disk_score, 1)) / 4, 1.0)  # Disk ~10^3 MB/s
    return round((cpu_norm * 0.4 + ram_norm * 0.3 + disk_norm * 0.3) * 10000, 0)


def run_full_benchmark(session_id):
    """Run all benchmarks"""
    session = benchmark_sessions.get(session_id)
    if not session:
        return
    
    results = {
        'system_info': get_system_info(),
        'cpu': None,
        'ram': None,
        'disk': None,
        'gpu': None,
        'overall_score': None,
        'completed_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    def progress_callback(sid, data):
        if sid in benchmark_sessions:
            benchmark_sessions[sid]['progress'] = data
            benchmark_sessions[sid]['last_update'] = time.time()
    
    try:
        # CPU Benchmark
        if session.get('cpu', True):
            results['cpu'] = cpu_benchmark_worker(session_id, 5, progress_callback)
        
        # RAM Benchmark
        if session.get('ram', True):
            results['ram'] = ram_benchmark_worker(session_id, progress_callback)
        
        # Disk Benchmark
        if session.get('disk', True):
            results['disk'] = disk_benchmark_worker(session_id, progress_callback)
        
        # GPU Info
        results['gpu'] = get_gpu_info()
        
        # Calculate overall score
        cpu_s = results['cpu'].get('score') if results['cpu'] else None
        ram_s = 0
        if results['ram'] and results['ram'].get('stages'):
            ram_s = sum(s.get('throughput_mbps', 0) for s in results['ram']['stages'].values())
        disk_s = 0
        if results['disk'] and results['disk'].get('stages'):
            disk_s = sum(s.get('throughput_mbps', 0) for s in results['disk']['stages'].values())
        results['overall_score'] = overall_score(cpu_s, ram_s, disk_s)
        
    except Exception as e:
        results['error'] = str(e)
    
    session['results'] = results
    session['status'] = 'completed'
    session['completed_at'] = time.time()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/system-info')
def api_system_info():
    return jsonify(get_system_info())


@app.route('/api/system-stats')
def api_system_stats():
    """Real-time system stats endpoint"""
    return jsonify(get_live_stats())


@app.route('/api/hardware')
def api_hardware():
    """Detailed hardware info with sensors"""
    return jsonify(get_detailed_hardware_info())


@app.route('/api/benchmark/start', methods=['POST'])
def api_benchmark_start():
    data = request.get_json() or {}
    session_id = str(uuid.uuid4())
    
    benchmark_sessions[session_id] = {
        'id': session_id,
        'status': 'running',
        'progress': {'stage': 'initializing', 'progress': 0},
        'results': None,
        'started_at': time.time(),
        'cpu': data.get('cpu', True),
        'ram': data.get('ram', True),
        'disk': data.get('disk', True),
        'last_update': time.time()
    }
    
    # Run benchmark in background thread
    thread = threading.Thread(target=run_full_benchmark, args=(session_id,))
    thread.daemon = True
    thread.start()
    
    return jsonify({'session_id': session_id, 'status': 'started'})


@app.route('/api/benchmark/status/<session_id>')
def api_benchmark_status(session_id):
    session = benchmark_sessions.get(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    return jsonify({
        'status': session['status'],
        'progress': session['progress'],
        'results': session['results'],
        'elapsed': round(time.time() - session['started_at'], 2) if session['started_at'] else 0
    })


@app.route('/api/benchmark/cancel/<session_id>', methods=['POST'])
def api_benchmark_cancel(session_id):
    if session_id in benchmark_sessions:
        benchmark_sessions[session_id]['status'] = 'cancelled'
        return jsonify({'status': 'cancelled'})
    return jsonify({'error': 'Session not found'}), 404


if __name__ == '__main__':
    print("=" * 50)
    print("  PC Benchmark Web Application")
    print("  Starting server...")
    print("=" * 50)
    print(f"  Open: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
