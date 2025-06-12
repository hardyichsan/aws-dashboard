let map, marker, config;

// Ambil konfigurasi
async function loadConfig() {
    const res = await fetch('/api/config');
    config = await res.json();

    // Tampilkan/hide card berdasarkan config.parameters
    const allCards = document.querySelectorAll('.card');
    allCards.forEach(card => {
        const id = card.id.replace('-card', '');
        card.style.display = config.parameters.includes(id) ? '' : 'none';
    });

    // Dropdown parameter
    const paramSelect = document.getElementById('param-select');
    paramSelect.innerHTML = '';
    config.parameters.forEach(param => {
        const opt = document.createElement('option');
        opt.value = param;
        opt.textContent = param.toUpperCase();
        paramSelect.appendChild(opt);
    });

    // Inisialisasi map
    const { latitude, longitude } = config.geo;
    map = L.map('map').setView([latitude, longitude], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    marker = L.marker([latitude, longitude]).addTo(map).bindPopup("Lokasi Sensor").openPopup();

    // Tampilkan device dan lokasi
    //document.getElementById("device-name").textContent = config.device;
    document.getElementById("map-location").textContent = config.location;

    // Fetch pertama kali
    fetchData();
    const param = paramSelect.value;
    const range = document.getElementById('time-range').value;
    //fetchHistory(param, range);
    renderHistoryChart(param, range);
    renderWindRose(range);

    // Tampilkan footer device dan software version
    if (config.device) {
        document.getElementById('footer-device').textContent = `${config.device}`;
    }
    if (config.software) {
        document.getElementById('footer-version').textContent = `V:${config.software}`;
    }
}

async function fetchData() {
    try {
        const res = await fetch('/api/latest');
        const data = await res.json();

        Object.keys(data).forEach(key => {
            const el = document.getElementById(`${key}-value`);
            if (el && typeof data[key] === 'number') {
                el.textContent = data[key].toFixed(2);
            }
        });

        if (data.timestamp) {
            const formatted = data.timestamp.replace(' ', ' |');
            const timestampEls = document.querySelectorAll('.timestamp');
            timestampEls.forEach(el => el.textContent = formatted);
        }

    } catch (e) {
        console.error("Gagal fetch data terbaru:", e);
    }
}

// async function fetchHistory(param, range) {
//     try {
//         const res = await fetch(`/api/history?param=${param}&range=${range}`);
//         const data = await res.json();
//         chart.data.labels = data.timestamps;
//         chart.data.datasets[0].data = data.values;
//         chart.data.datasets[0].label = param.toUpperCase();
//         chart.update();
//     } catch (e) {
//         console.error("Gagal fetch history:", e);
//     }
// }

async function renderWindRose(range = "realtime") {
    try {
        const res = await fetch(`/api/windrose?range=${range}`);
        const data = await res.json();

        // Buat array dari arah dan kecepatan
        const rawData = [];
        for (let i = 0; i < data.wdir.length; i++) {
            const dir = data.wdir[i];
            const spd = data.wspeed[i];
            if (dir !== null && spd !== null) {
                rawData.push({
                    dir: degToCompass16(dir),
                    speed: spd
                });
            }
        }

        // Kelompokkan data berdasarkan arah
        const grouped = {};
        rawData.forEach(d => {
            if (!grouped[d.dir]) grouped[d.dir] = [];
            grouped[d.dir].push(d.speed);
        });

        const directions = [
            'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
        ];

        const meanSpeeds = directions.map(dir => {
            const speeds = grouped[dir] || [];
            const mean = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
            return +mean.toFixed(2);
        });

        const trace = {
            type: 'barpolar',
            r: meanSpeeds,
            theta: directions,
            name: 'Wind Speed',
            marker: {
                color: meanSpeeds,
                colorscale: 'Bluered',
                colorbar: {
                    title: 'm/s',
                    thickness: 10
                }
            }
        };

        const layout = {
            title: 'Wind Rose (Average Speed)',
            polar: {
                angularaxis: {
                    direction: 'clockwise',
                    rotation: 90
                },
                radialaxis: {
                    ticksuffix: ' m/s',
                    angle: 45
                }
            },
            margin: { t: 50, b: 30, l: 30, r: 30 },
            showlegend: false
        };

        Plotly.newPlot("windRoseChart", [trace], layout);

    } catch (e) {
        console.error("❌ Gagal render wind rose:", e);
    }
}


function degToCompass16(deg) {
    const directions = [
        'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
}

// // Grafik utama
// const ctx = document.getElementById("dataChart").getContext("2d");
// const chart = new Chart(ctx, {
//     type: 'line',
//     data: {
//         labels: [],
//         datasets: [{
//             label: 'Data',
//             data: [],
//             borderColor: 'blue',
//             backgroundColor: 'rgba(0,0,255,0.1)',
//             fill: true,
//             tension: 0.3
//         }]
//     },
//     options: {
//         responsive: true,
//         scales: {
//             x: {
//                 title: { display: true, text: "Waktu" },
//                 ticks: {
//                     callback: function(val) {
//                         const label = this.getLabelForValue(val);
//                         const date = new Date(label);
//                         return `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
//                     }
//                 }
//             },
//             y: {
//                 title: { display: true, text: "Nilai" }
//             }
//         }
//     }
// });

async function renderHistoryChart(param = "temp", range = "realtime") {
    try {
        console.log("🟢 renderHistoryChart() dipanggil:", param, range);
        const res = await fetch(`/api/history?param=${param}&range=${range}`);
        const data = await res.json();

        console.log("📈 Data timestamps:", data.timestamps);
        console.log("📉 Data values:", data.values)

        const trace = {
            x: data.timestamps,
            y: data.values,
            type: 'scatter',
            mode: 'lines+markers',
            name: param.toUpperCase(),
            line: {
                shape: 'spline',
                color: '#0074D9',
                width: 2
            },
            marker: {
                size: 4
            }
        };

        const layout = {
            margin: { t: 30, b: 70, l: 50, r: 20 }, // <- tambah bottom margin
            title: `History of ${param.toUpperCase()}`,
            xaxis: {
                title: 'Waktu',
                tickangle: -45,
                tickformat: "%Y-%m-%d<br>%H:%M",  // <- pisahkan baris
            },
            yaxis: {
                title: 'Nilai'
            },
            plot_bgcolor: '#fafafa',
            paper_bgcolor: '#fff',
            font: {
                size: 12
            }
        };
        ;
        Plotly.newPlot("dataChart", [trace], layout);
    } catch (err) {
        console.error("❌ Gagal render grafik:", err);
    }
}

document.getElementById('export-btn').addEventListener('click', async () => {
    const start = document.getElementById('start-datetime').value;
    const end = document.getElementById('end-datetime').value;
    const destination = document.getElementById('export-destination').value;
    const status = document.getElementById('export-status');

    if (!start || !end) {
        status.textContent = "❌ Start dan end date harus diisi.";
        return;
    }

    status.textContent = "⏳ Memproses export...";

    try {
        const res = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start, end, destination })
        });

        if (destination === 'download') {
            if (!res.ok) {
                const result = await res.json();
                status.textContent = `❌ Gagal: ${result.error || 'Unknown error'}`;
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export_${start}_${end}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            status.textContent = "✅ Berhasil diunduh.";
        } else {
            const result = await res.json();
            if (res.ok) {
                status.textContent = `✅ Tersimpan di USB: ${result.path}`;
            } else {
                status.textContent = `❌ Gagal: ${result.error}`;
            }
        }
    } catch (err) {
        status.textContent = "❌ Terjadi error saat export.";
        console.error(err);
    }
});


// Event listener
document.getElementById('param-select').addEventListener('change', () => {
    const param = document.getElementById('param-select').value;
    const range = document.getElementById('time-range').value;
    renderHistoryChart(param, range);
});

document.getElementById('time-range').addEventListener('change', () => {
    const param = document.getElementById('param-select').value;
    const range = document.getElementById('time-range').value;
    renderHistoryChart(param, range);
    renderWindRose(range);
});

async function loadUsbOptions() {
    try {
        const res = await fetch('/api/usb-list');
        const devices = await res.json();
        const select = document.getElementById('export-destination');
        select.innerHTML = ''; // kosongkan dulu

        devices.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d === 'download' ? 'Download' : `USB: ${d}`;
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn("Gagal memuat USB list:", e);
    }
}

loadUsbOptions(); // Panggil saat halaman dimuat

// Auto refresh tiap 1 menit
setInterval(() => {
    fetchData();
    const param = document.getElementById('param-select').value;
    const range = document.getElementById('time-range').value;
    //fetchHistory(param, range);
    renderHistoryChart(param, range);
    renderWindRose(range);
}, 60000);

// Jalankan pertama kali
loadConfig();
