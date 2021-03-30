//Server NodeJS script for hosting an isolated game server
//To test, install NodeJS and run 'node server.js'

//This script can also be directly uploaded to a Node equipped server for easy deployment!
//Make sure to include the package.json and package-lock.json files

const serverNet = Object.freeze( //Enum for server command
	{
		"assign": 0,
		"message": 1,
		"miscData": 2,
		"leave": 3,

		"pos": 4,
		"room": 5,
		"outfit": 6,
		"name": 7,

		"connect": 8
	});

const clientNet = Object.freeze(
	{
		"ID": 1,

		"pos": 2,
		"room": 3,
		"outfit": 4,
		"name": 5,

		"message": 6,
		"email": 7,
		"upload": 8,
		"miscData": 9
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
const fbPath = "./exampleProject-firebase-adminsdk-blah-blahblahblah.json";
try {
	let admin = require("firebase-admin");
	let serviceAccount = require(fbPath);
	const fbURL = "https://exampleProject.firebaseio.com";
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: fbURL
	});
	const db = admin.database();
	const ref = db.ref();
}
catch (e) {
	console.log("Firebase auth is not configured");
}

//nodemailer setup
try {
	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'username',
			pass: 'password'
		}
	});
}
catch (e) {
	console.log("Nodemailer is not configured")
}

//normal webserver setup
http.createServer(function (req, res) {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.write('Ok');
	res.end();
}).listen(8080);

//initialize variables
let socketList = [];
let socketToOutfit = {}, socketToName = {}, socketToRoom = {}, socketToPos = {};
let serverIndex = 0;
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
		socket.on("close", function (err) {//player disconnects
			playerDisconnect(socket);
		});
	});
	tcpServer.listen(TCPPort, function () {
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
	buf.write(socket.uid, 3);
	writeToSocket(socket, buf);

	let _dataName = "data";
	if (isWS) _dataName = "message";
	socket.on(_dataName, function (data)//recieving data from the player
	{
		switch (data.readUInt8(0)) {
			case clientNet.ID:
				socket.uid = readBufString(data, 1);
				socketToName[socket.uid] = "Joe";
				socketToOutfit[socket.uid] = "0242312170110255000000000000255";
				socketToRoom[socket.uid] = "standby";
				socketToPos[socket.uid] = ["0", "0"];
				socketList.forEach(_sock => {
					if (_sock.id != socket.id) {
						sendPlayerData(serverNet.pos, "0:0?1", socket.id, _sock);

						sendPlayerData(serverNet.name, socketToName[_sock.uid], _sock.id, socket);//send other player to this player
						sendPlayerData(serverNet.outfit, socketToOutfit[_sock.uid], _sock.id, socket);
						sendPlayerData(serverNet.room, socketToRoom[_sock.uid], _sock.id, socket);
						sendPlayerData(serverNet.pos, socketToPos[_sock.uid][0] + ":" + socketToPos[_sock.uid][1] + "?1", _sock.id, socket);
					}
				});
				break;

			case clientNet.pos:
			case clientNet.room:
			case clientNet.outfit:
			case clientNet.name:
				var _data = readBufString(data, 1);
				if (data.readUInt8(0) == clientNet.room) socketToRoom[socket.uid] = _data;
				else if (data.readUInt8(0) == clientNet.name) socketToName[socket.uid] = _data;
				else if (data.readUInt8(0) == clientNet.pos) {
					socketToPos[socket.uid][0] = _data.substring(0, 7);
					socketToPos[socket.uid][1] = _data.substring(8, 15);
				}
				else if (data.readUInt8(0) == clientNet.outfit) socketToOutfit[socket.uid] = _data;
				socketList.forEach(_sock => {
					if (_sock.id != socket.id) sendPlayerData(data.readUInt8(0), _data, socket.id, _sock);
				});
				break;

			case clientNet.message:
				var _text = data.toString("utf-8", 1);
				socketList.forEach(_sock => {
					if (_sock.id != socket.id) {
						buf.fill(0);
						buf.writeUInt8(serverNet.message, 0);
						buf.write(_text, 1);
						writeToSocket(_sock, buf);
					}
				});
				break;

			case clientNet.leave:
				break;

			case clientNet.email:
				var _text = readBufString(data, 1);
				var mailOptions = {
					from: 'exampleSender@gmail.com',
					to: 'helpDesk@gmail.com',
					subject: 'Bug Report - Player ' + socketToName[socket.id] + " #" + socket.uid,
					text: 'Bug report:\n\n' + _text
				};

				transporter.sendMail(mailOptions, function (error, info) {
					if (error) {
						console.log(error);
					} else {
						console.log('Email sent: ' + info.response);
					}
				});
				break;

			case clientNet.upload:
				break;

			case clientNet.miscData: //event data send by player
				var _data = JSON.parse(readBufString(data, 1));
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
	socketList.forEach(_sock => {
		buf.fill(0);
		buf.writeUInt8(serverNet.leave, 0);
		buf.writeUInt16LE(socket.id, 1);
		writeToSocket(_sock, buf);
	});

	delete socketToName[socket.uid];
	delete socketToOutfit[socket.uid];
	delete socketToRoom[socket.uid];
	delete socketToPos[socket.uid];
	console.log("Remaining Players: " + socketList.length);
}

function removeEmpty(_list) {
	return _list.filter(function (el) {
		return el != null;
	});
}

function sendPlayerData(_type, _data, _fromSocket, _toSocket) {//sends player data
	buf.fill(0);
	buf.writeUInt8(_type, 0);
	buf.writeUInt16LE(_fromSocket, 1);
	buf.write(_data, 3);
	writeToSocket(_toSocket, buf);
}

function sendPlayerCount() { //sends player count to the manager
	buf.fill(0);
	var len = buf.writeUInt8(network.sendPlayerCount, 0);
	len += buf.writeUInt8(socketList.length, len);
	serverSocket.write(buf);
}

function readBufString(str, ind) {
	return str.toString("utf-8", ind).replace(/\0/g, '').replace("\u0005", "");
}