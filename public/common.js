const sidebar = document.getElementById("sidebar");
const mobileOverlay = document.getElementById("mobileOverlay");
const menuButton = document.getElementById("menuButton");

function closeSidebar() {
  sidebar?.classList.remove("open");
  mobileOverlay?.classList.remove("open");
}

menuButton?.addEventListener("click", () => {
  sidebar?.classList.toggle("open");
  mobileOverlay?.classList.toggle("open");
});

mobileOverlay?.addEventListener("click", closeSidebar);
window.addEventListener("resize", () => {
  if (window.innerWidth > 980) closeSidebar();
});

export function formatDateIndonesia(value, withWeekday = false) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    ...(withWeekday ? { weekday: "long" } : {}),
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server mengembalikan respons tidak valid (${response.status}).`);
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Permintaan gagal (${response.status}).`);
  }

  return data;
}

export function showToast(message, type = "success") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3600);
}

export function confirmDialog({ title, message, confirmText = "Hapus", danger = true }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <div class="modal-header"><h3 id="confirmTitle"></h3></div>
        <div class="modal-body"><p style="margin:0"></p></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-cancel>Batal</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm></button>
        </div>
      </div>`;

    backdrop.querySelector("h3").textContent = title;
    backdrop.querySelector("p").textContent = message;
    backdrop.querySelector("[data-confirm]").textContent = confirmText;
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };

    backdrop.querySelector("[data-cancel]").addEventListener("click", () => finish(false));
    backdrop.querySelector("[data-confirm]").addEventListener("click", () => finish(true));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(false);
    });
    document.addEventListener("keydown", function onKey(event) {
      if (event.key === "Escape" && document.body.contains(backdrop)) {
        document.removeEventListener("keydown", onKey);
        finish(false);
      }
    });
  });
}

export function setButtonLoading(button, loading, loadingText = "Memproses...") {
  if (!button) return;
  if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent.trim();
  button.disabled = loading;
  button.textContent = loading ? loadingText : button.dataset.defaultText;
}
