# Rekap Absensi Karyawan

Aplikasi rekap absensi karyawan berbasis web lokal untuk mencatat, mengelola, dan merekap keterlambatan pegawai.

## Fitur

- Dashboard ringkasan bulan berjalan
- Grafik keterlambatan per tanggal
- Rekap harian
- Rekap bulanan
- Tambah dan edit data keterlambatan
- Hapus data dengan konfirmasi
- Manajemen data pegawai
- Peringatan nama pegawai mirip
- Export Excel
- Backup database SQLite

## Teknologi

- Node.js
- TypeScript
- SQLite
- HTML
- CSS
- JavaScript

## Instalasi

Install dependency:

    npm install

Jalankan aplikasi:

    npm run dev

Buka:

    http://localhost:3000

## Build

Compile TypeScript:

    npm run build

Hasil build disimpan di folder:

    dist/

## Database

Database lokal berada di:

    data/absensi.sqlite

File database tidak disimpan ke GitHub karena berisi data lokal.

## Struktur Utama

    src/
    public/
    data/
    dist/
    package.json
    tsconfig.json

## Pengembangan Selanjutnya

- Input keterlambatan berbasis checkbox pegawai
- Penggabungan data pegawai duplikat
- Audit log
- Filter unit
- Desktop app menggunakan Electron

## Catatan

Jangan upload file berikut ke repository publik:

    node_modules/
    data/absensi.sqlite
    .env

## Lisensi

Project ini digunakan untuk kebutuhan pengembangan dan pembelajaran.