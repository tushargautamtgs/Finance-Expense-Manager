// ===== Persistent Data =====
let transactions = JSON.parse(localStorage.getItem("mf_transactions")) || [];
let accounts = JSON.parse(localStorage.getItem("mf_accounts")) || [];

let editIndex = null;
let currentPage = 1;
const PAGE_SIZE = 7;
let categoryChart = null;
let monthlyChart = null;
let currentCategoryFilter = "";

// ===== Initialization =====
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const ws = document.getElementById("welcomeScreen");
    ws.style.opacity = 0;
    setTimeout(() => (ws.style.display = "none"), 800);
  }, 1100);

  // Restore month filter and theme
  const savedMonth = localStorage.getItem("mf_month_filter") || "";
  const monthFilter = document.getElementById("monthFilter");
  if (monthFilter) monthFilter.value = savedMonth;

  const darkToggle = document.getElementById("darkModeToggle");
  const savedTheme = localStorage.getItem("mf_theme") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    darkToggle.checked = true;
  } else {
    document.body.classList.remove("dark");
    darkToggle.checked = false;
  }
  darkToggle.addEventListener("change", toggleDark);

  if (monthFilter) {
    monthFilter.addEventListener("change", () => {
      localStorage.setItem("mf_month_filter", monthFilter.value);
      displayTransactions(true);
      displayDashboardCards();
    });
  }

  initMonthFilters();
  initCharts();
  displayCategoryFilters();
  displayTransactions(true);
  displayDashboardCards();

  displayAccounts(); // Show accounts loaded from storage
});

// ===== Utils and Storage =====
function formatCurrency(n) {
  return (
    "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })
  );
}
function saveAllToStorage() {
  localStorage.setItem("mf_transactions", JSON.stringify(transactions));
  localStorage.setItem("mf_accounts", JSON.stringify(accounts));
}

// ===== Navigation =====
function switchView(btn) {
  document
    .querySelectorAll(".nav button")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const view = btn.dataset.view;
  document.querySelectorAll(".view").forEach((v) => (v.style.display = "none"));
  document.getElementById("view-" + view).style.display = "block";
}

// ===== Transactions Modal & Functions =====
function openModal(defaultDate) {
  editIndex = null;
  currentCategoryFilter = "";
  document.getElementById("modalTitle").innerText = "Add Transaction";
  document.getElementById("m_date").value =
    defaultDate || new Date().toISOString().slice(0, 10);
  document.getElementById("m_type").value = "expense";
  document.getElementById("m_desc").value = "";
  document.getElementById("m_amount").value = "";
  document.getElementById("m_category").value = "general";
  document.getElementById("m_account").value = "cash";
  showModal();
}
function showModal() {
  const back = document.getElementById("modalBackdrop");
  back.style.display = "flex";
  setTimeout(() => document.getElementById("modal").classList.add("show"), 10);
}
function closeModal(e) {
  if (e && e.type === "click" && e.target.id !== "modalBackdrop") return;
  document.getElementById("modal").classList.remove("show");
  setTimeout(
    () => (document.getElementById("modalBackdrop").style.display = "none"),
    200
  );
}
function editTransaction(idx) {
  const t = transactions[idx];
  editIndex = idx;
  currentCategoryFilter = "";
  document.getElementById("modalTitle").innerText = "Edit Transaction";
  document.getElementById("m_date").value = t.date;
  document.getElementById("m_type").value = t.type;
  document.getElementById("m_desc").value = t.desc;
  document.getElementById("m_amount").value = t.amount;
  document.getElementById("m_category").value = t.category;
  document.getElementById("m_account").value = t.account;
  showModal();
}
function saveTransaction() {
  const date = document.getElementById("m_date").value;
  const type = document.getElementById("m_type").value;
  const desc = document.getElementById("m_desc").value.trim();
  const amount = parseFloat(document.getElementById("m_amount").value || 0);
  const category = document.getElementById("m_category").value;
  const account = document.getElementById("m_account").value;
  if (!date || !desc || !amount || amount <= 0) {
    alert("Please fill valid date, description and amount (amount > 0)");
    return;
  }
  const tx = { date, type, desc, amount, category, account };
  if (editIndex !== null) {
    transactions[editIndex] = tx;
    editIndex = null;
  } else {
    transactions.unshift(tx);
  }
  saveAllToStorage();
  closeModal();
  displayTransactions(true);
  displayDashboardCards();
  displayCategoryFilters();
}
function deleteTx(idx) {
  if (!confirm("Delete this transaction?")) return;
  transactions.splice(idx, 1);
  saveAllToStorage();
  displayTransactions();
  displayDashboardCards();
  displayCategoryFilters();
}

// ===== Month Filters and Transactions Listing =====
function initMonthFilters() {
  const months = Array.from(
    new Set(transactions.map((t) => t.date.slice(0, 7)))
  )
    .sort()
    .reverse();
  const monthFilter = document.getElementById("monthFilter");
  const txMonth = document.getElementById("txMonth");
  [monthFilter, txMonth].forEach((s) => {
    s.innerHTML = '<option value="">All months</option>';
    months.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.text = m;
      s.appendChild(opt);
    });
  });
}
function displayCategoryFilters() {
  const categories = [
    ...new Set(
      transactions.filter((t) => t.type === "expense").map((t) => t.category)
    ),
  ];
  const container = document.getElementById("categoryFilters");
  container.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.textContent = "All";
  allBtn.classList.add(currentCategoryFilter === "" ? "active" : "");
  allBtn.onclick = () => {
    currentCategoryFilter = "";
    displayTransactions(true);
    displayCategoryFilters();
  };
  container.appendChild(allBtn);
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.classList.add(currentCategoryFilter === cat ? "active" : "");
    btn.onclick = () => {
      currentCategoryFilter = cat;
      displayTransactions(true);
      displayCategoryFilters();
    };
    container.appendChild(btn);
  });
}
function displayTransactions(resetPage = false) {
  if (resetPage) currentPage = 1;
  initMonthFilters();
  const tb = document.getElementById("transactionsTbody");
  const txTbody = document.getElementById("txTbody");
  const search = (
    document.getElementById("txSearch")?.value ||
    document.getElementById("globalSearch").value ||
    ""
  ).toLowerCase();
  const month =
    document.getElementById("monthFilter")?.value ||
    document.getElementById("txMonth")?.value ||
    "";
  let filtered = transactions.filter((t) => {
    if (month && !t.date.startsWith(month)) return false;
    if (
      search &&
      !(
        t.desc.toLowerCase().includes(search) ||
        t.category.toLowerCase().includes(search)
      )
    )
      return false;
    if (currentCategoryFilter && t.category !== currentCategoryFilter)
      return false;
    return true;
  });
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > pages) currentPage = pages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);
  tb.innerHTML = "";
  paged.forEach((t, idx) => {
    const globalIdx = transactions.indexOf(filtered[start + idx]);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${t.date}</td>
      <td>${escapeHtml(t.desc)}</td>
      <td>${t.category}</td>
      <td>${t.account}</td>
      <td>${t.type}</td>
      <td style="text-align:right"><strong>${formatCurrency(
        t.amount
      )}</strong></td>
      <td class="actions">
        <button onclick="editTransaction(${globalIdx})">Edit</button>
        <button onclick="deleteTx(${globalIdx})" style="background:transparent; color:var(--danger)">Delete</button>
      </td>`;
    tb.appendChild(row);
  });
  if (txTbody) {
    txTbody.innerHTML = "";
    filtered.forEach((t, idx) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${t.date}</td>
        <td>${escapeHtml(t.desc)}</td>
        <td>${t.category}</td>
        <td>${t.account}</td>
        <td>${t.type}</td>
        <td style="text-align:right"><strong>${formatCurrency(
          t.amount
        )}</strong></td>
        <td class="actions">
          <button onclick="editTransaction(${idx})">Edit</button>
          <button onclick="deleteTx(${idx})" style="background:transparent; color:var(--danger)">Delete</button>
        </td>`;
      txTbody.appendChild(row);
    });
  }
  document.getElementById("tableInfo").innerText = `${total} transaction${
    total !== 1 ? "s" : ""
  }`;
  document.getElementById("pageInfo").innerText = `${currentPage} / ${pages}`;
  updateCharts();
  displayDashboardCards();
}

// ===== Pagination =====
function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    displayTransactions();
  }
}
function nextPage() {
  currentPage++;
  displayTransactions();
}

// ===== Dashboard Cards =====
function displayDashboardCards() {
  const monthFilter = document.getElementById("monthFilter");
  const monthNow =
    monthFilter && monthFilter.value
      ? monthFilter.value
      : new Date().toISOString().slice(0, 7);
  let income = 0,
    expense = 0;
  transactions.forEach((t) => {
    if (
      t.type === "income" &&
      (monthFilter && monthFilter.value
        ? t.date.startsWith(monthFilter.value)
        : t.date.startsWith(monthNow))
    )
      income += t.amount;
    if (
      t.type === "expense" &&
      (monthFilter && monthFilter.value
        ? t.date.startsWith(monthFilter.value)
        : t.date.startsWith(monthNow))
    )
      expense += t.amount;
  });

  document.getElementById("cardIncome").innerText = formatCurrency(income);
  document.getElementById("cardExpense").innerText = formatCurrency(expense);
  document.getElementById("cardBalance").innerText = formatCurrency(
    income - expense
  );

  // Calculate total wealth (all time)
  let totalIncome = 0,
    totalExpense = 0;
  transactions.forEach((t) => {
    if (t.type === "income") totalIncome += t.amount;
    if (t.type === "expense") totalExpense += t.amount;
  });
  document.getElementById("cardTotalWealth").innerText = formatCurrency(
    totalIncome - totalExpense
  );

  displayFundsDistribution();
}

// ===== Charts Initialization & Update =====
function initCharts() {
  const ctx1 = document.getElementById("categoryChart").getContext("2d");
  const ctx2 = document.getElementById("monthlyChart").getContext("2d");

  categoryChart = new Chart(ctx1, {
    type: "pie",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [
            "#60a5fa",
            "#34d399",
            "#fbbf24",
            "#fb7185",
            "#a78bfa",
            "#f97316",
            "#f59e0b",
            "#10b981",
            "#3b82f6",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      animation: { duration: 600, easing: "easeOutCubic" },
    },
  });

  monthlyChart = new Chart(ctx2, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Net (Income - Expense)",
          data: [],
          borderColor: "#06b6d4",
          tension: 0.3,
          fill: true,
          backgroundColor: "rgba(6,182,212,0.08)",
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { display: true }, y: { display: true, beginAtZero: true } },
      interaction: { mode: "nearest", intersect: false },
      animation: { duration: 700, easing: "easeOutQuart" },
    },
  });

  updateCharts();
}
function updateCharts() {
  const catTotals = {};
  const monthlyMap = {};
  transactions.forEach((t) => {
    if (t.type === "expense")
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    const m = t.date.slice(0, 7);
    monthlyMap[m] = monthlyMap[m] || 0;
    monthlyMap[m] += t.type === "income" ? t.amount : -t.amount;
  });
  const catLabels = Object.keys(catTotals);
  categoryChart.data.labels = catLabels;
  categoryChart.data.datasets[0].data = catLabels.map((l) => catTotals[l]);
  categoryChart.update();

  const months = Object.keys(monthlyMap).sort();
  monthlyChart.data.labels = months;
  monthlyChart.data.datasets[0].data = months.map((m) => monthlyMap[m]);
  monthlyChart.update();
}

// ===== Search =====
function searchAll() {
  displayTransactions(true);
}

// ===== Esc key to close Modal =====
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal({ type: "click", target: { id: "modalBackdrop" } });
    closeAccountModal({ target: { id: "accountModalBackdrop" } });
  }
});

// ===== Chart Toggle =====
function toggleCharts() {
  const chartsContainer = document.getElementById("chartsContainer");
  const toggleBtn = document.getElementById("toggleChartsBtn");
  if (chartsContainer.style.display === "none") {
    chartsContainer.style.display = "grid";
    toggleBtn.textContent = "Hide Charts";
  } else {
    chartsContainer.style.display = "none";
    toggleBtn.textContent = "Show Charts";
  }
}

// ===== Accounts Modal Functions =====
function openAccountModal() {
  const modal = document.getElementById("accountModalBackdrop");
  modal.style.display = "flex"; // must be flex for centering
  setTimeout(() => modal.querySelector(".modal").classList.add("show"), 10);
}
function closeAccountModal(event) {
  if (!event || event.target.id === "accountModalBackdrop") {
    const modal = document.getElementById("accountModalBackdrop");
    modal.querySelector(".modal").classList.remove("show");
    setTimeout(() => {
      modal.style.display = "none";
      clearAccountModal();
    }, 200);
  }
}
function clearAccountModal() {
  document.getElementById("acc_name").value = "";
  document.getElementById("acc_type").value = "cash";
  document.getElementById("acc_balance").value = "";
}

// Save Account with persistence
function saveAccount() {
  const name = document.getElementById("acc_name").value.trim();
  const type = document.getElementById("acc_type").value;
  const balance = parseFloat(document.getElementById("acc_balance").value) || 0;

  if (!name) {
    alert("Please enter account name");
    return;
  }

  accounts.push({ name, type, balance });

  saveAllToStorage();
  displayAccounts();
  closeAccountModal();
}

// Show accounts table from accounts array
function displayAccounts() {
  const tbody = document.getElementById("accountsTbody");
  tbody.innerHTML = "";
  accounts.forEach((acc, index) => {
    const balanceNum = Number(acc.balance) || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${acc.name}</td>
      <td>${acc.type.charAt(0).toUpperCase() + acc.type.slice(1)}</td>
      <td>${formatCurrency(balanceNum)}</td>
      <td>
        <button onclick="editAccount(${index})">Edit</button>
        <button onclick="deleteAccount(${index})" style="background:transparent; color:var(--danger)">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// Delete account persistently
function deleteAccount(index) {
  if (confirm("Are you sure you want to delete this account?")) {
    accounts.splice(index, 1);
    saveAllToStorage();
    displayAccounts();
  }
}

// Edit account with temporary save button override
function editAccount(index) {
  const acc = accounts[index];
  document.getElementById("acc_name").value = acc.name;
  document.getElementById("acc_type").value = acc.type;
  document.getElementById("acc_balance").value = acc.balance;
  openAccountModal();

  const saveBtn = document.querySelector("#accountModalBackdrop .btn");
  const originalSave = saveBtn.onclick;
  saveBtn.onclick = function () {
    acc.name = document.getElementById("acc_name").value.trim();
    acc.type = document.getElementById("acc_type").value;
    acc.balance = parseFloat(document.getElementById("acc_balance").value) || 0;

    saveAllToStorage();
    displayAccounts();
    closeAccountModal();
    saveBtn.onclick = originalSave; // restore
  };
}

// ===== Dark Mode Toggle =====
function toggleDark() {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "mf_theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
}

// ===== Utility Function =====
function escapeHtml(text) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );
}

// ===== Funds Distribution Placeholder =====
function displayFundsDistribution() {
  // Add implementation for funds distribution visualization if required
}

document.addEventListener("DOMContentLoaded", () => {
  // localStorage se data pehle load ho chuka hai variables me

  // Show transactions and accounts on page load (previous saved data)
  displayTransactions(true);
  displayAccounts();

  // Baaki initialization jo tumne already add kiya hai
  initMonthFilters();
  initCharts();
  displayCategoryFilters();
  displayDashboardCards();

  // Dark mode toggle aur filters set karna
  const darkToggle = document.getElementById("darkModeToggle");
  const savedTheme = localStorage.getItem("mf_theme") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    darkToggle.checked = true;
  }

  darkToggle.addEventListener("change", toggleDark);

  const monthFilter = document.getElementById("monthFilter");
  if (monthFilter) {
    const savedMonth = localStorage.getItem("mf_month_filter") || "";
    monthFilter.value = savedMonth;
    monthFilter.addEventListener("change", () => {
      localStorage.setItem("mf_month_filter", monthFilter.value);
      displayTransactions(true);
      displayDashboardCards();
    });
  }
});

// ---- User Profile Logic ----
let currentUser = localStorage.getItem("username") || null;

function updateUserUI() {
  const name = currentUser || "Guest";
  document.getElementById("profileName").textContent = name;
  document.getElementById(
    "profileGreeting"
  ).innerHTML = `Welcome, <strong>${name}</strong>`;
  document.getElementById("topbarName").textContent = name;
  document.getElementById("welcomeMsg").textContent = `👋 Welcome, ${name}!`;
  document.getElementById("avatarInitials").textContent = name
    .charAt(0)
    .toUpperCase();
}

function saveUserName() {
  const input = document.getElementById("usernameInput").value.trim();
  if (input) {
    currentUser = input;
    localStorage.setItem("username", currentUser);
    updateUserUI();
    alert("Name updated!");
  } else {
    alert("Please enter a valid name.");
  }
}

// Init
updateUserUI();

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
