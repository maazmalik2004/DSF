import Docker from "dockerode"; // Note: the popular library is "dockerode" (likely a typo in the original as "dockernode")
const docker = new Docker(); // Defaults to local socket; adjust if remote (e.g., new Docker({ host: 'localhost', port: 2375 }))

const imageName = "workercontainer";
// Inside containerOrchestration.js – improved startContainer
async function startContainer(containerId) {
    let container;

    if (containerId) {
        container = docker.getContainer(containerId);
        try {
            await container.start();
            console.log(`Started existing container: ${containerId}`);
        } catch (err) {
            if (err.statusCode === 404) {
                console.warn(`Container ${containerId} not found – creating new one instead`);
                containerId = null; // fall back to creating new
            } else {
                throw err;
            }
        }
    }

    // Create new if no valid existing container
    if (!containerId) {
        container = await docker.createContainer({
            Image: imageName,
            ExposedPorts: { "3000/tcp": {} },
            HostConfig: {
                PortBindings: { "3000/tcp": [{ HostPort: "0" }] }
            }
        });
        await container.start();
    }

    const data = await container.inspect();
    const hostPort = parseInt(data.NetworkSettings.Ports["3000/tcp"][0].HostPort, 10);

    return {
        containerId: container.id,
        hostPort
    };
}

function stopContainer(containerId) {
    if (!containerId) return;
    const container = docker.getContainer(containerId);
    return container.stop(); // Returns a promise
}

async function execute(containerId, command) {
    if (!containerId) throw new Error("Invalid containerId");

    const container = docker.getContainer(containerId);

    const exec = await container.exec({
        Cmd: typeof command === 'string' ? ['sh', '-c', command] : command,
        AttachStdout: true,
        AttachStderr: true
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    let output = '';
    let error = '';

    docker.modem.demuxStream(stream, {
        write: (chunk) => { output += chunk.toString(); }
    }, {
        write: (chunk) => { error += chunk.toString(); }
    });

    await new Promise((resolve, reject) => {
        exec.inspect((err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
        stream.on('end', () => {}); // Stream ends when exec finishes
    });

    if (error) throw new Error(`Command error: ${error}`);

    return output.trim();
}

export default {startContainer, stopContainer, execute};