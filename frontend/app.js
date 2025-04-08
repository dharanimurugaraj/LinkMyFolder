const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://your-heroku-app.herokuapp.com'; // Replace with your Heroku URL

function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

async function apiCall(endpoint, options = {}) {
    showLoading(true);
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();
        showLoading(false);
        if (!data.success) throw new Error(data.message);
        return data;
    } catch (error) {
        showLoading(false);
        alert(`Error: ${error.message}`);
        throw error;
    }
}

document.getElementById('registerBtn').addEventListener('click', () => auth('register'));
document.getElementById('loginBtn').addEventListener('click', () => auth('login'));

async function auth(type) {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!username || !password) return alert('Please fill in all fields');
    const data = await apiCall(`/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('main').classList.remove('hidden');
    updateDashboard();
}

document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

document.getElementById('addTaskBtn').addEventListener('click', async () => {
    const title = document.getElementById('taskTitle').value.trim();
    const assigned_to = document.getElementById('assignTo').value;
    if (!title) return alert('Please enter a task title');
    await apiCall('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, assigned_to })
    });
    document.getElementById('taskTitle').value = '';
    updateTasks();
});

async function updateDashboard() {
    const userData = await apiCall('/users');
    const userList = document.getElementById('userList');
    const assignTo = document.getElementById('assignTo');
    userList.innerHTML = '';
    assignTo.innerHTML = '';
    document.getElementById('userCount').textContent = userData.users.length;
    userData.users.forEach(user => {
        userList.innerHTML += `<div class="p-2 border-b dark:border-gray-700">${user}</div>`;
        assignTo.innerHTML += `<option value="${user}">${user}</option>`;
    });
    updateTasks();
}

async function updateTasks() {
    const taskData = await apiCall('/tasks');
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    taskData.tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-item p-2 border-b dark:border-gray-700 flex justify-between items-center';
        div.innerHTML = `
            <span>${task.title} (To: ${task.assigned_to}) - ${task.status}</span>
            <select onchange="updateTaskStatus(${task.id}, this.value)" class="p-1 border rounded dark:bg-gray-700 dark:border-gray-600">
                <option value="Pending" ${task.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
        `;
        taskList.appendChild(div);
    });
    render3DTasks(taskData.tasks);
}

async function updateTaskStatus(taskId, status) {
    await apiCall(`/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    updateTasks();
}

function render3DTasks(tasks) {
    const container = document.getElementById('threeDView');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / 300, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, 300);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    tasks.forEach((task, i) => {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: task.status === 'Completed' ? 0x00ff00 : 0xff0000 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(i * 2 - tasks.length / 2, 0, 0);
        scene.add(cube);
    });

    camera.position.z = 5;
    function animate() {
        requestAnimationFrame(animate);
        scene.children.forEach(child => child.rotation.y += 0.01);
        renderer.render(scene, camera);
    }
    animate();
}

if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
setInterval(updateDashboard, 5000);
updateDashboard();