import { apiFetch, setButtonLoading, showToast, todayLocal } from "/common.js";

const form = document.getElementById("attendanceForm");
const dateInput = document.getElementById("attendanceDate");
const namesInput = document.getElementById("employeeNames");
const previewText = document.getElementById("previewText");
const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");
const submitButton = document.getElementById("submitButton");

dateInput.value = todayLocal();

function getNames() {
  const seen = new Set();
  return namesInput.value
    .split(/\r?\n/)
    .map((name) => name.replace(/^\s*\d+[.)-]?\s*/, "").trim())
    .filter((name) => {
      const key = name.toLocaleLowerCase("id-ID");
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function updatePreview() {
  const count = getNames().length;
  previewText.textContent = count ? `${count} pegawai akan diproses.` : "Belum ada nama pegawai.";
}

function showError(message) {
  errorText.textContent = message;
  errorBox.classList.remove("hidden");
}
function hideError() {
  errorText.textContent = "";
  errorBox.classList.add("hidden");
}

namesInput.addEventListener("input", updatePreview);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError();
  const employeeNames = getNames();

  if (!dateInput.value) return showError("Tanggal wajib diisi.");
  if (!employeeNames.length) return showError("Minimal satu nama pegawai harus diisi.");

  setButtonLoading(submitButton, true, "Menyimpan...");
  try {
    const result = await apiFetch("/api/attendance", {
      method: "POST",
      body: JSON.stringify({ attendanceDate: dateInput.value, employeeNames }),
    });

    const duplicateNote = result.duplicateCount ? ` ${result.duplicateCount} data duplikat dilewati.` : "";
    showToast(`${result.addedCount} data berhasil ditambahkan.${duplicateNote}`);
    namesInput.value = "";
    updatePreview();
  } catch (error) {
    showError(error.message || "Gagal menyimpan data.");
  } finally {
    setButtonLoading(submitButton, false);
  }
});
