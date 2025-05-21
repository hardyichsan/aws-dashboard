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

    // Fetch pertama
    fetchData();
    const param = document.getElementById('param-select').value;
    const range = document.getElementById('time-range').value;
    fetchHistory(param, range);
    renderWindRose(range);
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

        const dirList = ['N','NE','E','SE','S','SW','W','NW'];
        const bins = {};
        dirList.forEach(d => bins[d] = []);
        for (let i = 0; i < data.wdir.length; i++) {
            const dir = data.wdir[i];
            const spd = data.wspeed[i];
            if (dir !== null && spd !== null) {
                const index = Math.floor(((dir + 22.5) % 360) / 45);
                bins[dirList[index]].push(spd);
            }
        }

        const categories = [1, 3, 5];
        const stacked = dirList.map(dir => {
            const counts = [0, 0, 0, 0];
            bins[dir].forEach(s => {
                if (s <= categories[0]) counts[0]++;
                else if (s <= categories[1]) counts[1]++;
                else if (s <= categories[2]) counts[2]++;
                else counts[3]++;
            });
            return { direction: dir, counts };
        });

        d3.select("#windRoseChart").selectAll("*").remove();
        const w = 300, h = 300, rMin = 30, rMax = Math.min(w, h) / 2 - 20;
        const svg = d3.select("#windRoseChart").append("svg").attr("width", w).attr("height", h)
            .append("g").attr("transform", `translate(${w/2},${h/2})`);
        const angle = d3.scaleBand().domain(dirList).range([0, 2 * Math.PI]).align(0);
        const radius = d3.scaleLinear().domain([0, d3.max(stacked, d => d3.sum(d.counts))]).range([rMin, rMax]);
        const color = d3.scaleOrdinal().domain([0,1,2,3]).range(["#91bfdb", "#fee090", "#fc8d59", "#d73027"]);
        const stack = d3.stack().keys([0,1,2,3]).value((d,k) => d.counts[k]);
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

        svg.append("g").selectAll("text")
            .data(dirList).join("text")
            .attr("text-anchor", "middle")
            .attr("transform", d => {
                const a = angle(d) + angle.bandwidth() / 2;
                return `rotate(${(a * 180/Math.PI - 90)}) translate(${rMax + 10},0) rotate(${a < Math.PI ? 90 : -90})`;
            })
            .text(d => d);
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
