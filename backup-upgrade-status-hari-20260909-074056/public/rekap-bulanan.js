import { apiFetch, formatDateIndonesia, setButtonLoading, showToast } from "/common.js";

const monthInput = document.getElementById("monthInput");
const showButton = document.getElementById("showButton");
const exportButton = document.getElementById("exportButton");
const employeeCount = document.getElementById("monthlyEmployeeCount");
const lateEmployeeCount = document.getElementById("monthlyLateEmployeeCount");
const totalLate = document.getElementById("monthlyTotalLate");
const tableBody = document.getElementById("monthlyTableBody");
const tableWrap = document.getElementById("monthlyTableWrap");
const empty = document.getElementById("monthlyEmpty");
const resultTitle = document.getElementById("resultTitle");
let currentData = null;

function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function monthLabel(value) { const [y,m] = value.split("-").map(Number); return new Intl.DateTimeFormat("id-ID", { month:"long", year:"numeric" }).format(new Date(y,m-1,1)); }

function detailModal(report) {
  const backdrop = document.createElement("div"); backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal"><div class="modal-header"><h3></h3></div><div class="modal-body"><p class="modal-summary"></p><div class="date-chips modal-chips"></div></div><div class="modal-actions"><button class="btn btn-primary" data-close>Tutup</button></div></div>`;
  backdrop.querySelector("h3").textContent = report.name;
  backdrop.querySelector(".modal-summary").textContent = report.total ? `${report.total} kali terlambat pada ${monthLabel(monthInput.value)}.` : `Tidak memiliki catatan keterlambatan pada ${monthLabel(monthInput.value)}.`;
  const chips = backdrop.querySelector(".modal-chips");
  if (report.dates.length) report.dates.forEach((date) => { const a=document.createElement("a"); a.className="chip chip-link"; a.href=`/rekap-harian.html?date=${encodeURIComponent(date)}`; a.textContent=formatDateIndonesia(date); chips.appendChild(a); });
  else chips.textContent = "Tidak ada tanggal keterlambatan.";
  document.body.appendChild(backdrop); const close=()=>backdrop.remove(); backdrop.querySelector("[data-close]").addEventListener("click",close); backdrop.addEventListener("click",e=>{if(e.target===backdrop)close();});
}

function render(data) {
  currentData = data; employeeCount.textContent=data.employeeCount??0; lateEmployeeCount.textContent=data.lateEmployeeCount??0; totalLate.textContent=data.totalLate??0; resultTitle.textContent=`Rekap ${monthLabel(monthInput.value)}`; tableBody.innerHTML="";
  if (!data.reports?.length) { tableWrap.classList.add("hidden"); empty.classList.remove("hidden"); return; }
  tableWrap.classList.remove("hidden"); empty.classList.add("hidden");
  data.reports.forEach((report,index)=>{
    const row=document.createElement("tr"); row.innerHTML=`<td class="cell-number">${index+1}</td><td><span class="employee-name"></span></td><td class="unit-cell"></td><td><span class="count-badge ${report.total===0?"count-zero":""}">${report.total}</span></td><td class="dates-cell"></td><td><button class="icon-action eye-action detail-button" type="button" title="Lihat detail" aria-label="Lihat detail">&#128065;</button></td>`;
    row.querySelector(".employee-name").textContent=report.name; row.querySelector(".unit-cell").textContent=report.unit||"-";
    const dates=document.createElement("div"); dates.className="date-chips"; const visible=report.dates.slice(0,3); visible.forEach(date=>{const chip=document.createElement("span");chip.className="chip";chip.textContent=formatDateIndonesia(date);dates.appendChild(chip);}); if(report.dates.length>3){const more=document.createElement("span");more.className="chip chip-more";more.textContent=`+${report.dates.length-3}`;dates.appendChild(more);} if(!report.dates.length) dates.textContent="-"; row.querySelector(".dates-cell").appendChild(dates);
    row.querySelector(".detail-button").addEventListener("click",()=>detailModal(report)); tableBody.appendChild(row);
  });
}

async function load() { if(!monthInput.value)return; setButtonLoading(showButton,true,"Memuat..."); try{render(await apiFetch(`/api/monthly?month=${encodeURIComponent(monthInput.value)}`));}catch(e){showToast(e.message||"Gagal memuat rekap bulanan.","error");}finally{setButtonLoading(showButton,false);} }
showButton.addEventListener("click",load);
exportButton.addEventListener("click",()=>{ if(!monthInput.value)return showToast("Pilih bulan terlebih dahulu.","error"); window.location.href=`/api/monthly/export?month=${encodeURIComponent(monthInput.value)}`; });
monthInput.value=currentMonth(); load();
