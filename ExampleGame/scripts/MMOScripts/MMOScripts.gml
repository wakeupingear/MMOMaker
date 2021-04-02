function scrMMOSetup(){
	enum serverNet //Enum for server-to-client packets
	{
		assign= 0,
		message= 1,
		miscData= 2,
		pos= 3,
		room= 4,
		outfit= 5,
		name= 6,
		leave= 8
	}

	enum clientNet //Enum for client-to-server packets
	{
		ID= 9,

		pos= 10,
		room= 11,
		outfit= 12,
		name= 13,

		message= 14,
		email= 15,
		upload= 16,
		miscData= 17
	}

	enum clusterNet //Enum for cluster packets
	{
		count= 18,
		playerData= 19,
		miscData= 20,
		type= 21,
		serverData= 22,
		queue= 23,
		leave= 24
	}

	global.MMO_IP="127.0.0.1";
	global.MMO_Port=63458;

	global.MMO_Buf=buffer_create(512,buffer_fixed,1);
	global.MMO_BufLarge=buffer_create(4096,buffer_fixed,1);
	scrMMOCreateSocket();

	global.MMO_SavePath="saveData.ini";
	global.MMO_UID="";

	global.MMO_Players={};
	global.MMO_ServerBrowser={};
	global.MMO_ServerBrowserType=0;
	global.MMO_isCluster=false;
	global.MMO_UnifiedCluster=0;
	global.MMO_ConnectAgain=false;

	global.playerName="Joe";
	global.playerOutfit="0242312170110255000000000000255"

	if !file_exists(global.MMO_SavePath) scrMMOSave();
	scrMMOLoad();
}

function scrMMOCreateSocket(){
	if (os_type==os_browser){
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
	network_connect_raw(global.MMO_Socket,ipOPTIONAL,portOPTIONAL);
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

function scrMMOGetPacket(network_map,playerObj){ //Process a packet - put this in an Async - Networking event
	var buffer=network_map[? "buffer"];
	var _size=network_map[? "size"]
	if !is_undefined(buffer){
		buffer_seek(buffer,buffer_seek_start,0);
		//while( buffer_tell(buffer) < _size ){
		{
			switch (network_map[? "type"]){
				case network_type_data:
					switch (buffer_read(buffer,buffer_u8)){
						case serverNet.assign:
							global.MMO_Players[$ "player"]={
								obj: instance_nearest(x,y,controller),
								ind: buffer_read(buffer,buffer_u16)
							}
							if global.MMO_UID=="" {
								global.MMO_UID=buffer_read(buffer,buffer_string);
								scrMMOSave();
							}
							buffer_seek(global.MMO_BufLarge,buffer_seek_start,0);
							buffer_write(global.MMO_BufLarge,buffer_u16,clientNet.ID);
							var _data={
								uid: global.MMO_UID,
								name: global.playerName,
								outfit: global.playerOutfit,
								room: room_get_name(room),
								pos: [0,0]
							}
							buffer_write(global.MMO_BufLarge,buffer_string,json_stringify(_data));
							scrMMOSendPacket(global.MMO_BufLarge);
							break;
						case clusterNet.type:
							global.MMO_UnifiedCluster=buffer_read(buffer,buffer_u8);
							global.MMO_isCluster=true;
							buffer_seek(global.MMO_Buf,buffer_seek_start,0);
							buffer_write(global.MMO_Buf,buffer_u8,clusterNet.type);
							buffer_write(global.MMO_Buf,buffer_u8,0);
							scrMMOSendPacket(global.MMO_Buf);
							break;
						case clusterNet.serverData:
							global.MMO_ServerBrowser= json_parse(buffer_read(buffer,buffer_string));
							scrMMOServerBrowser();
							break;
						default:
							break;
					}
					break;
			}
		}
	}
}

function scrMMODisconnect(isCluster){ //Send a disconnect request (network_destroy doesn't work on every platform)
	buffer_seek(global.MMO_Buf,buffer_seek_start,0);
	if !isCluster buffer_write(global.MMO_Buf,buffer_u8,serverNet.leave);
	else buffer_write(global.MMO_Buf,buffer_u8,clusterNet.leave);
	scrMMOSendPacket(global.MMO_Buf);
	
	show_debug_message("Disconnected from Server");
	global.MMO_Players={};
	if global.MMO_ConnectAgain {
		global.MMO_ConnectAgain=false;
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
				if _names[i]!="cap"&&global.MMO_ServerBrowser[$ _names[i]].c<_minPlayers _serverInd=_names[i];
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
				global.MMO_ConnectAgain=true;
				scrMMODisconnect(true);
			}
		default: break;
	}
}

function scrMMOSendPacket(buffer){ //Simplify packet sending
	network_send_raw(global.MMO_Socket,buffer,buffer_tell(buffer));
}