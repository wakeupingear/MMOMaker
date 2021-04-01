const serverNet = Object.freeze( //Enum for server-to-client packets
    {
        "assign": 0,
        "message": 1,
        "miscData": 2,
        "pos": 3,
        "room": 4,
        "outfit": 5,
        "name": 6,
        "connect": 7,
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
        "serverData": 22
    });

const net = require("net");
const http = require("http");
const WebSocket = require('ws');

//Default webserver setup for handling HTTP requests to the server
//Necessary for AWS Elastic Beanstlak to pass health checks
http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Ok');
    res.end();
}).listen(8080);

let nextNodeIndex = 0;
let nodes = {};
const buf = Buffer.alloc(512); //Standard data buffer
const bufLarge = Buffer.alloc(4096); //Large data buffer for JSON data

const unifiedCluster = 0; //If 1, the nodes will act as one server instead of multiple separate instances

function serverCode(socket, isWS, addr) {
    socket.id = -1;

    buf.fill(0);
    buf.writeUInt8(clusterNet.type, 0); //Ping the socket to check if it's a player (0) or a server (1)
    buf.writeUInt8(unifiedCluster, 1); //Send the cluster mode in case it's a server
    writeToSocket(socket, buf);

    let _dataName = "data"; //set data type (different between WS and TCP)
    if (isWS) _dataName = "message";
    socket.on(_dataName, function (data) //Recieving data from the socket
    {
        switch (data.readUInt8(0)) { //Check possible headers
            case clusterNet.count: {
                nodes[socket.id].count++;
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
                var _id = data.readUInt16LE(1);
                Objects.values(nodes).forEach(sock => {
                    if (sock.id != socket.id) {
                        buf.fill(0);
                        buf.writeUInt8(serverNet.leave, 0);
                        buf.writeUInt16LE(_id, 1);
                        writeToSocket(sock, buf);
                    }
                });
                break;
            }
            case clusterNet.miscData: {
                let _data = JSON.parse(readBufString(data, 1));
                break;
            }
            case clusterNet.type: {
                if (data.readUInt8(0) == 0) { //Player
                    bufLarge.fill(0);
                    bufLarge.writeUInt8(clusterNet.serverData, 0);
                    bufLarge.write(JSON.stringify(nodes), 1);
                    writeToSocket(socket, bufLarge);
                }
                else { //Server node
                    socket.id = nextNodeIndex;
                    nextNodeIndex = (nextNodeIndex++ % 256);
                    nodes[socket.id] = {
                        ip: addr,
                        count: 0
                    }
                }
                break;
            }
            default: { break; }
        }
    });
}

const wsPort = 63458; //WS Port
const wsServer = new WebSocket.Server({ port: wsPort });
wsServer.on('connection', function (ws, req) { //Player connects
    serverCode(ws, true, req.socket.remoteAddress.substring(7, req.socket.remoteAddress.length));

    ws.on('close', function close() { //Disconnect
        playerDisconnect(ws);
    });
});

//Create TCP server
const TCPPort = 63459; //TCP Port
const tcpServer = net.createServer()
tcpServer.on("connection", function (socket) //Player connects
{
    serverCode(socket, false, socket.remoteAddress.substring(7, socket.remoteAddress.length));

    socket.on("error", function (err) { //Disconnect due to error
        playerDisconnect(socket);
    });
    socket.on("close", function (err) { //Disconnect
        playerDisconnect(socket);
    });
});
tcpServer.listen(TCPPort, function () { //Start TCP server
    console.log("The Server has Started");
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

function playerDisconnect(socket) { //Player disconnects
    if (socket.id in nodes) {
        delete nodes[socket.id];
        console.log("Remaining Nodes: " + Object.keys(nodes).length);
    }
}

function readBufString(str, ind) { //Sanitize a string to remove GMS headers and characters
    return str.toString("utf-8", ind).replace(/\0/g, '').replace("\u0005", "");
}