const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzExsCH4_GSIxS4X9gqjSU2XEmwgstKPemJF2pUeixHPACME1XVWD0IMwyQZIC0-Knr/exec"; 

let dataMasterKaryawan = [];
let userLat = null;
let userLng = null;
let isLocationValid = false;

// KONFIGURASI 2 TITIK LOKASI & RADIUS (DALAM METER)
const MAX_RADIUS_METER = 200; // Toleransi 200 meter (bagus untuk posisi dalam gedung/Lantai 3)

// Koordinat Asli Lokasi PT LINTAS TATA SAMUDERA
const TITIK_LOKASI_1 = { 
    lat: -6.157882374358362, 
    lng: 106.996006453364, 
    nama: "Villa Mutiara Gading (Kantor Pusat)" 
};

const TITIK_LOKASI_2 = { 
    lat: -6.15708724406157, 
    lng: 106.99707665901374, 
    nama: "Warehouse Lintas Tata Samudera" 
};
// Memulai Kamera Webcam
function startCamera() {
    const video = document.getElementById('webcam');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => {
            console.error("Gagal mengakses kamera:", err);
            alert("Akses kamera diperlukan untuk melakukan absensi!");
        });
}

// Rumus Haversine untuk menghitung jarak 2 titik koordinat (dalam meter)
function hitungJarakMeter(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius bumi dalam meter
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Cek Lokasi GPS Pengguna
function checkLocation() {
    const statusBox = document.getElementById('location-status');

    if (!navigator.geolocation) {
        statusBox.className = "status-info error";
        statusBox.innerText = "Browser tidak mendukung Geolocation GPS.";
        return;
    }

    navigator.geolocation.watchPosition(
        position => {
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;

            // Hitung jarak ke kedua titik lokasi
            const jarakTitik1 = hitungJarakMeter(userLat, userLng, TITIK_LOKASI_1.lat, TITIK_LOKASI_1.lng);
            const jarakTitik2 = hitungJarakMeter(userLat, userLng, TITIK_LOKASI_2.lat, TITIK_LOKASI_2.lng);

            if (jarakTitik1 <= MAX_RADIUS_METER) {
                isLocationValid = true;
                statusBox.className = "status-info success";
                statusBox.innerText = `Lokasi Valid: Terdeteksi di ${TITIK_LOKASI_1.nama} (${Math.round(jarakTitik1)}m)`;
            } else if (jarakTitik2 <= MAX_RADIUS_METER) {
                isLocationValid = true;
                statusBox.className = "status-info success";
                statusBox.innerText = `Lokasi Valid: Terdeteksi di ${TITIK_LOKASI_2.nama} (${Math.round(jarakTitik2)}m)`;
            } else {
                isLocationValid = false;
                const jarakTerdekat = Math.round(Math.min(jarakTitik1, jarakTitik2));
                statusBox.className = "status-info error";
                statusBox.innerText = `Di Luar Radius! Jarak ke lokasi terdekat: ${jarakTerdekat}m (Maksimal ${MAX_RADIUS_METER}m)`;
            }
        },
        error => {
            isLocationValid = false;
            statusBox.className = "status-info error";
            statusBox.innerText = "Gagal mengambil lokasi. Pastikan GPS/Izin Lokasi diizinkan!";
        },
        { enableHighAccuracy: true }
    );
}

// Mengambil Foto Snapshot dari Webcam
function takeSnapshot() {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = 320;
    canvas.height = 240;
    context.drawImage(video, 0, 0, 320, 240);
    
    // Konversi gambar ke format Base64 JPEG
    return canvas.toDataURL('image/jpeg', 0.7);
}

function loadDataKaryawan() {
    if (!SCRIPT_URL) return;
    fetch(SCRIPT_URL)
        .then(response => response.json())
        .then(data => {
            if (Array.isArray(data)) dataMasterKaryawan = data;
        })
        .catch(err => console.error("Gagal memuat master karyawan:", err));
}

function cariKaryawan() {
    const inputID = document.getElementById('idKaryawan').value.trim();
    const inputNama = document.getElementById('namaKaryawan');

    if (!inputID || !Array.isArray(dataMasterKaryawan)) {
        inputNama.value = "";
        return;
    }

    const karyawan = dataMasterKaryawan.find(k => String(k.id).trim() === inputID);
    inputNama.value = karyawan ? karyawan.nama : "";
}

function updateWaktu() {
    const now = new Date();
    const jamStr = String(now.getHours()).padStart(2, '0') + ':' +
                   String(now.getMinutes()).padStart(2, '0') + ':' +
                   String(now.getSeconds()).padStart(2, '0');
    document.getElementById('jam').innerText = jamStr;

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('tanggal').innerText = now.toLocaleDateString('id-ID', options);
}

setInterval(updateWaktu, 1000);
updateWaktu();
loadDataKaryawan();
startCamera();
checkLocation();

function kirimAbsen(tipe) {
    const idKaryawan = document.getElementById('idKaryawan').value.trim();
    const namaKaryawan = document.getElementById('namaKaryawan').value.trim();
    const msgBox = document.getElementById('response-msg');

    if (!idKaryawan || !namaKaryawan) {
        alert("ID Karyawan tidak terdaftar/belum diisi!");
        return;
    }

    if (!isLocationValid) {
        alert("Gagal: Anda berada di luar radius lokasi yang ditentukan untuk melakukan absensi!");
        return;
    }

    const fotoBase64 = takeSnapshot();
    const now = new Date();
    const tanggalStr = now.toLocaleDateString('id-ID');
    const jamStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    msgBox.style.color = "blue";
    msgBox.innerText = "Memproses absensi & mengambil foto...";

    const payload = {
        action: tipe,
        idKaryawan: idKaryawan,
        namaKaryawan: namaKaryawan,
        tanggal: tanggalStr,
        jam: jamStr,
        lokasi: `${userLat}, ${userLng}`,
        foto: fotoBase64
    };

    fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            msgBox.style.color = "green";
            msgBox.innerText = `${data.message} (${jamStr})`;
            document.getElementById('idKaryawan').value = '';
            document.getElementById('namaKaryawan').value = '';
        } else {
            msgBox.style.color = "red";
            msgBox.innerText = `Gagal: ${data.message}`;
        }
    })
    .catch(error => {
        msgBox.style.color = "red";
        msgBox.innerText = "Gagal terhubung ke server Google Sheets.";
        console.error('Error:', error);
    });
}