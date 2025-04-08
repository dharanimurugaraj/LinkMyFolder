from flask import Flask, jsonify, request, session
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'data/tasks.db')

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        creator TEXT,
        assigned_to TEXT,
        status TEXT,
        time TEXT,
        FOREIGN KEY (creator) REFERENCES users(username),
        FOREIGN KEY (assigned_to) REFERENCES users(username)
    )''')
    conn.commit()
    conn.close()

init_db()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute('INSERT INTO users (username, password) VALUES (?, ?)', (username, password))
        conn.commit()
        session['username'] = username
        return jsonify({'success': True, 'message': f'Welcome, {username}!'})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Username taken'}), 400
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    conn = get_db()
    c = conn.cursor()
    user = c.execute('SELECT * FROM users WHERE username = ? AND password = ?', (username, password)).fetchone()
    conn.close()
    if not user:
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    session['username'] = username
    return jsonify({'success': True, 'message': f'Logged in as {username}'})

@app.route('/users', methods=['GET'])
def list_users():
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'Login required'}), 401
    conn = get_db()
    c = conn.cursor()
    users = [row['username'] for row in c.execute('SELECT username FROM users')]
    conn.close()
    return jsonify({'success': True, 'users': users})

@app.route('/tasks', methods=['GET'])
def get_tasks():
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'Login required'}), 401
    username = session['username']
    conn = get_db()
    c = conn.cursor()
    tasks = c.execute('SELECT * FROM tasks WHERE creator = ? OR assigned_to = ?', (username, username)).fetchall()
    conn.close()
    return jsonify({'success': True, 'tasks': [dict(task) for task in tasks]})

@app.route('/tasks', methods=['POST'])
def create_task():
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'Login required'}), 401
    data = request.get_json()
    title = data.get('title')
    assigned_to = data.get('assigned_to')
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT username FROM users WHERE username = ?', (assigned_to,))
    if not c.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'User not found'}), 404
    c.execute('INSERT INTO tasks (title, creator, assigned_to, status, time) VALUES (?, ?, ?, ?, ?)',
              (title, session['username'], assigned_to, 'Pending', datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Task created'})

@app.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    if 'username' not in session:
        return jsonify({'success': False, 'message': 'Login required'}), 401
    data = request.get_json()
    status = data.get('status')
    conn = get_db()
    c = conn.cursor()
    c.execute('UPDATE tasks SET status = ? WHERE id = ? AND (creator = ? OR assigned_to = ?)',
              (status, task_id, session['username'], session['username']))
    if c.rowcount == 0:
        conn.close()
        return jsonify({'success': False, 'message': 'Task not found or unauthorized'}), 404
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Task updated'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True)