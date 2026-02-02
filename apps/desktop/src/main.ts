import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';
import { fork, ChildProcess, execSync } from 'child_process';
import log from 'electron-log';
import * as fs from 'fs';
import * as net from 'net';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Determine paths
const isDev = !app.isPackaged;

// Add a specific log file in the workspace for debugging
const debugLogPath = isDev
    ? path.join(__dirname, '../../../desktop-debug.log')
    : '/Users/logandetty/signet/desktop-debug.log';
log.transports.file.resolvePathFn = () => debugLogPath;

let mainWindow: BrowserWindow | null = null;
let daemonProcess: ChildProcess | null = null;
let uiProcess: ChildProcess | null = null;
let nodePath: string = '';
let tray: Tray | null = null;
let isQuitting = false;

// Set app name
app.name = 'Signet';

const resourcesPath = isDev ? path.join(__dirname, '../../..') : process.resourcesPath;
// In Dev: __dirname is apps/desktop/dist. Root is ../.. . Monorepo root is ../../..
// In Dev, we want to point to apps/signet/dist and apps/signet-ui/dist

let daemonEntry: string;
let uiScript: string;
let iconPath: string;
let trayIconPath: string;

if (isDev) {
    daemonEntry = path.join(resourcesPath, 'apps/signet/dist/index.js'); // Point to CLI entry
    uiScript = path.join(resourcesPath, 'apps/signet-ui/server.mjs');
    iconPath = path.join(resourcesPath, 'apps/signet-ui/public/favicon.svg'); // Use SVG or convert to PNG if needed for Tray
    trayIconPath = path.join(resourcesPath, 'apps/signet-ui/public/trayKeyTemplate.png');
} else {
    // In Prod: Resources/daemon/index.js (CLI) & Resources/ui/dist-server/server.cjs
    daemonEntry = path.join(resourcesPath, 'daemon/index.js');
    uiScript = path.join(resourcesPath, 'ui/dist-server/server.cjs');
    iconPath = path.join(resourcesPath, 'ui/public/favicon.svg');
    trayIconPath = path.join(resourcesPath, 'ui/public/trayKeyTemplate.png');
}

// Log paths for debugging
log.info('isDev:', isDev);
log.info('Resources Path:', resourcesPath);
log.info('Daemon Entry:', daemonEntry);
log.info('UI Script:', uiScript);
log.info('Tray Icon Path:', trayIconPath);
log.info('Tray Icon Exists:', fs.existsSync(trayIconPath));

// Calculate NODE_PATH once
const asarPath = path.join(resourcesPath, 'app.asar', 'node_modules');
const asarUnpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
nodePath = isDev ? (process.env.NODE_PATH || '') : `${asarUnpackedPath}:${asarPath}`;

// Check if port is in use
function isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port);
    });
}

// Utility to kill process on specific port
function killProcessOnPort(port: number) {
    try {
        log.info(`Checking for existing processes on port ${port}...`);
        const pid = execSync(`lsof -t -i :${port}`).toString().trim();
        if (pid) {
            log.warn(`Forcefully killing zombie process ${pid} on port ${port} to ensure clean startup.`);
            execSync(`kill -9 ${pid}`);
        }
    } catch (e) {
        // execSync throws if no process is found (exit code 1)
        log.info(`Port ${port} is clean.`);
    }
}

async function ensurePortsFree() {
    log.info('Ensuring ports 3000, 3001, and 4174 are free...');
    killProcessOnPort(3000); // Daemon auth server
    killProcessOnPort(3001); // Daemon API
    killProcessOnPort(4174); // UI
}

function createTray() {
    // Use the specific tray icon which is a Template Image (black for light mode, inverts for dark)
    const icon = nativeImage.createFromPath(trayIconPath);
    // 22x22 is standard for macOS menu bar
    const trayIcon = icon.resize({ width: 22, height: 22 });
    trayIcon.setTemplateImage(true);

    tray = new Tray(trayIcon);
    tray.setToolTip('Signet');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Signet',
            click: () => {
                // Restore logic
                if (app.dock) app.dock.show(); // Show in dock
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (app.dock) app.dock.show(); // Show in dock
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        } else {
            createWindow();
        }
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
        },
        icon: iconPath
    });

    // Load the UI
    let retryCount = 0;
    const loadUrl = () => {
        retryCount++;
        log.info(`[Attempt ${retryCount}] Loading UI at http://localhost:4174...`);
        mainWindow?.loadURL('http://localhost:4174').catch((err) => {
            log.warn(`UI not ready yet (Attempt ${retryCount}), retrying in 1s...`, err.message);
            setTimeout(loadUrl, 1000);
        });
    };

    setTimeout(loadUrl, 500);

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
            if (app.dock) app.dock.hide(); // Hide from dock (menubar mode)
            return false;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

async function waitForPort(port: number, timeout = 10000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await isPortInUse(port)) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
}

async function startDaemon() {
    // Check if daemon port (3001) is already in use
    const portInUse = await isPortInUse(3001);

    if (portInUse) {
        log.info('Port 3001 is already in use. Assuming Daemon is already running.');
        // Don't spawn a new daemon process. Connect to existing one.
        return;
    }

    log.info('Starting Daemon via CLI...');
    log.info('NODE_PATH:', nodePath);
    log.info('Using execPath:', process.execPath);

    const daemonEnv = {
        ...process.env,
        FORCE_COLOR: '1',
        NODE_PATH: nodePath,
        ELECTRON_RUN_AS_NODE: '1',
        SIGNET_PORT: '3001'
    };

    daemonProcess = fork(daemonEntry, ['start'], {
        execPath: process.execPath,
        cwd: resourcesPath,
        env: daemonEnv,
        stdio: 'pipe'
    });

    daemonProcess.stdout?.on('data', (data: Buffer) => log.info(`[DaemonWrapper] ${data.toString()}`));
    daemonProcess.stderr?.on('data', (data: Buffer) => log.error(`[DaemonWrapper] ${data.toString()}`));

    // Wait for daemon to be ready
    log.info('Waiting for Daemon to listen on port 3001...');
    const ready = await waitForPort(3001);
    if (ready) {
        log.info('Daemon is ready on port 3001.');
    } else {
        log.error('Timed out waiting for Daemon port 3001.');
    }
}

async function startUi() {
    // Check if UI port (4174) is already in use
    const portInUse = await isPortInUse(4174);

    if (portInUse) {
        log.info('Port 4174 is already in use. Assuming UI Server is already running.');
        return;
    }

    log.info('Starting UI Server...');
    log.info('UI Script:', uiScript);

    if (!fs.existsSync(uiScript)) {
        log.error('UI script not found at', uiScript);
        return;
    }

    uiProcess = fork(uiScript, [], {
        execPath: process.execPath,
        cwd: resourcesPath,
        env: {
            ...process.env,
            PORT: '4174',
            DAEMON_URL: 'http://127.0.0.1:3001',
            ELECTRON_RUN_AS_NODE: '1',
            NODE_PATH: nodePath
        },
        stdio: 'pipe'
    });

    uiProcess.stdout?.on('data', (data: Buffer) => log.info(`[UI] ${data.toString()}`));
    uiProcess.stderr?.on('data', (data: Buffer) => log.error(`[UI] ${data.toString()}`));
}

function setupMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                {
                    label: 'Quit Signet',
                    accelerator: 'CmdOrCtrl+Q', // Explicit accelerator
                    click: () => {
                        isQuitting = true;
                        app.quit();
                    }
                }
            ]
        },
        // ... (Edit, View menus)
        // ... (Window menu)
    ];

    // Restore standard Edit/View/Window menus...
    const editMenu: Electron.MenuItemConstructorOptions = {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' }
        ]
    };

    const viewMenu: Electron.MenuItemConstructorOptions = {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    };

    const windowMenu: Electron.MenuItemConstructorOptions = {
        role: 'window',
        submenu: [
            { role: 'minimize' },
            { role: 'close' }
        ]
    };

    template.push(editMenu, viewMenu, windowMenu);

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (app.dock) app.dock.show();
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        } else {
            createWindow();
        }
    });

    app.whenReady().then(async () => {
        log.info('App starting up, showing window immediately...');

        // Show window first for instant feedback
        createWindow();
        createTray();
        setupMenu();

        // Environment cleanup and backend startup in parallel
        (async () => {
            try {
                await ensurePortsFree();
                startDaemon(); // No await so they start together
                startUi();
            } catch (err) {
                log.error('Error during backend startup:', err);
            }
        })();

        app.on('activate', () => {
            if (app.dock) app.dock.show();
            if (mainWindow === null) {
                createWindow();
            } else {
                mainWindow.show();
            }
        });
    });
}


app.on('window-all-closed', () => {
    // Do not quit when windows are closed
});

/**
 * Gracefully kill a child process with a timeout.
 * Attempts SIGTERM first, then SIGKILL if it doesn't exit.
 */
async function killWithGrace(proc: ChildProcess | null, name: string, timeoutMs = 5000): Promise<void> {
    if (!proc || proc.exitCode !== null) return;

    log.info(`Sending SIGTERM to ${name} (PID: ${proc.pid})...`);
    proc.kill('SIGTERM');

    const exited = await Promise.race([
        new Promise<boolean>(resolve => {
            proc.on('exit', () => resolve(true));
        }),
        new Promise<boolean>(resolve => {
            setTimeout(() => resolve(false), timeoutMs);
        })
    ]);

    if (!exited) {
        log.warn(`${name} (PID: ${proc.pid}) did not exit gracefully in ${timeoutMs}ms. Sending SIGKILL.`);
        proc.kill('SIGKILL');
    } else {
        log.info(`${name} exited gracefully.`);
    }
}

app.on('before-quit', async (event) => {
    if (isQuitting) return;

    log.info('Application quitting, initiating graceful shutdown of background processes...');
    event.preventDefault(); // Prevent immediate quit
    isQuitting = true;

    try {
        // Shutdown tracked processes in parallel
        await Promise.all([
            killWithGrace(daemonProcess, 'Daemon'),
            killWithGrace(uiProcess, 'UI Server')
        ]);

        // Force kill any zombie processes on our ports (failsafe)
        log.info('Cleaning up any zombie processes on ports...');
        killProcessOnPort(3000);
        killProcessOnPort(3001);
        killProcessOnPort(4174);
    } catch (err) {
        log.error('Error during shutdown sequence:', err);
    } finally {
        log.info('Background processes terminated. Exiting Electron.');
        app.quit();
    }
});
