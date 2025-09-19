# Running Your Own Netplay Server

This guide explains how to run the Netplay server designed specifically for Emulatorjs.org

---

## 1. Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (v16 or later recommended)  
  👉 [Download Node.js](https://nodejs.org/)

- **npm** (comes with Node.js) or **yarn** package manager

- **Git**  
  👉 [Download Git](https://git-scm.com/)

---

## 2. Clone the Repository

```bash
git clone https://github.com/EmulatorJS/EmulatorJS-Netplay
cd EmulatorJS-Netplay
```

---

## 3. Install Dependencies

The `server.js` file depends on a few Node.js packages:

- `express`
- `socket.io`
- `cors`

Install them using **npm**:

```bash
npm install express socket.io cors
```

Or using **yarn**:

```bash
yarn add express socket.io cors
```

---

## 4. Run the Server

To start the server:

```bash
node server.js
```

If you want to run it in development mode with auto-restart on file changes, install `nodemon`:

```bash
npm install -g nodemon
nodemon server.js
```

---

## 5. Access the Server

By default, the server runs on:

```
http://localhost:3000
```

If you want to change the port, set the `PORT` environment variable.

**Linux / macOS (bash / zsh):**

```bash
PORT=4000 node server.js
```

**Windows PowerShell:**

```powershell
$env:PORT=4000; node server.js
```

---

## 6. (Optional) Run in Background with PM2

For production, use **PM2** to keep the server running in the background.

Install PM2 globally:

```bash
npm install -g pm2
```

Start the server with a name:

```bash
pm2 start server.js --name my-server
```

View logs:

```bash
pm2 logs my-server
```

Restart the server:

```bash
pm2 restart my-server
```

Stop the server:

```bash
pm2 stop my-server
```

---

## 7. (Optional) Keep Server Running After Reboot

To make PM2 auto-start after reboot:

```bash
pm2 startup
```

Follow the instructions it gives you, then save the current process list:

```bash
pm2 save
```

---

## ✅ Done

You now have the server running locally!  
 
- For **production**, use PM2 to keep it running and restart automatically.
