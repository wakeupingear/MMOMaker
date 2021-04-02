const serverNet = Object.freeze( //Enum for server-to-client packets
    {
        "assign": 0,
        "message": 1,
        "miscData": 2,
        "pos": 3,
        "room": 4,
        "outfit": 5,
        "name": 6,
        "leave": 8
    });

const clientNet = Object.freeze( //Enum for client-to-server packets
    {
        "ID": 9,

        "pos": 10,
        "room": 11,
        "outfit": 12,
        "name": 13,

        "message": 14,
        "email": 15,
        "upload": 16,
        "miscData": 17
    });

const clusterNet = Object.freeze( //Enum for cluster packets
    {
        "count": 18,
        "playerData": 19,
        "miscData": 20,
        "type": 21,
        "serverData": 22,
        "queue": 23,
        "leave": 24
    });

const net = require("net");
const http = require("http");
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

//Default webserver setup for handling HTTP requests to the server
//Necessary for AWS Elastic Beanstlak to pass health checks
try {
    http.createServer(function (req, res) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write('Ok');
        res.end();
    }).listen(8080);
}
catch (e) {
    console.log("Port in use");
}

let nextNodeIndex = 0;
const nodeCapacity = 32; //Max capacity of a single node
let nodes = { cap: nodeCapacity }; //Object of all connected nodes (capacity included to be sent to players)
const buf = Buffer.alloc(512); //Standard data buffer
const bufLarge = Buffer.alloc(4096); //Large data buffer for JSON data

const unifiedCluster = false; //If true, the nodes will act as one server instead of multiple separate instances
const queue = []; //Queue for players waiting when the nodes are at max capacity
const serverList = []; //List of all servers

function serverCode(socket, isWS, addr) {
    socket.id = -1;
    socket.uid = uuidv4(); //Asign UID to socket variable

    buf.fill(0);
    buf.writeUInt8(clusterNet.type, 0); //Ping the socket to check if it's a player (0) or a server (1)
    buf.writeUInt8((unifiedCluster ? 1 : 0), 1); //Send the cluster mode in case it's a server
    writeToSocket(socket, buf);

    let _dataName = "data"; //set data type (different between WS and TCP)
    if (isWS) _dataName = "message";
    socket.on(_dataName, function (data) //Recieving data from the socket
    {
        switch (data.readUInt8(0)) { //Check possible headers
            case clusterNet.count: {
                nodes[socket.id].count++; //Increase the count (decreasing happens in serverNet.leave)
                break;
            }
            case clusterNet.playerData: { //Send player data to the other servers
                const _id = data.readUInt16LE(1);
                const _type = data.readUInt8(3);
                const _data = readBufString(data, 4);
                Objects.values(nodes).forEach(sock => {
                    if (sock.id != socket.id) {
                        buf.fill(0);
                        buf.writeUInt8(clusterNet.playerData, 0);
                        buf.writeUInt16LE(_id, 1);
                        buf.write(_type, 3);
                        buf.write(_data, 4);
                        writeToSocket(sock, buf);
                    }
                });
                break;
            }
            case serverNet.leave: { //Send a player leave event to the other servers
                nodes[socket.id].count--;
                var _id = data.readUInt16LE(1);
                if (unifiedCluster) {
                    Objects.values(nodes).forEach(sock => {
                        if (sock.id != socket.id) {
                            buf.fill(0);
                            buf.writeUInt8(serverNet.leave, 0);
                            buf.writeUInt16LE(_id, 1);
                            writeToSocket(sock, buf);
                        }
                    });
                }

                if (queue.length > 0) {
                    queue.shift(); //Remove the UID
                    let _nextSocket = queue.shift(); //Remove and store the socket
                    sendServerBrowser(_nextSocket);
                    for (let i = 0; i < queue.length; i += 2) sendPlayerQueuePos(queue[i + 1], i);
                }
                break;
            }
            case clusterNet.miscData: {
                let _data = JSON.parse(readBufString(data, 1));
                break;
            }
            case clusterNet.type: { //Identifier of what kind of client this is
                if (data.readUInt8(1) == 0) { //Player
                    sendServerBrowser(socket);
                }
                else { //Server node
                    console.log("Node added");
                    socket.id = nextNodeIndex;
                    nextNodeIndex = (nextNodeIndex++ % 256);
                    nodes[socket.id] = { //Names are short to keep packet size small
                        ip: addr, //IP
                        p: data.readUInt16LE(1), //TCP port
                        c: 0 //playerCount
                    }
                    serverList.push({ uid: socket.uid, sock: socket });
                    if (unifiedCluster) serverList.forEach(server => { sendServerBrowser(server.sock); }); //Send updated server list to nodes
                }
                break;
            }
            case clusterNet.queue: { //Player requesting place in queue
                queue.push(socket.uid, socket); //Add the UID (removing from the queue if they disconnect) and the socket (sending updates)
                sendPlayerQueuePos(socket, queue.length) //Send place in queue to player
                break;
            }
            case clusterNet.leave: {
                if (!isWS) socket.destroy();
                else socket.close();
            }
            default: {
                if (unifiedCluster) serverList.forEach(server => { //Pass data to other server nodes
                    if (server.uid!=socket.uid) writeToSocket(server.sock,data);
                });
            }
        }
    });
}

//Create TCP server
const TCPPort = 63458; //TCP Port
const tcpServer = net.createServer()
tcpServer.on("connection", function (socket) //Player connects
{
    serverCode(socket, false, socket.remoteAddress.substring(7, socket.remoteAddress.length));

    socket.on("error", function (err) { //Disconnect due to error
        clientDisconnect(socket);
    });
    socket.on("close", function (err) { //Disconnect
        clientDisconnect(socket);
    });
});
tcpServer.listen(TCPPort, function () { //Start TCP server
    console.log("The Server has Started");
});

//Create WS server
const wsPort = 63459; //WS Port
const wsServer = new WebSocket.Server({ port: wsPort });
wsServer.on('connection', function (ws, req) { //Player connects
    serverCode(ws, true, req.socket.remoteAddress.substring(7, req.socket.remoteAddress.length));

    ws.on('close', function close() { //Disconnect
        clientDisconnect(ws);
    });
});


//Helper functions
function writeToSocket(socket, dataBuf) { //Send a buffer to a socket - necessary since WS and TCP use different syntax
    try {
        if (!socket.isWS) {
            socket.write(dataBuf);
        }
        else socket.send(dataBuf);
    }
    catch (err) {
        console.log("Sending error: " + err);
    }
}

function clientDisconnect(socket) { //Player disconnects
    if (socket.id in nodes) { //Server node
        for (let i = 0; i < serverList.length; i++) {
            if (serverList[i].uid == socket.uid) {
                serverList.splice(i, 1);
                break;
            }
        }
        if (unifiedCluster) serverList.forEach(server => { sendServerBrowser(server.sock); }); //Send updated server list to nodes
        delete nodes[socket.id];
        console.log("Remaining Nodes: " + (Object.keys(nodes).length-1));
    }
    else { //Player
        let qInd = queue.indexOf(socket.uid);
        if (qInd > 0) {
            queue.splice(qInd, 2); //Remove the player from the queue
            for (let i = 0; i < queue.length; i += 2) sendPlayerQueuePos(queue[i + 1], i); //Update other queued players
        }
    }
}

function readBufString(str, ind) { //Sanitize a string to remove GMS headers and characters
    return str.toString("utf-8", ind).replace(/\0/g, '').replace("\u0005", "");
}

function sendPlayerQueuePos(socket, pos) {
    buf.fill(0); //Send place in queue to player
    buf.writeUInt8(clusterNet.queue, 0);
    buf.writeUInt16(pos + 1, 1);
    writeToSocket(socket, buf);
}

function sendServerBrowser(socket) {
    bufLarge.fill(0);
    bufLarge.writeUInt8(clusterNet.serverData, 0);
    bufLarge.write(JSON.stringify(nodes), 1);
    writeToSocket(socket, bufLarge);
}