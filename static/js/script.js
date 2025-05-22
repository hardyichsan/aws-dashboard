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
    fetchHistory(param, range);
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

async function fetchHistory(param, range) {
    try {
        const res = await fetch(`/api/history?param=${param}&range=${range}`);
        const data = await res.json();
        chart.data.labels = data.timestamps;
        chart.data.datasets[0].data = data.values;
        chart.data.datasets[0].label = param.toUpperCase();
        chart.update();
    } catch (e) {
        console.error("Gagal fetch history:", e);
    }
}

async function renderWindRose(range) {
    try {
        const res = await fetch(`/api/windrose?range=${range}`);
        const data = await res.json();

        const directions = ['N','NE','E','SE','S','SW','W','NW'];
        const bins = {};
        directions.forEach(d => bins[d] = []);

        for (let i = 0; i < data.wdir.length; i++) {
            const dir = data.wdir[i];
            const spd = data.wspeed[i];
            if (dir !== null && spd !== null) {
                // Bagi arah: N = 337.5–360 & 0–22.5
                const compassIndex = Math.floor(((dir + 22.5) % 360) / 45);
                const correctedIndex = (compassIndex + 1) % 8; // geser agar N = 337.5–22.5
                bins[directions[correctedIndex]].push(spd);
            }
        }

        const categories = [1, 3, 5];
        const stacked = directions.map(dir => {
            const counts = [0, 0, 0, 0];
            bins[dir].forEach(s => {
                if (s <= categories[0]) counts[0]++;
                else if (s <= categories[1]) counts[1]++;
                else if (s <= categories[2]) counts[2]++;
                else counts[3]++;
            });
            return { direction: dir, counts };
        });

        // Hapus isi lama
        d3.select("#windRoseChart").selectAll("*").remove();

        const w = 300, h = 300, rMin = 30, rMax = Math.min(w, h) / 2 - 20;
        const svg = d3.select("#windRoseChart")
            .append("svg")
            .attr("width", w)
            .attr("height", h + 50) // tambahan ruang untuk legenda
            .append("g")
            .attr("transform", `translate(${w / 2},${h / 2})`);

        const angle = d3.scaleBand().domain(directions).range([0, 2 * Math.PI]).align(0);
        const radius = d3.scaleLinear().domain([0, d3.max(stacked, d => d3.sum(d.counts))]).range([rMin, rMax]);
        const color = d3.scaleOrdinal().domain([0, 1, 2, 3]).range(["#91bfdb", "#fee090", "#fc8d59", "#d73027"]);
        const stack = d3.stack().keys([0, 1, 2, 3]).value((d, k) => d.counts[k]);
        const series = stack(stacked);

        svg.append("g").selectAll("g")
            .data(series).join("g")
            .attr("fill", d => color(d.key))
            .selectAll("path")
            .data(d => d).join("path")
            .attr("d", d3.arc()
                .innerRadius(d => radius(d[0]))
                .outerRadius(d => radius(d[1]))
                .startAngle(d => angle(d.data.direction))
                .endAngle(d => angle(d.data.direction) + angle.bandwidth())
                .padAngle(0.01));

        // Tambah label arah
        svg.append("g").selectAll("text")
            .data(directions).join("text")
            .attr("text-anchor", "middle")
            .attr("transform", d => {
                const a = angle(d) + angle.bandwidth() / 2;
                return `rotate(${(a * 180 / Math.PI - 90)}) translate(${rMax + 10},0) rotate(${a < Math.PI ? 90 : -90})`;
            })
            .text(d => d);

        // Legenda kecepatan
        const legend = d3.select("#windRoseChart svg")
            .append("g")
            .attr("transform", `translate(10, ${h + 10})`);

        const legendItems = [
            { label: "≤ 1 m/s", color: "#91bfdb" },
            { label: "1–3 m/s", color: "#fee090" },
            { label: "3–5 m/s", color: "#fc8d59" },
            { label: "> 5 m/s", color: "#d73027" }
        ];

        legend.selectAll("g")
            .data(legendItems).enter().append("g")
            .attr("transform", (d, i) => `translate(${i * 75},0)`)
            .each(function(d) {
                const g = d3.select(this);
                g.append("rect")
                    .attr("width", 12)
                    .attr("height", 12)
                    .attr("fill", d.color);
                g.append("text")
                    .attr("x", 16)
                    .attr("y", 10)
                    .text(d.label)
                    .attr("font-size", "10px")
                    .attr("fill", "#333");
            });

    } catch (e) {
        console.error("Gagal render windrose:", e);
    }
}


// Grafik utama
const ctx = document.getElementById("dataChart").getContext("2d");
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Data',
            data: [],
            borderColor: 'blue',
            backgroundColor: 'rgba(0,0,255,0.1)',
            fill: true,
            tension: 0.3
        }]
    },
    options: {
        responsive: true,
        scales: {
            x: {
                title: { display: true, text: "Waktu" },
                ticks: {
                    callback: function(val) {
                        const label = this.getLabelForValue(val);
                        const date = new Date(label);
                        return `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
                    }
                }
            },
            y: {
                title: { display: true, text: "Nilai" }
            }
        }
    }
});

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
    fetchHistory(param, range);
});

document.getElementById('time-range').addEventListener('change', () => {
    const param = document.getElementById('param-select').value;
    const range = document.getElementById('time-range').value;
    fetchHistory(param, range);
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
    fetchHistory(param, range);
    renderWindRose(range);
}, 60000);

// Jalankan pertama kali
loadConfig();
