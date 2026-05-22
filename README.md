# MC Plugin Compiler 🎮

One-click Minecraft plugin compiler for Railway.

## Features
- ✅ Upload ZIP file with source code
- ✅ Auto-detect Maven/Gradle project
- ✅ One-click compile
- ✅ Download compiled JAR instantly
- ✅ Docker sandboxed builds

## Deploy to Railway

### Option 1: Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to project
cd mc-compiler

# Initialize and deploy
railway init
railway up
```

### Option 2: GitHub + Railway Dashboard
1. Push this code to GitHub
2. Go to [Railway Dashboard](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Add environment variable: `PORT=3000`
6. Deploy!

## How to Use

1. **Prepare your plugin:**
   - ZIP your plugin source code
   - Include `plugin.yml` and `pom.xml` (or `build.gradle`)
   - Structure: `src/main/java/...`

2. **Upload & Compile:**
   - Go to your Railway URL
   - Drop ZIP file or click to browse
   - Click "Compile Plugin"
   - Download your `.jar` file!

## Project Structure Support

### Maven Project
```
my-plugin.zip
├── pom.xml
├── src/
│   └── main/
│       ├── java/
│       │   └── com/example/MyPlugin.java
│       └── resources/
│           └── plugin.yml
```

### Gradle Project
```
my-plugin.zip
├── build.gradle
├── src/
│   └── main/
│       ├── java/
│       └── resources/
│           └── plugin.yml
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |

## Tech Stack
- **Backend:** Node.js + Express
- **Compiler:** Docker (Maven/Gradle + JDK 17)
- **Frontend:** Vanilla HTML/CSS/JS
- **Hosting:** Railway

## License
MIT
