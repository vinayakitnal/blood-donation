/* script.js
   Handles:
   - nav active link
   - donors localStorage (CRUD)
   - register form
   - homepage stats
   - availability rendering & targets
*/

(function(){
  // Default target per blood group (editable in app)
  const DEFAULT_TARGETS = {
    "A+": 20, "A-": 8,
    "B+": 20, "B-": 6,
    "AB+": 6, "AB-": 3,
    "O+": 30, "O-": 10
  };

  // Helpers for localStorage
  function getDonors(){
    try {
      return JSON.parse(localStorage.getItem('donors') || '[]');
    } catch(e){
      return [];
    }
  }
  function saveDonors(list){
    localStorage.setItem('donors', JSON.stringify(list));
  }
  function getTargets(){
    try {
      return JSON.parse(localStorage.getItem('targets') || JSON.stringify(DEFAULT_TARGETS));
    } catch(e){
      return DEFAULT_TARGETS;
    }
  }
  function saveTargets(t){
    localStorage.setItem('targets', JSON.stringify(t));
  }

  // Setup nav active state
  function initNav(){
    const links = document.querySelectorAll('nav a');
    links.forEach(a => {
      const href = a.getAttribute('href');
      if (location.pathname.endsWith(href) || (href === 'index.html' && location.pathname.endsWith('/'))){
        a.classList.add('active');
      }
    });
  }

  // Home: show totals + most-needed group
  function renderHomeStats(){
    const totalEl = document.querySelector('#totalDonors');
    const needEl = document.querySelector('#mostNeeded');
    if (!totalEl) return;

    const donors = getDonors();
    const total = donors.length;
    totalEl.textContent = total;

    // compute counts by group & compare to targets
    const counts = {};
    donors.forEach(d => counts[d.blood_group] = (counts[d.blood_group] || 0) + 1);

    const targets = getTargets();
    // compute shortage ratio = (count/target)
    let minRatio = Infinity;
    let mostNeeded = '—';
    Object.keys(targets).forEach(bg => {
      const ratio = (counts[bg] || 0) / (targets[bg] || 1);
      if (ratio < minRatio){
        minRatio = ratio;
        mostNeeded = bg;
      }
    });

    needEl.textContent = mostNeeded + (total === 0 ? ' (no donors yet)' : '');
  }

  // Register page: attach form handler
  function initRegisterForm(){
    const form = document.querySelector('#donorForm');
    if (!form) return;

    form.addEventListener('submit', function(e){
      e.preventDefault();
      // get values
      const name = form.querySelector('[name="name"]').value.trim();
      const age = parseInt(form.querySelector('[name="age"]').value, 10);
      const blood_group = form.querySelector('[name="blood_group"]').value;
      const contact = form.querySelector('[name="contact"]').value.trim();
      const city = form.querySelector('[name="city"]').value.trim();

      // basic validation
      if (!name || !blood_group || !contact || !city || isNaN(age)){
        alert('Please fill all fields correctly.');
        return;
      }
      if (age < 16 || age > 75){
        if (!confirm('Age is outside typical donation range (16–75). Still register?')) {
          return;
        }
      }

      
      // create donor object
      const donor = {
        id: Date.now(),
        name, age, blood_group, contact, city,
        date_registered: new Date().toISOString()
      };

      const list = getDonors();
      list.push(donor);
      saveDonors(list);

      // success UX
      form.reset();
      const msg = document.querySelector('#registerMsg');
      if (msg){
        msg.textContent = "Registration successful — thank you! You can view availability.";
        msg.style.color = 'green';
      } else {
        alert('Registration successful — thank you!');
      }
      // update home stats if any
      renderHomeStats();
    });
  }

  // AVAILABILITY page: render counts & progress bars
  function renderAvailability(){
    const wrap = document.querySelector('#availabilityList');
    if (!wrap) return;

    const donors = getDonors();
    const counts = {};
    donors.forEach(d => counts[d.blood_group] = (counts[d.blood_group] || 0) + 1);

    const targets = getTargets();

    // Blood groups in desired order
    const order = ["O+","O-","A+","A-","B+","B-","AB+","AB-"];

    // Clear old
    wrap.innerHTML = '';

    // Each group's card
    order.forEach(bg => {
      const count = counts[bg] || 0;
      const target = targets[bg] || 10;
      // progress towards target
      const percentOfTarget = Math.round((count / target) * 100);
      const pct = Math.min(100, Math.max(0, percentOfTarget)); // clamp
      const pctText = (target === 0) ? 'N/A' : `${pct}%`;

      const div = document.createElement('div');
      div.className = 'card progress-row';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div style="font-weight:800">${bg}</div>
          <div class="small-muted">${count} donors • target ${target}</div>
        </div>
        <label>${bg} — ${pctText} of target</label>
        <div class="progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
          <span style="width:${pct}%">${pct === 100 ? '✓ Full' : (pctText)}</span>
        </div>
      `;
      wrap.appendChild(div);
    });

    // also render donor table
    renderDonorTable();
  }

  function renderDonorTable(){
    const tableWrap = document.querySelector('#donorTableWrap');
    if (!tableWrap) return;

    const donors = getDonors();
    if (donors.length === 0){
      tableWrap.innerHTML = `<div class="card center small-muted">No donors registered yet.</div>`;
      return;
    }

    const table = document.createElement('table');
    table.className = 'table card';
    table.innerHTML = `<thead><tr><th>Name</th><th>Blood</th><th>Age</th><th>Contact</th><th>City</th><th>Registered</th><th></th></tr></thead>`;
    const tbody = document.createElement('tbody');
    donors.slice().reverse().forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(d.name)}</td>
        <td>${escapeHtml(d.blood_group)}</td>
        <td>${escapeHtml(d.age)}</td>
        <td>${escapeHtml(d.contact)}</td>
        <td>${escapeHtml(d.city)}</td>
        <td class="small-muted">${(new Date(d.date_registered)).toLocaleString()}</td>
        <td><button class="btn-inline" data-id="${d.id}">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.innerHTML = '';
    tableWrap.appendChild(table);

    // attach delete handlers
    table.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', function(){
        if (!confirm('Delete this donor?')) return;
        const id = Number(btn.dataset.id);
        const list = getDonors().filter(x => x.id !== id);
        saveDonors(list);
        renderAvailability(); // rerender all
        renderHomeStats();
      });
    });
  }

  // allow editing targets on availability page
  function initTargetControls(){
    const container = document.querySelector('#targetControls');
    if (!container) return;
    const targets = getTargets();
    container.innerHTML = '';
    // create inputs
    Object.keys(targets).forEach(bg => {
      const div = document.createElement('div');
      div.className = 'col';
      div.innerHTML = `
        <label>${bg} target</label>
        <input type="number" min="0" value="${targets[bg]}" data-bg="${bg}">
      `;
      container.appendChild(div);
    });
    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-inline';
    saveBtn.textContent = 'Save targets';
    saveBtn.addEventListener('click', function(){
      const inputs = container.querySelectorAll('input[data-bg]');
      const newTargets = {};
      inputs.forEach(inp => {
        const bg = inp.dataset.bg;
        let val = parseInt(inp.value, 10);
        if (isNaN(val) || val < 0) val = 0;
        newTargets[bg] = val;
      });
      saveTargets(newTargets);
      alert('Targets saved.');
      renderAvailability();
      renderHomeStats();
    });

    const row = document.createElement('div');
    row.style.marginTop = '12px';
    row.appendChild(saveBtn);
    container.appendChild(row);
  }

  // small escape for safety when injecting text
  function escapeHtml(text){
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // initialize for current page
  document.addEventListener('DOMContentLoaded', function(){
    initNav();
    renderHomeStats();
    initRegisterForm();
    renderAvailability();
    initTargetControls();
  });

  // expose a dev helper (optional)
  window.__bloodDonation = {
    getDonors, saveDonors, getTargets, saveTargets
  };
})();
