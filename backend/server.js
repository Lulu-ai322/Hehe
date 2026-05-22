const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// One-click compile endpoint
app.post('/compile', upload.array('files'), async (req, res) => {
    const buildId = Date.now().toString();
    const buildDir = `/tmp/build-${buildId}`;

    try {
        // 1. Create build directory
        fs.mkdirSync(buildDir, { recursive: true });

        // 2. Extract uploaded files
        req.files.forEach(file => {
            const destPath = path.join(buildDir, file.originalname);
            fs.copyFileSync(file.path, destPath);
            fs.unlinkSync(file.path);
        });

        // 3. Check if zip file uploaded, extract it
        const files = fs.readdirSync(buildDir);
        const zipFile = files.find(f => f.endsWith('.zip'));

        if (zipFile) {
            await extractZip(path.join(buildDir, zipFile), buildDir);
            fs.unlinkSync(path.join(buildDir, zipFile));
        }

        // 4. Detect project type (Maven/Gradle)
        const isMaven = fs.existsSync(path.join(buildDir, 'pom.xml')) || 
                       hasFileInSubdirs(buildDir, 'pom.xml');
        const isGradle = fs.existsSync(path.join(buildDir, 'build.gradle')) ||
                         hasFileInSubdirs(buildDir, 'build.gradle');

        // Find actual project root
        const projectRoot = findProjectRoot(buildDir);

        if (!isMaven && !isGradle) {
            // Auto-generate pom.xml for simple plugin
            generateMavenProject(projectRoot, req.body.pluginName || 'MyPlugin');
        }

        // 5. Compile using Docker
        const command = isGradle 
            ? `docker run --rm --network none --memory=1g --cpus=1 -v ${projectRoot}:/app -w /app gradle:7-jdk17 gradle build -x test --no-daemon`
            : `docker run --rm --network none --memory=1g --cpus=1 -v ${projectRoot}:/app -w /app maven:3.9-eclipse-temurin-17 mvn clean package -DskipTests`;

        await runCommand(command, 180000); // 3 min timeout

        // 6. Find compiled JAR
        const jarPath = findJarFile(projectRoot, isGradle);

        if (!jarPath) {
            throw new Error('JAR file not found after build. Check your source code.');
        }

        // 7. Send JAR for download
        res.download(jarPath, `${req.body.pluginName || 'plugin'}.jar`, (err) => {
            // Cleanup
            fs.rmSync(buildDir, { recursive: true, force: true });
        });

    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true });
        }
        res.status(500).json({ error: error.message, details: error.stdout || '' });
    }
});

// Helper: Extract zip
function extractZip(zipPath, destDir) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        exec(`unzip -o "${zipPath}" -d "${destDir}"`, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

// Helper: Find file in subdirectories
function hasFileInSubdirs(dir, filename) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            if (fs.existsSync(path.join(dir, file.name, filename))) return true;
        }
    }
    return false;
}

// Helper: Find project root (where pom.xml or build.gradle is)
function findProjectRoot(buildDir) {
    if (fs.existsSync(path.join(buildDir, 'pom.xml'))) return buildDir;
    if (fs.existsSync(path.join(buildDir, 'build.gradle'))) return buildDir;

    const files = fs.readdirSync(buildDir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            const subDir = path.join(buildDir, file.name);
            if (fs.existsSync(path.join(subDir, 'pom.xml'))) return subDir;
            if (fs.existsSync(path.join(subDir, 'build.gradle'))) return subDir;
        }
    }
    return buildDir;
}

// Helper: Run command with timeout
function runCommand(cmd, timeout) {
    return new Promise((resolve, reject) => {
        const child = exec(cmd, { timeout, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
            } else resolve({ stdout, stderr });
        });
    });
}

// Helper: Find JAR file
function findJarFile(buildDir, isGradle) {
    const targetDir = isGradle 
        ? path.join(buildDir, 'build', 'libs')
        : path.join(buildDir, 'target');

    if (!fs.existsSync(targetDir)) return null;

    const jars = fs.readdirSync(targetDir)
        .filter(f => f.endsWith('.jar') && !f.includes('sources') && !f.includes('javadoc') && !f.includes('original'))
        .map(f => path.join(targetDir, f));

    return jars[0] || null;
}

// Helper: Auto-generate Maven project
function generateMavenProject(dir, pluginName) {
    // Create src structure
    const srcDir = path.join(dir, 'src', 'main', 'java', 'com', 'example', pluginName.toLowerCase());
    const resourcesDir = path.join(dir, 'src', 'main', 'resources');

    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(resourcesDir, { recursive: true });

    // pom.xml
    const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>${pluginName.toLowerCase()}</artifactId>
    <version>1.0</version>
    <packaging>jar</packaging>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <repositories>
        <repository>
            <id>spigot-repo</id>
            <url>https://hub.spigotmc.org/nexus/content/repositories/snapshots/</url>
        </repository>
    </repositories>

    <dependencies>
        <dependency>
            <groupId>org.spigotmc</groupId>
            <artifactId>spigot-api</artifactId>
            <version>1.20.4-R0.1-SNAPSHOT</version>
            <scope>provided</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>17</source>
                    <target>17</target>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;

    fs.writeFileSync(path.join(dir, 'pom.xml'), pomXml);

    // plugin.yml
    const pluginYml = `name: ${pluginName}
version: 1.0
main: com.example.${pluginName.toLowerCase()}.${pluginName}
api-version: '1.20'
author: MCCompiler`;

    fs.writeFileSync(path.join(resourcesDir, 'plugin.yml'), pluginYml);
}

// Health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'MC Plugin Compiler Ready', 
        oneClick: true,
        usage: 'POST /compile with zip file or source files'
    });
});

// Frontend serve
app.use(express.static('frontend'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MC Compiler running on port ${PORT}`));
