const serverNet = Object.freeze(
	{
		"assign": 0,
		"message": 1,
		"miscData": 2,
		"plyLeave": 3,

		"pos": 4,
		"room": 5,
		"outfit": 6,
		"name": 7
	});

const clientNet = Object.freeze(
	{
		"ID": 9,

		"pos": 5,
		"room": 6,
		"outfit": 7,
		"name": 8,

		"message": 0,
		"leave": 2,
		"email": 3,
		"upload": 4,
		"miscData": 1,
	});

const serverNodes = ["Mango", "Strawberry", "Blueberry", "Banana", "Dragonfruit", "Raspberry", "Apple", "Pineapple", "Moonberry", "Jerry"];
let playerCount = 0;

//npm
const { v4: uuidv4 } = require('uuid');
const net = require("net");
const http = require("http");
const WebSocket = require('ws');
const nodemailer = require('nodemailer');

//firebase setup
const fbAuth = "./tinyheadedgame-firebase-adminsdk-xrz8t-d167d1065d.json";
const fbURL = "https://tinyheadedgame.firebaseio.com";
var admin = require("firebase-admin");
var serviceAccount = require(fbAuth);
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: fbURL
});
var db = admin.database();
var ref = db.ref();

//nodemailer setup
const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: 'username',
		pass: 'password'
	}
});

//normal webserver setup
http.createServer(function (req, res) {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.write('Ok');
	res.end();
}).listen(8080);

//initialize variables
const socketList = [];
const socketToOutfit = new Map(), socketToName = new Map(), socketToRoom = new Map(), socketToPos = new Map();
const serverIndex = 0;
const buf = Buffer.alloc(512);
const userData = ["email", "northGem", "westGem", "southGem", "numGems", "playerName", "gameFinished"];

function createServer(parentServer) {
	//Create WS server
	const wsPort = 63456;
	const wsServer = new WebSocket.Server({ port: wsPort });
	wsServer.on('connection', function (ws, req) {
		serverCode(ws, true, req.socket.remoteAddress.substring(7, req.socket.remoteAddress.length), parentServer);

		ws.on('close', function close() {
			playerDisconnect(ws);
		});
	});

	//Create TCP server
	const TCPPort = 63457;
	const tcpServer = net.createServer()
	tcpServer.on("connection", function (socket)//player connects
	{
		serverCode(socket, false, socket.remoteAddress.substring(7, socket.remoteAddress.length), parentServer);

		socket.on("error", function (err) {//player disconnects
			playerDisconnect(socket);
		});
	});
	server.listen(TCPPort, function () {
		console.log("The Server has Started");
	});
}

//Player connection code
function serverCode(socket, isWS, addr, parentServer) {
	const strID = uuidv4();
	socket.uid = strID;
	socket.id = playerCount;
	playerCount = (playerCount++ % 65636);
	socketList.push(socket);
	console.log("New player: " + addr);
	console.log("Current number of Players: " + socketList.length);

	buf.fill(0);
	buf.writeUInt8(serverNet.assign, 0);
	buf.writeUInt16LE(socket.id, 1);
	buf.writeUInt8(playerCount, 3);
	buf.write(socket.uid, 4);
	writeToSocket(socket, buf);

	if (!isWS) const _dataName = "data";
	else const _dataName = "message";
	socket.on(_dataName, function (data)//recieving data from the player
	{
		switch (data.readUInt8(0)) {
			case clientNet.ID:
				socketToName[socket.uid] = "Joe";
				socketToOutfit[socket.uid] = "0242312170110255000000000000255";
				socketToRoom[socket.uid] = "standby";
				socketToPos[socket.uid] = ["0", "0"];
				for (let i = 0; i < socketList.length; i++) { //send info about all currently connected players
					const _sock = socketList[i];
					if (_sock.id != socket.id) {
						sendPlayerData(serverNet.pos, "0:0?1", socket.id, _sock);

						sendPlayerData(serverNet.name, socketToName[_sock.uid], _sock.id, socket);//send other player to this player
						sendPlayerData(serverNet.outfit, socketToOutfit[_sock.uid], _sock.id, socket);
						sendPlayerData(serverNet.room, socketToRoom[_sock.uid], _sock.id, socket);
						sendPlayerData(serverNet.pos, socketToPos[_sock.uid][0] + ":" + socketToPos[_sock.uid][1] + "?1", _sock.id, socket);
					}
				}
				break;

			case clientNet.pos:
			case clientNet.room:
			case clientNet.outfit:
			case clientNet.name:
				var _data = data.toString("utf-8", 1).replace(/\0/g, '').replace("\u0005", "");
				if (data.readUInt8(0) == clientNet.room) socketToRoom[socket.uid] = _data;
				else if (data.readUInt8(0) == clientNet.name) socketToName[socket.uid] = _data;
				else if (data.readUInt8(0) == clientNet.pos) {
					socketToPos[socket.uid] = _data.substring(0, 7);
					socketToY[socket.uid] = _data.substring(8, 15);
				}
				else if (data.readUInt8(0) == clientNet.outfit) socketToOutfit[socket.uid] = _data;
				socketList.forEach(_sock => {
					if (_sock.id != socket.id) sendPlayerData(data.readUInt8(0), _data, socket.id, _sock);
				});
				break;
			
			case clientNet.message:
				break;

			case clientNet.leave:
				break;

			case clientNet.email:
				break;

			case clientNet.upload:
				break;

			case clientNet.miscData: //event data send by player
				break;

			default: break;
		}
	});
}


//OPTIONAL - connect this server to a parent server
//Useful if this server needs to get data from another server
const ipToConnect = "-1";
if (ipToConnect != "-1") {
	const serverSocket = new net.Socket();
	serverSocket.connect(63458, ipToConnect, function (socket) { //connect to server manager
		console.log("Connected to ServerManager " + ipToConnect);

		createServer(socket);

		serverSocket.on("data", function (data)//recieving data from the server
		{
			switch (data.readUInt8(0)) {
				case network.assignServer://send number of players
					console.log("sending player count...");
					sendPlayerCount();
					break;

				case network.miscData:
					var _type = data.readUInt8(1);
					if (_type == 0) { //forgot what this does lmao
						var _sock = data.readUInt8(2);
						var _num = data.toString('ascii', 3);
						if (socketToID[_sock] != null) {
							buf.fill(0);
							var len = buf.writeUInt8(network.miscData, 0);
							len += buf.writeUInt8(2, len);
							len += buf.write(_num, len);
							serverSocket.write(buf);
							socketToID[_sock] = parseInt(_num);
						}
					}
					else if (_type == 1) {
						serverIndex = serverNodes[data.readUInt8(2)];
					}
					break;

				default: break;
			}
		});
	});
}
else createServer(-1);



//misc functions
function writeToSocket(socket, dataBuf) {
	try {
		if (!socket.isWS) {
			socket.write(dataBuf);
		}
		else socket.send(dataBuf);
	}
	catch (err) {
		console.log("sending error: " + err);
	}
}

function playerDisconnect(socket) {
	var _ind = socketList.indexOf(socket);
	if (_ind > -1) delete socketList[_ind]; //for (i=0;i<3;i++) delete socketList[_ind+i];
	socketList = removeEmpty(socketList);

	for (let i = 0; i < socketList.length; i++) {
		var _sock = socketList[i];
		buf.fill(0);
		buf.writeUInt8(network.playerLeave, 0);
		buf.writeUInt16LE(socket.id, 1);
		writeToSocket(_sock, buf);
	}

	socketToName.delete(socket.uid);
	socketToOutfit.delete(socket.uid);
	socketToRoom.delete(socket.uid);
	socketToPos.delete(socket.uid);
	console.log("Remaining Players: " + socketList.length);
}

function removeEmpty(_list) {
	return _list.filter(function (el) {
		return el != null;
	});
}

function sendPlayerData(_type, _data, _fromSocket, _toSocket) {//sends player data

	buf.fill(0);
	buf.writeUInt8(network.playerData, 0);
	buf.writeUInt16LE(_fromSocket, 1);
	buf.writeUInt8(_type, 3);
	buf.write(_data, 4);
	writeToSocket(_toSocket, buf);
}

function sendPlayerCount() { //sends player count to the manager
	buf.fill(0);
	var len = buf.writeUInt8(network.sendPlayerCount, 0);
	len += buf.writeUInt8(socketList.length, len);
	serverSocket.write(buf);
}