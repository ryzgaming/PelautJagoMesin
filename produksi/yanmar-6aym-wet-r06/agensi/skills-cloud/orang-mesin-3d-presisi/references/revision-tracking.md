# Revisi terbuka dan notifikasi

## Satu sumber status
- Gunakan tracker/issue/temuan yang sudah ditetapkan proyek; jangan membuat duplikat yang saling berbeda. Jika belum ada, buat docs/audit/REVISI.md saat proyek tujuan tersedia. Jangan membuat daftar temuan faktual tanpa audit.
- Catat identitas repo/proyek, branch bila relevan, scope mesin/varian, revisi model terakhir yang diaudit, waktu pengecekan, sumber bukti, serta lokasi tracker yang bisa dibaca pemantau. Salinan ZIP lama tidak membuktikan kondisi repo terkini.
- Tabel minimum: ID; part/node; aturan/modul terkait; deskripsi terbukti atau bukti yang kurang; tingkat dampak; audit status; work status; perbaikan yang diperlukan; sumber halaman/timestamp; revisi model; updated_at; due_at bila pengguna menetapkan; bukti retest.
- Jika tidak ada audit, tulis NOT_AUDITED dan tidak ada temuan yang telah diperiksa. Jangan menyimpulkan nol revisi diperlukan atau semua lulus.

## Siklus revisi
Gunakan work status OPEN, IN_PROGRESS, BLOCKED, READY_FOR_REVIEW, CLOSED. Pertahankan audit status PASS, FAIL, UNVERIFIED, atau N/A secara terpisah.
- Temuan yang terbukti belum diperbaiki: OPEN + FAIL.
- Bukti/alat yang belum tersedia: OPEN/BLOCKED + UNVERIFIED; jelaskan data yang diperlukan, bukan menyebut bentuknya salah.
- Perubahan kode/geometri sudah dilakukan tetapi belum diperiksa ulang: READY_FOR_REVIEW; jangan otomatis mengubah audit status menjadi PASS.
- CLOSED hanya jika pemeriksaan ulang yang relevan lulus dengan bukti yang terkait revisi model terbaru. Jika masalah muncul lagi, buka kembali ID yang sama dengan riwayat singkat.
- Jika persyaratan tidak berlaku atau scope berubah, catat alasan N/A dan keputusan pengguna bila diperlukan. Jangan menutup masalah diam-diam karena file hilang, nomor versi berubah, atau waktu berlalu.
- Perbarui tracker setelah audit/perbaikan yang dikerjakan. Jangan mengarang deadline, penanggung jawab, atau bukti pengujian.

## Pemantauan oleh dot/otomasi
- Verifikasi layanan notifikasi yang benar-benar tersedia, sumber yang dapat dibaca, dan project/branch scope. Jangan mengaku terhubung ke dot, HP, atau Codex PC tanpa bukti integrasi. Notifikasi ChatGPT bukan bukti dot terpisah sudah terhubung.
- Jika user meminta pemantauan kondisi tanpa frekuensi, gunakan frekuensi wajar, misalnya harian untuk backlog revisi, pada timezone pengguna. Jelaskan frekuensi saat berhasil dibuat. Gunakan tool otomasi resmi; skill sendiri tidak menjadwalkan eksekusi.
- Baca tracker terbaru dan laporan terkait pada setiap pemeriksaan. Jangan mengaudit ulang seluruh model secara mahal pada tiap polling kecuali diminta. Jika klaim CLOSED tidak memiliki bukti, laporkan verifikasi penutupan yang kurang; jangan mengubah status tanpa dasar.
- Beri notifikasi ringkas bila ditemukan revisi terbuka yang dapat ditindaklanjuti: ID/part, aturan terkait, masalah atau bukti yang kurang, prioritas, langkah berikut, dan tautan sumber terbaru. Bedakan belum diperbaiki dari sudah diperbaiki tetapi belum diuji.
- Hindari mengirim ulang pesan identik pada setiap polling; gunakan riwayat tugas bila tersedia untuk memberi pesan pada temuan baru, perubahan penting, deadline terlewati, atau eskalasi yang disepakati. Jangan menyebut overdue jika due_at belum ditetapkan.
- Jika sumber tidak bisa dibaca, nyatakan pemantauan terhalang, bukan semua revisi selesai. Jangan menyamakan tracker kosong yang belum diaudit dengan model lulus.
- Pertahankan pemantauan sebagai read-only kecuali user meminta perbaikan. Jangan mengirim pesan ke orang lain, membuat issue/comment eksternal, atau mengubah status repo hanya karena notifikasi diperlukan.
- Jika hanya tersedia file lokal Codex yang belum terhubung, minta tautan repo atau laporan yang dapat diakses. Jangan membuat otomasi seolah pemantauan sudah berfungsi sambil berharap akses tersedia nanti.

## Isi notifikasi
"Revisi [ID] — [part/fitur]: [masalah atau bukti yang kurang]. Aturan: [modul]. Status: [work/audit]. Berikutnya: [aksi konkret]. Bukti: [tautan halaman/file atau timestamp]."

Gunakan fakta yang sudah ada saja; template di atas bukan temuan nyata.

