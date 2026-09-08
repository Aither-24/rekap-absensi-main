import { apiFetch, confirmDialog, formatDateIndonesia, setButtonLoading, showToast, todayLocal } from "/common.js";

const dateInput = document.getElementById("editDate");
const loadButton = document.getElementById("loadEditButton");
const editCard = document.getElementById("editCard");
const editTitle = document.getElementById("editTitle");
const editCount = document.getElementById("editCount");
const namesInput = document.getElementById("editNames");
const saveButton = document.getElementById("saveEditButton");
const errorBox = document.getElementById("editErrorBox");
const errorText = document.getElementById("editErrorText");

dateInput.value = todayLocal();

function getNames() {
  const seen = new Set();
  return namesInput.value.split(/\r?\n/).map((name) => name.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter((name) => {
    const key = name.toLocaleLowerCase("id-ID");
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateCount() {
  editCount.textContent = `${getNames().length} pegawai`;
}

async function loadData() {
  if (!dateInput.value) return;
  errorBox.classList.add("hidden");
  setButtonLoading(loadButton, true, "Memuat...");
  try {
    const data = await apiFetch(`/api/daily?date=${encodeURIComponent(dateInput.value)}`);
    editTitle.textContent = `Edit rekap ${formatDateIndonesia(data.date)}`;
    namesInput.value = data.names.join("\n");
    updateCount();
    editCard.classList.remove("hidden");
  } catch (error) {
    showToast(error.message || "Gagal mengambil data.", "error");
  } finally {
    setButtonLoading(loadButton, false);
  }
}

async function saveData() {
  const names = getNames();
  const confirmed = await confirmDialog({
    title: "Simpan koreksi rekap?",
    message: names.length
      ? `Daftar pada ${formatDateIndonesia(dateInput.value)} akan diganti menjadi ${names.length} pegawai.`
      : `Semua data keterlambatan pada ${formatDateIndonesia(dateInput.value)} akan dihapus.`,
    confirmText: "Simpan perubahan",
    danger: names.length === 0,
  });
  if (!confirmed) return;

  setButtonLoading(saveButton, true, "Menyimpan...");
  try {
    await apiFetch("/api/daily", {
      method: "PUT",
      body: JSON.stringify({ date: dateInput.value, employeeNames: names }),
    });
    showToast("Rekap harian berhasil diperbarui.");
    await loadData();
  } catch (error) {
    errorText.textContent = error.message || "Gagal menyimpan perubahan.";
    errorBox.classList.remove("hidden");
  } finally {
    setButtonLoading(saveButton, false);
  }
}

loadButton.addEventListener("click", loadData);
namesInput.addEventListener("input", updateCount);
saveButton.addEventListener("click", saveData);
