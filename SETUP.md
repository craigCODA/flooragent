# Quick Start

## Installation

```bash
npm install
```

## Development

```bash
npm run patch
```
Runs Vite dev server + Electron app in tandem.

## Building

```bash
npm run build
```
Builds the React/Vite frontend to `dist/`.

## Creating Installer

```bash
npm run dist
```
or for Windows NSIS only:
```bash
npm run dist:win
```

Creates `release/FloorAgent Setup 2.0.0.exe` (96 MB installer).

## Project Structure

- `src/` - React/JSX source code
- `electron/` - Electron main & preload processes
- `dist/` - Built frontend (generated)
- `release/` - Packaged installers (generated)
- `package.json` - Dependencies & build config

## Tech Stack

- **Frontend**: React 18 + Vite 7 + Tailwind CSS
- **Desktop**: Electron 40
- **Build**: electron-builder (NSIS installer)
- **UI**: Lucide React icons

## Notes

- Requires Node.js 16+
- Windows-only for building installers (NSIS requirement)
- Excludes `node_modules/` and build artifacts from this repo
