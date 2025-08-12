# ElectronBrowser

An Electron-based browser made for homelabbers.

---

## Prerequisites

Make sure you have the following installed on your Ubuntu system:

- **Node.js** (v18 or later recommended)
- **npm** (Node Package Manager)
- **Git** (optional, if cloning from a repo)

---

## Installation & Setup

### 1. Install Node.js and npm

We recommend using **nvm** (Node Version Manager) to install Node.js easily:

```bash
# Install nvm (if not installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# Reload shell or run:
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install latest Node.js LTS version
nvm install --lts

# Use installed Node version
nvm use --lts

# Confirm versions
node -v
npm -v

# download the source code 

git clone https://github.com/devdesli/ElectronBrowser.git
cd ElectronBrowser

# install dependencies 
npm install

# to start the browser run 
npm start
