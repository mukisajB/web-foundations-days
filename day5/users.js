const loadBtn = document.getElementById('load-users');
const filterInput = document.getElementById('filter-input');
const status = document.getElementById('status');
const list = document.getElementById('users-list');

let users = [];

async function loadUsers() {
  loadBtn.disabled = true;
  status.textContent = "Loading users...";
  try {
    const res = await fetch('https://jsonplaceholder.typicode.com/users');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    users = await res.json();
    status.textContent = "Users loaded successfully.";
    renderUsers(users);
  } catch (err) {
    status.textContent = "Error loading users.";
    console.error(err);
  } finally {
    loadBtn.disabled = false;
  }
}

function renderUsers(arr) {
  list.innerHTML = '';
  if (arr.length === 0) {
    const li = document.createElement('li');
    li.textContent = "No users match your filter.";
    list.appendChild(li);
    return;
  }
  arr.forEach(u => {
    const li = document.createElement('li');
    const name = document.createElement('p');
    name.textContent = `Name: ${u.name}`;
    const email = document.createElement('p');
    email.textContent = `Email: ${u.email}`;
    const city = document.createElement('p');
    city.textContent = `City: ${u.address.city}`;
    const company = document.createElement('p');
    company.textContent = `Company: ${u.company.name}`;
    li.append(name, email, city, company);
    list.appendChild(li);
  });
}

loadBtn.addEventListener('click', loadUsers);

filterInput.addEventListener('input', () => {
  const q = filterInput.value.toLowerCase();
  const filtered = users.filter(u => u.name.toLowerCase().includes(q));
  renderUsers(filtered);
});
