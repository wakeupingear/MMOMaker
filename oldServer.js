const serverNet = Object.freeze(
	{
		"assign": 0,
		"message": 1,
		"miscData": 2,
		"plyLeave": 3,

		"plyPos": 4,
		"plyRoom": 5,
		"plyOutfit": 6
	});

const clientNet = Object.freeze(
	{
		"message": 0,
		"miscData": 1,
		"plyLeave": 2,
		"email": 3,
		"upload": 4
	});

const serverNodes = ["Mango", "Strawberry", "Blueberry", "Banana", "Dragonfruit", "Raspberry", "Apple", "Pineapple", "Moonberry", "Jerry"];

//npm
const { v4: uuidv4 } = require('uuid');
const net = require("net");
const http = require("http");
const WebSocket = require('ws');
const nodemailer = require('nodemailer');
const

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
const socketToOutfit = new Map(), socketToID = new Map(), socketToName = new Map(), socketToRoom = new Map(), socketToX = new Map(), socketToY = new Map();
const serverIndex = 0;
const buf = Buffer.alloc(512);
const userData = ["email", "northGem", "westGem", "southGem", "numGems", "playerName", "gameFinished"];

function createServer(parentServer) {
	//Create WS server
	const wsPort = 63456;
	const wsServer = new WebSocket.Server({ port: wsPort });
	wsServer.on('connection', function (ws, req) {
		serverCode(ws, true, req.socket.remoteAddress.substring(7, req.socket.remoteAddress.length),parentServer);

		ws.on('close', function close() {
			playerDisconnect(ws);
		});
	});

	//Create TCP server
	const TCPPort = 63457;
	const tcpServer = net.createServer()
	tcpServer.on("connection", function (socket)//player connects
	{
		serverCode(socket, false, socket.remoteAddress.substring(7, socket.remoteAddress.length),parentServer);

		socket.on("error", function (err) {//player disconnects
			playerDisconnect(socket);
		});
	});
	server.listen(TCPPort, function () {
		console.log("The Server has Started");
	});
}

//Player connection code
function serverCode(socket, isWS, addr,parentServer) {
	const strID = uuidv4();
	socket.id = strID;
	socketList.push(socket);
	socketToName[strID] = "Joe";
	socketToOutfit[strID] = "0242312170110255000000000000255";
	socketToRoom[strID] = "standby";
	socketToX[strID] = "0";
	socketToY[strID] = "0";
	sendPlayerCount();
	console.log("New player: " + addr);
	console.log("Current number of Players: " + socketList.length);

	buf.fill(0);
	buf.writeUInt8(network.playerConnect, 0);
	buf.writeUInt16LE(socket.id, 1);
	buf.writeUInt8(serverIndex, 3);
	writeToSocket(socket, buf);

	if (socketList.length > 1) for (i = 0; i < socketList.length; i++) { //send info about all currently connected players
		var _sock = socketList[i];
		if (_sock.id != socket.id) {
			sendPlayerData(1, socketToName[strID], socket.id, _sock);//send this player to other player
			sendPlayerData(4, socketToOutfit[strID], socket.id, _sock);
			sendPlayerData(0, socketToRoom[strID], socket.id, _sock);
			sendPlayerData(2, socketToX[strID] + ":" + socketToY[otherStrID] + "?1", socket.id, _sock);

			var otherStrID = _sock.id.toString();
			sendPlayerData(1, socketToName[otherStrID], _sock.id, socket);//send other player to this player
			sendPlayerData(4, socketToOutfit[otherStrID], _sock.id, socket);
			sendPlayerData(0, socketToRoom[otherStrID], _sock.id, socket);
			sendPlayerData(2, socketToX[otherStrID] + ":" + socketToY[otherStrID] + "?1", _sock.id, socket);
		}
	}

	for (var i = 0; i < panelActive.length; i += 2) { //send active panel info
		buf.fill(0);
		buf.writeUInt8(network.miscData, 0);
		buf.writeUInt8(3, 1);
		buf.write(panelActive[i + 1].toString(), 2);
		writeToSocket(socket, buf);
	}

	if (!isWS) const _dataName = "data";
	else const _dataName = "message";
	socket.on(_dataName, function (data)//recieving data from the player
	{
		switch (data.readUInt8(0)) {
			case clientNet.
			case network.getPlayerData://player data
				var _mode = data.readUInt8(1);
				var _data = data.toString("utf-8", 2).replace(/\0/g, '').replace("\u0005", "");
				var strID = socket.id.toString();
				if (_mode == 0) socketToRoom[strID] = _data;
				else if (_mode == 1) {
					console.log("PLAYER NAME: " + _data);
					socketToName[strID] = _data;
				}
				else if (_mode == 2) {
					socketToX[strID] = _data.substring(0, 7);
					socketToY[strID] = _data.substring(8, 15);
				}
				else if (_mode == 4) socketToOutfit[strID] = _data;
				else if (_mode == 5) socketToID[strID] = _data;
				for (i = 0; i < socketList.length; i++) {
					var _sock = socketList[i];
					if (_sock.id != socket.id) sendPlayerData(_mode, _data, socket.id, _sock);
				}
				break;

			case network.sendMiscData: //event data send by player
				var _type = data.readUInt8(1);
				if (_type == 0) { //emote
					var _emote = data.readUInt8(2);
					for (i = 0; i < socketList.length; i++) {
						var _sock = socketList[i];
						if (_sock.id != socket.id) {
							buf.fill(0);
							buf.writeUInt8(network.miscData, 0);
							buf.writeUInt8(0, 1);
							buf.writeUInt16LE(socket.id, 2);
							buf.writeUInt8(_emote, 4);
							writeToSocket(_sock, buf);
						}
					}
				}
				else if (_type == 1) { //chat message
					//var _text=socketToName[socket.id]+": "+data.toString("utf-8").substring(4,data.toString("utf-8").length);
					var _text = data.toString("utf-8");//.substring(4,data.toString("utf-8").length);
					for (i = 0; i < socketList.length; i++) {
						var _sock = socketList[i];
						if (_sock.id != socket.id) {
							buf.fill(0);
							buf.writeUInt8(network.miscData, 0);
							buf.writeUInt8(1, 1);
							buf.write(_text, 2);
							writeToSocket(_sock, buf);
						}
					}
				}
				else if (_type == 2) { //i forget what this is for
					buf.fill(0);
					buf.writeUInt8(network.sendMiscData, 0);
					buf.writeUInt8(0, 1);
					buf.writeUInt16LE(socket.id, 2);
					buf.write(socketToName[socket.id], 4);
					writeToSocket(socket, buf);
				}
				else if (_type == 3) { //panel set
					var _waitTime = data.readUInt16LE(2);
					var _id = data.toString("utf-8", 4);
					var t = new Date();
					t.setSeconds(t.getSeconds() + _waitTime / 30);
					var _encodeDate = Math.floor(+t / 1000).toString() + ":" + _id;
					if (panelActive.indexOf(_id) == -1) {
						panelActive.push(_id);
						panelActive.push(_encodeDate);//set unix time date

						setTimeout((_waitTime) => { //remove the id
							delete panelActive[panelActive.indexOf(_id) + 1];
							delete panelActive[panelActive.indexOf(_id)];
							panelActive = removeEmpty(panelActive);
							console.log("Resetting panel timer...");
						}, _waitTime / 30 * 1000);

						for (var i = 0; i < socketList.length; i++) {
							buf.fill(0);
							buf.writeUInt8(network.miscData, 0);
							buf.writeUInt8(3, 1);
							buf.write(_encodeDate, 2);
							writeToSocket(socketList[i], buf);
						}
					}
				}
				else if (_type == 4) {//send bug report
					var _text = data.toString("utf-8", 2);
					var mailOptions = {
						from: 'wfwebsitemanager@gmail.com',
						to: 'willf668@gmail.com',
						//cc: 'zach@tinyheadedkingdom.com',
						subject: 'THK Bug Report - From Player ' + socketToName[socket.id.toString()] + " #" + socket.id,
						text: 'Bug report:\n\n' + _text
					};

					transporter.sendMail(mailOptions, function (error, info) {
						if (error) {
							console.log(error);
						} else {
							console.log('Email sent: ' + info.response);
						}
					});
				}
				else if (_type == 5) { //upload sandcastle
					var _pattern = data.toString("utf-8", 2);
					var _id = socketToRandomID[socket.id.toString()];
					console.log("ID: " + _id);
					var _myObj = {};
					_myObj[_id] = {
						"likes": 0,
						"name": socketToName[socket.id.toString()],
						"pattern": _pattern
					}
					try {
						ref.child("castleData").child("castles").update(_myObj, function (error) {
							if (error) {
								console.log("ERROR: sandcastle could not be saved" + error);
							} else {
								ref.child("castleData").child("castles").once("value").then(function (snapshot) {
									var _num = snapshot.numChildren();
									var _indNum = (_num - 1).toString();
									ref.child("castleData").update({ "castleNum": _num });
									ref.child("castleData").child("castleID").update({ [_indNum]: _id }); //ok
								});
							}
						});
					}
					catch (err) { console.log("ERROR: sandcastle ID invalid"); };
				}
				else if (_type == 6) { //get player id
					console.log(data.readUInt32LE(2));
					socketToRandomID[socket.id.toString()] = data.readUInt32LE(2);
					console.log("PLAYER RANDOM ID: " + socketToRandomID[socket.id.toString()]);
				}
				else if (_type == 7) { //add like
					var _id = data.readUInt32LE(2)
					ref.child("castleData/castles/" + _id + "/likes").once("value").then(function (snapshot) {
						var _num = snapshot.toJSON() + 1;
						ref.child("castleData/castles/" + _id).update({ "likes": _num });
					});
				}
				else if (_type == 8) { //add bamboo to bridge
					var _count = data.readUInt8(2);
					ref.child("bridgeBamboo/count").once("value").then(function (snapshot) {
						var _num = snapshot.toJSON() + _count;
						ref.child("bridgeBamboo").update({ "count": _num });
					});

					if (_count >= 1000) {
						console.log("Bridge is done");
					}
				}
				else if (_type == 9 || _type == 10) { //upload waterRace 
					var _name = socketToName[socket.id];
					var _time = data.readUInt32LE(2);
					var _tag = "waterRace";
					if (_type == 10) _tag = "wateringGame";
					ref.child(_tag).once("value").then(function (snapshot) {
						var terms = ["all", "daily"]
						for (pos in terms) {
							var _snap = snapshot.child(terms[pos]);
							var _values = _snap.val();
							var _num = _snap.numChildren();
							var _data = {};
							var _added = false;
							for (var key = 1; _snap.hasChild("s" + key.toString()); key++) {
								var _score = parseInt(_snap.child("s" + key.toString()).child("time").val(), 10);
								if ((_score > _time && _type == 9) || (_score < _time && _type == 10)) //replacing existing one
								{
									console.log("fits on table")
									console.log("Number of children: " + _num)
									for (var i = _num; i >= key; i--) {
										if (i == 5) continue;
										_data["s" + (i + 1)] = _values["s" + i];
									}
									_data["s" + key] = {
										name: _name,
										time: _time
									}
									_added = true;
									break
								}
							}
							if (!_added && (_num < 5)) {
								_num++;
								_data["s" + _num] = {
									name: _name,
									time: _time
								}
								_added = true;
							}
							if (_added) ref.child(_tag).child(terms[pos]).update(_data);
						}
					});
				}
				else if (_type == 11) {
					var _id = socketToRandomID[socket.id.toString()];
					var _dataID = userData[data.readUInt8(2)];
					var _data = data.toString("utf-8", 3).replace(/\0/g, '');
					ref.child("userData/" + _id).update({
						[_dataID]: _data
					});
				}
				break;

			case network.bulletinData://should be 8
				var list = "";
				console.log("SENDING BULLETIN DATA TO CLIENT")
				for (i = 0; i < bulletinItems.length; i++) list += bulletinItems[i];
				buf.fill(0);
				var len = buf.writeUInt8(network.bulletinData, 0);
				len += buf.write(list, 0);
				writeToSocket(socket, buf);
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
	var strID = socket.id;
	socketList = removeEmpty(socketList);

	for (var i = 0; i < socketList.length; i++) {
		var _sock = socketList[i];
		buf.fill(0);
		buf.writeUInt8(network.playerLeave, 0);
		buf.writeUInt16LE(strID, 1);
		writeToSocket(_sock, buf);
	}
	strID = strID.toString();
	socketToID.delete(strID);
	socketToName.delete(strID);
	socketToOutfit.delete(strID);
	socketToRoom.delete(strID);
	socketToX.delete(strID);
	socketToY.delete(strID);
	sendPlayerCount();
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

var t = setInterval(function () { //get updated bulletin board list
	requestBulletin()
}, 300000);//pings every 5 minutes

function requestBulletin() {
	buf.fill(0);
	var len = buf.writeInt8(network.bulletinData, 0);
	serverSocket.write(buf);
}