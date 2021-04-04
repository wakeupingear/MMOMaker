function scrMMOSetup(){
	enum serverNet //Enum for server-to-client packets
	{
		assign= 1,
		message= 2,
		miscData= 3,
		pos= 4,
		myRoom= 5,
		outfit= 6,
		name= 7,
		leave= 8,
		playerObj= 9
	}

	enum clientNet //Enum for client-to-server packets
	{
		ID= 20,

		pos= 21,
		myRoom= 22,
		outfit= 23,
		name= 24,

		message= 25,
		email= 26,
		upload= 27,
		miscData= 28
	}

	enum clusterNet //Enum for cluster packets
	{
		count= 40,
		playerData= 41,
		miscData= 42,
		type= 43,
		serverData= 44,
		queue= 45,
		leave= 46
	}

	global.MMO_Buf=buffer_create(512,buffer_fixed,1);
	global.MMO_BufLarge=buffer_create(4096,buffer_fixed,1);
	scrMMOCreateSocket();
	global.MMO_IP="127.0.0.1";
	global.MMO_Port=63456+global.MMO_isWS;

	global.MMO_SavePath="saveData.ini";
	global.MMO_UID="";
	global.MMO_ID=-1;

	global.MMO_Players={};
	global.MMO_PlayerObject=oPlayer;
	global.MMO_OtherPlayerObject=oOtherPlayer;
	global.MMO_ServerBrowser={};
	global.MMO_ServerBrowserType=0;
	global.MMO_isCluster=false;
	global.MMO_ClusterMode=0;
	global.MMO_QueuePos=-1;

	global.playerName="Joe";
	global.playerOutfit="0242312170110255000000000000255"

	if !file_exists(global.MMO_SavePath) scrMMOSave();
	scrMMOLoad();
}

function scrMMOCreateSocket(){
	if (os_browser!=browser_not_a_browser){
		global.MMO_isWS=true;
		global.MMO_Socket=network_create_socket(network_socket_ws);
	}
	else{
		global.MMO_isWS=false;
		global.MMO_Socket=network_create_socket(network_socket_tcp);
		network_set_timeout(global.MMO_Socket,4000,4000);
	}
}

function scrMMOConnect(ipOPTIONAL,portOPTIONAL){ //Connect to a server
	if is_undefined(ipOPTIONAL) ipOPTIONAL=global.MMO_IP;
	if is_undefined(portOPTIONAL) portOPTIONAL=global.MMO_Port;
	scrMMOCreateSocket(); //Force a socket reset before connecting to a new server
	network_connect_raw_async(global.MMO_Socket,ipOPTIONAL,portOPTIONAL);
}

function scrMMOSave(){ //Save MMO and player data
	ini_open(global.MMO_SavePath);
	ini_write_string("MMO_Data","UID",global.MMO_UID);
	ini_write_string("MMO_Player","Name",global.playerName);
	ini_write_string("MMO_Player","Outfit",global.playerOutfit);
	ini_close();
}

function scrMMOLoad(){ //Load MMO and player data
	ini_open(global.MMO_SavePath);
	global.MMO_UID=ini_read_string("MMO_Data","UID","-1");

	global.playerName=ini_read_string("MMO_Player","Name","Joe");
	global.playerOutfit=ini_read_string("MMO_Player","Outfit","0242312170110255000000000000255");
	ini_close();
}

function scrMMOGetPacket(network_map){ //Process a packet - put this in an Async - Networking event
	var buffer=network_map[? "buffer"];
	var _size=network_map[? "size"];
	if !is_undefined(buffer){
		buffer_seek(buffer,buffer_seek_start,0);
		for (var _bufferInd=1;buffer_tell(buffer)< _size;_bufferInd++){
		{
			switch (network_map[? "type"]){
				case network_type_data:
					var _header=buffer_read(buffer,buffer_u8);
					switch (_header){
						case 0: break; //Empty byte between packets
						case serverNet.assign:
							global.MMO_ID=string(buffer_read(buffer,buffer_u16));
							global.MMO_Players[$ global.MMO_ID]={
								obj: "player",
								ind: global.MMO_ID
							}
							var _uid=buffer_read(buffer,buffer_string);
							if global.MMO_UID=="" {
								global.MMO_UID=_uid;
								scrMMOSave();
							}
							buffer_seek(global.MMO_BufLarge,buffer_seek_start,2);
							buffer_write(global.MMO_BufLarge,buffer_u8,clientNet.ID);
							var _data={
								uid: global.MMO_UID,
								name: global.playerName,
								outfit: global.playerOutfit,
								myRoom: room_get_name(room),
								pos: [0,0,1]
							}
							buffer_write(global.MMO_BufLarge,buffer_string,json_stringify(_data));
							scrMMOSendPacketLen(global.MMO_BufLarge);
							scrMMOJoinGame();
							break;
						case serverNet.playerObj:
							var _id=buffer_read(buffer,buffer_u8);
							var _data=json_parse(buffer_read(buffer,buffer_string));
							scrMMOCreateOtherPlayer(_id,_data);
							break;
						case clusterNet.type:
							global.MMO_ClusterMode=buffer_read(buffer,buffer_u8);
							global.MMO_isCluster=true;
							buffer_seek(global.MMO_Buf,buffer_seek_start,0);
							buffer_write(global.MMO_Buf,buffer_u8,clusterNet.type);
							buffer_write(global.MMO_Buf,buffer_u8,0);
							scrMMOSendPacket(global.MMO_Buf);
							break;
						case clusterNet.serverData:
							var _data=buffer_read(buffer,buffer_string);
							global.MMO_ServerBrowser= json_parse(_data);
							scrMMOServerBrowser();
							break;
						case clusterNet.queue:
							global.MMO_QueuePos=buffer_read(buffer,buffer_u16);
							show_debug_message("Place in Queue: "+string(global.MMO_QueuePos));
							break;
						case serverNet.leave:
							var _id=string(buffer_read(buffer,buffer_u16));
							instance_destroy(global.MMO_Players[$ _id].obj);
							variable_struct_remove(global.MMO_Players,_id);
							break;
						case clientNet.pos:
							var _id=string(buffer_read(buffer,buffer_u16));
							var _x=buffer_read(buffer,buffer_s16);
							var _y=buffer_read(buffer,buffer_s16);
							var _t=buffer_read(buffer,buffer_u8);
							scrMMOGetData(_id,_header,[_x,_y,_t]);
							break;
						default:
							var _id=string(buffer_read(buffer,buffer_u16));
							scrMMOGetData(_id,_header,buffer_read(buffer,buffer_string));
							break;
					}
					break;
				}
			}
			buffer_seek(buffer,buffer_seek_start,min(_size,_bufferInd*512));
		}
	}
}

function scrMMODisconnect(isCluster,connectAgain){ //Send a disconnect request (network_destroy doesn't work on every platform)
	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	if !isCluster buffer_write(global.MMO_Buf,buffer_u8,serverNet.leave);
	else buffer_write(global.MMO_Buf,buffer_u8,clusterNet.leave);
	scrMMOSendPacketLen(global.MMO_Buf);
	
	show_debug_message("Disconnected from Server");
	global.MMO_Players={};
	if connectAgain {
		scrMMOConnect();
	}
}

function scrMMOServerBrowser(){ //Process server browser when connecting to a cluster
	switch (global.MMO_ServerBrowserType){
		case 0: //Connect to the least full server
			var _serverInd=-1;
			var _minPlayers=global.MMO_ServerBrowser.cap;
			var _names=variable_struct_get_names(global.MMO_ServerBrowser);
			for (var i=0;i<array_length(_names);i++){
				if _names[i]!="cap"&&global.MMO_ServerBrowser[$ _names[i]].c<_minPlayers {
					_minPlayers=global.MMO_ServerBrowser[$ _names[i]].c;
					_serverInd=_names[i];
				}
			}
			break;
		case 1: //Connect to the most full server
			var _serverInd=-1;
			var _minPlayers=-1;
			var _names=variable_struct_get_names(global.MMO_ServerBrowser);
			for (var i=0;i<array_length(_names);i++){
				if _names[i]!="cap"&&global.MMO_ServerBrowser[$ _names[i]].c>_minPlayers&&global.MMO_ServerBrowser[$ _names[i]].c<global.MMO_ServerBrowser.cap{
					_minPlayers=global.MMO_ServerBrowser[$ _names[i]].c;
					_serverInd=_names[i];
				}
			}
			break;
		default: break;
	}

	if _serverInd==-1{ //All servers are at max capacity
		show_debug_message("Servers are full!");
		buffer_seek(global.MMO_Buf,buffer_seek_start,0); //Join the lobby queue
		buffer_write(global.MMO_Buf,buffer_u8,clusterNet.queue);
		scrMMOSendPacket(global.MMO_Buf);
	}
	else {
		global.MMO_IP=global.MMO_ServerBrowser[$ _serverInd].ip;
		global.MMO_Port=int64(global.MMO_ServerBrowser[$ _serverInd].p);
		scrMMODisconnect(true,true);
	}
}

function scrMMOSendPacketLen(buffer){ //Simplify packet sending
	var _len=buffer_tell(buffer);
	buffer_seek(buffer,buffer_seek_start,0);
	buffer_write(buffer,buffer_u16,_len);
	network_send_raw(global.MMO_Socket,buffer,_len);
}

function scrMMOSendPacket(buffer){ //Simplify packet sending
	network_send_raw(global.MMO_Socket,buffer,buffer_tell(buffer));
}

function scrMMOSendPosition(x,y,teleport){//Send a position packet (teleport shows that the player snaps to a position regardless of movement type)
	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	buffer_write(global.MMO_Buf,buffer_u8,clientNet.pos);
	buffer_write(global.MMO_Buf,buffer_s16,x);
	buffer_write(global.MMO_Buf,buffer_s16,y);
	buffer_write(global.MMO_Buf,buffer_u8,teleport);
	scrMMOSendPacketLen(global.MMO_Buf);
}

function scrMMOSendRoom(myRoom){
	if !is_string(myRoom) myRoom=room_get_name(myRoom);

	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	buffer_write(global.MMO_Buf,buffer_u8,clientNet.myRoom);
	buffer_write(global.MMO_Buf,buffer_string,myRoom);
	scrMMOSendPacketLen(global.MMO_Buf);
}

function scrMMOSendOutfit(outfit){
	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	buffer_write(global.MMO_Buf,buffer_u8,clientNet.outfit);
	buffer_write(global.MMO_Buf,buffer_string,outfit);
	scrMMOSendPacketLen(global.MMO_Buf);
}

function scrMMOSendName(name){
	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	buffer_write(global.MMO_Buf,buffer_u8,clientNet.name);
	buffer_write(global.MMO_Buf,buffer_string,name);
	scrMMOSendPacketLen(global.MMO_Buf);
}

function scrMMOCreateOtherPlayer(serverID,data){
	if !is_string(serverID) serverID=string(serverID);
	if !variable_struct_exists(global.MMO_Players,serverID) {
		global.MMO_Players[$ serverID]={
			obj: instance_create_depth(x,y,0,global.MMO_OtherPlayerObject),
			ind: serverID,
		}
		global.MMO_Players[$ serverID].obj.serverID=serverID;
	}

	var _obj=global.MMO_Players[$ serverID].obj;
	var _names=variable_struct_get_names(data);
	for (var i=0;i<array_length(_names);i++){
		switch _names[i] {
			case "pos":
				_obj.x=data.pos[0];
				_obj.y=data.pos[1];
				_obj.target_x=data.pos[0];
				_obj.target_y=data.pos[0];
				break;
			case "myRoom":
				_obj.myRoom=asset_get_index(data.myRoom);
				break;
			case "name":
				_obj.name=data.name;
				_obj.nameWidth=string_width(data.name) - (string_width(data.name) mod 2);
				break;
			default:
				variable_instance_set(_obj,_names[i],data[$ _names[i]]);
				break;
		}
	}
}

function scrMMOGetData(serverID,type,data){
	if !is_string(serverID) serverID=string(serverID);
	if !variable_struct_exists(global.MMO_Players,serverID) {
		global.MMO_Players[$ serverID]={
			obj: instance_create_depth(x,y,0,global.MMO_OtherPlayerObject),
			ind: serverID,
		}
		global.MMO_Players[$ serverID].obj.serverID=serverID;
	}
	var _obj=global.MMO_Players[$ serverID].obj;
	switch (type){
		case clientNet.pos:
			if data[2]{
				_obj.x=data[0];
				_obj.y=data[1];
			}
			_obj.target_x=data[0];
			_obj.target_y=data[1];
			break;
		case clientNet.myRoom:
			_obj.myRoom=asset_get_index(data);
			break;
		case clientNet.outfit:
			_obj.outfit=data;
			break;
		case clientNet.name:
			_obj.name=data;
			_obj.nameWidth=string_width(data) - (string_width(data) mod 2);
			break;
		default: break;
	}
}

function scrMMOJoinGame(){
	if !instance_exists(global.MMO_PlayerObject) {
		var _names=variable_struct_get_names(global.MMO_Players);
		for (var i=0;i<array_length(_names);i++){
			if global.MMO_Players[$ _names[i]].ind==global.MMO_ID{
				global.MMO_Players[$ _names[i]].obj=instance_create_depth(192,192,0,global.MMO_PlayerObject);
				break;
			}
		}
	}
	room_goto(rStart);
}