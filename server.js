//Server NodeJS script for hosting an isolated game server
//To test, install NodeJS and run 'node server.js'

//This script can also be directly uploaded to a Node equipped server for easy deployment!
//Make sure to include the package.json and package-lock.json files

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


let serverIndex = 0; //Server index within a larger cluster
let playerCount = 0; //Number of connected players

//NPM Imports
const net = require("net");
const http = require("http");
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

//OPTIONAL - Firebase Realtime Database connection
const fbPath = "./exampleProject-firebase-adminsdk-blah-blahblahblah.json"; //Path to Firebase auth key
try {
	let admin = require("firebase-admin");
	let serviceAccount = require(fbPath);
	const fbURL = "https://exampleProject.firebaseio.com"; //Database URL
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

//OPTIONAL - Email support
try {
	const nodemailer = require('nodemailer');
	const transporter = nodemailer.createTransport({
		service: 'gmail', //Email provider
		auth: {
			user: 'username', //Account username
			pass: 'password' //Account password
		}
	});
}
catch (e) {
	console.log("Nodemailer is not configured")
}

//Default webserver setup for handling HTTP requests to the server
//Necessary for AWS Elastic Beanstlak to pass health checks
http.createServer(function (req, res) {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.write('Ok');
	res.end();
}).listen(8080);


let idToSocket = {}; //Object mapping numeric ID to a socket.
let socketToOutfit = {}, socketToName = {}, socketToRoom = {}, socketToPos = {}; //Objects mapping Socket IDs to data
const buf = Buffer.alloc(512); //Standard data buffer
const bufLarge = Buffer.alloc(4096); //Large data buffer for JSON data

//Function for initializing server
function createServer(parentServer) {
	//Create WS server
	const wsPort = 63456; //WS Port
	const wsServer = new WebSocket.Server({ port: wsPort });
	wsServer.on('connection', function (ws, req) { //Player connects
		serverCode(ws, true, req.socket.remoteAddress.substring(7, req.socket.remoteAddress.length), parentServer);

		ws.on('close', function close() { //Disconnect
			playerDisconnect(ws, parentServer);
		});
	});

	//Create TCP server
	const TCPPort = 63457; //TCP Port
	const tcpServer = net.createServer()
	tcpServer.on("connection", function (socket) //Player connects
	{
		serverCode(socket, false, socket.remoteAddress.substring(7, socket.remoteAddress.length), parentServer);

		socket.on("error", function (err) { //Disconnect due to error
			playerDisconnect(socket, parentServer);
		});
		socket.on("close", function (err) { //Disconnect
			playerDisconnect(socket, parentServer);
		});
	});
	tcpServer.listen(TCPPort, function () { //Start TCP server
		console.log("The Server has Started");
	});
}

//Player connection code
function serverCode(socket, isWS, addr, parentServer) {
	const strID = uuidv4(); //Generate unique UID
	socket.uid = strID; //Asign UID to socket variable
	socket.id = playerCount + serverIndex * 256; //Assign sequential ID (16bits) for packet identification. Including the serverIndex guarantees unique IDs across different servers inside a cluster
	playerCount = (playerCount++ % 256); //Iterate ID
	idToSocket[socket.id] = socket; //Add socket to object
	console.log("New player: " + addr);
	console.log("Current number of Players: " + Object.keys(idToSocket).length);

	buf.fill(0); //Reset a buffer before sending it
	buf.writeUInt8(serverNet.assign, 0); //Packet header
	buf.writeUInt16LE(socket.id, 1); //Write ID to buffer
	buf.write(socket.uid, 3); //Write UID to buffer
	writeToSocket(socket, buf); //Send buffer

	if (parentServer != -1) { //Send the updated player count to the cluster
		buf.fill(0);
		buf.writeUInt8(clusterNet.count, 0);
		buf.writeUInt8(Object.keys(idToSocket).length, 1);
		writeToSocket(parentServer, buf);
	}

	let _dataName = "data"; //set data type (different between WS and TCP)
	if (isWS) _dataName = "message";
	socket.on(_dataName, function (data) //Recieving data from the player
	{
		switch (data.readUInt8(0)) { //Check possible headers
			case clientNet.ID: {//Confirming UID
				socket.uid = readBufString(data, 1); //Sanitize buffer string (remove hidden characters/GMS packet identifiers)
				socketToName[socket.uid] = "Joe"; //Set initial client entries
				socketToOutfit[socket.uid] = "0242312170110255000000000000255";
				socketToRoom[socket.uid] = "standby";
				socketToPos[socket.uid] = ["0", "0"];
				Object.values(idToSocket).forEach(_sock => { //Send new player to all other players
					if (_sock.id != socket.id) {
						sendPlayerData(serverNet.pos, "0:0?1", socket.id, _sock); //Send position
						sendPlayerData(serverNet.name, socketToName[_sock.uid], _sock.id, socket); //Send name
						sendPlayerData(serverNet.outfit, socketToOutfit[_sock.uid], _sock.id, socket); //Send outfit
						sendPlayerData(serverNet.room, socketToRoom[_sock.uid], _sock.id, socket); //Send room
					}
				});
				break;
			}

			case clientNet.pos: //Recieving new player data
			case clientNet.room:
			case clientNet.outfit:
			case clientNet.name:
				forwardPlayerData(data, socket, 0);
				break;

			case clientNet.message: { //Recieving chat message
				let _text = readBufString(data, 1);
				Object.values(idToSocket).forEach(_sock => {
					if (_sock.id != socket.id) {
						buf.fill(0);
						buf.writeUInt8(serverNet.message, 0); //Message header
						buf.write(_text, 1); //Message contents
						writeToSocket(_sock, buf);
					}
				});
				break;
			}

			case clientNet.email: { //Sending email (useful for bug reports, logging data, etc)
				let _text = readBufString(data, 1);
				let mailOptions = { //Nodemailer object
					from: 'exampleSender@gmail.com',
					to: 'helpDesk@gmail.com',
					//cc: 'otherPerson@gmail.com',
					subject: 'Bug Report - Player ' + socketToName[socket.id] + " #" + socket.uid,
					text: 'Bug report:\n\n' + _text
				};

				transporter.sendMail(mailOptions, function (error, info) { //Send email asyncronously
					if (error) {
						console.log(error);
					} else {
						console.log('Email sent: ' + info.response);
					}
				});
				break;
			}

			case clientNet.upload: { //Upload data to Firebase
				//Example: player likes a photo submitted by another player
				const _photoObj = JSON.parse(readBufString(data, 1)); //ID stored in JSON
				ref.child("photos/"+_photoObj.ID).once("value").then(function(snapshot){ //Retrive copy of current Firebase entry for that photo
					const _num=snapshot.toJSON()+1; //Get the number of likes + 1
					ref.child("photos/"+_photoObj.ID).update({"likes": _num}); //Update the Firebase entry
				});
				break;
			}

			case clientNet.miscData: { //event data send by player
				var _data = JSON.parse(readBufString(data, 1));
				break;
			}

			default: { break; }
		}
	});
}

//OPTIONAL - connect this server to a parent server
//Useful if this server needs to get data from another server or for loadbalancing traffic across a cluster of nodes
const ipToConnect = "-1";
let unifiedCluster = false; //Whether the server is co-hosting as part of a cluster
if (ipToConnect != "-1") {
	const serverSocket = new net.Socket();
	const serverPort = 63459;
	serverSocket.connect(serverPort, ipToConnect, function (socket) { //Connect to parent server
		console.log("Connected to ServerManager " + ipToConnect);

		createServer(socket); //Create the server, passing the parent server as an argument in case it needs to be referenced

		serverSocket.on("data", function (data) //Recieving data from the cluster
		{
			switch (data.readUInt8(0)) {
				case clusterNet.playerData: {
					const id = idToSocket[data.readUInt8(1)];
					forwardPlayerData(data, id, 1);
					break;
				}
				case clusterNet.miscData: {
					let _data = JSON.parse(readBufString(data, 1));
					break;
				}
				case clusterNet.type: {
					if (data.readUInt8(1) == 1) unifiedCluster = true; //Update the cluster mode

					buf.fill(0);
					buf.writeUInt8(serverNet.mode, 0);
					buf.writeUInt8(1, 1); //1 represents a server
					writeToSocket(serverSocket, buf);
					break;
				}
				default: { break; }
			}
		});
	});
}
else createServer(-1); //Create the server, passing -1 since there is no parent server



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

function forwardPlayerData(data, socket, dataOffset) {
	var _data = readBufString(data, 1 + dataOffset);
	if (data.readUInt8(0) == clientNet.room) socketToRoom[socket.uid] = _data; //Update room
	else if (data.readUInt8(0) == clientNet.name) socketToName[socket.uid] = _data; //Update name
	else if (data.readUInt8(0) == clientNet.pos) { //Update position
		socketToPos[socket.uid][0] = _data.substring(0, 7);
		socketToPos[socket.uid][1] = _data.substring(8, 15);
	}
	else if (data.readUInt8(0) == clientNet.outfit) socketToOutfit[socket.uid] = _data; //Update outfit
	Object.values(idToSocket).forEach(_sock => { //Send update to other players
		if (_sock.id != socket.id) sendPlayerData(data.readUInt8(0), _data, socket.id, _sock);
	});
}

function playerDisconnect(socket, parentServer) { //Player disconnects
	delete idToSocket[socket.id];
	Object.values(idToSocket).forEach(_sock => { //Send the disconnect to every other player
		buf.fill(0);
		buf.writeUInt8(serverNet.leave, 0);
		buf.writeUInt16LE(socket.id, 1);
		writeToSocket(_sock, buf);
	});

	if (unifiedCluster) { //Send the disconnect to the cluster if this server is co-hosting
		buf.fill(0);
		buf.writeUInt8(serverNet.leave, 0);
		buf.writeUInt16LE(socket.id, 1);
		writeToSocket(parentServer, buf);
	}

	delete socketToName[socket.uid];
	delete socketToOutfit[socket.uid];
	delete socketToRoom[socket.uid];
	delete socketToPos[socket.uid];
	console.log("Remaining Players: " + Object.keys(idToSocket).length);
}

function sendPlayerData(_type, _data, _fromSocket, _toSocket) {//Send player data from one socket to another socket
	buf.fill(0);
	buf.writeUInt8(_type, 0);
	buf.writeUInt16LE(_fromSocket, 1);
	buf.write(_data, 3);
	writeToSocket(_toSocket, buf);
}

function readBufString(str, ind) { //Sanitize a string to remove GMS headers and characters
	return str.toString("utf-8", ind).replace(/\0/g, '').replace("\u0005", "");
}