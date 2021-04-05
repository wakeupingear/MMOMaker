//All the MMOEngine GMS Scripts
//(Yes, 2.3+ lets you put multiple functions inside one file!)

function scrMMOSetup(){ //Setup script - run FIRST before using any other functions
	enum serverNet //Enum for server-to-client packets
	{
		//0 is not included since an empty buffer is filled with 0s
		//If multiple packets are combined, this lets the system find the headers of each one by skipping 0s
		assign= 1,
		message= 2,
		miscData= 3,
		pos= 4,
		myRoom= 5,
		outfit= 6,
		name= 7,
		leave= 8,
		playerObj= 9,

        heartbeat= 10
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
		miscData= 28,

		heartbeat= 29
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

	global.MMO_Buf=buffer_create(512,buffer_fixed,1); //Small buffer for no strings
	global.MMO_BufLarge=buffer_create(4096,buffer_fixed,1); //Large buffer for strings
	scrMMOCreateSocket(); //Create a socket
	global.MMO_IP="127.0.0.1"; //IP to connect to (127.0.0.1 is your own computer)
	global.MMO_Port=63456+global.MMO_isWS; //Port to connect to; TCP and WS used different ports, WS is +1

	global.MMO_SavePath="saveData.ini"; //Save path for config and player info
	global.MMO_UID=""; //Unique user string; generated server-side and stored client-side between sessions
	global.MMO_ID=-1; //Temporary ID while in a server

	global.MMO_Players={}; //Struct of all players
	global.MMO_Messages=ds_list_create(); //List of messages sent for the in game chat
	global.MMO_PlayerObject=oPlayer; //GMS object that represents you
	global.MMO_OtherPlayerObject=oOtherPlayer; //GMS object for other player
	global.MMO_ServerBrowser={}; //Struct for all servers within a cluster 
	global.MMO_ServerBrowserType=0; //What to do when recieving ServerBrowser data from a cluster (see scrMMOServerBrowser)
	global.MMO_isCluster=false; //Whether the current game is part of a cluster
	global.MMO_ClusterMode=0; //Whether the cluster is made of separate instance or one single instance of multiple nodes
	global.MMO_QueuePos=-1; //Position in a waiting queue if all servers in a cluster are full

	global.playerName="Joe";
	global.playerOutfit="0242312170110255000000000000255"

	if !file_exists(global.MMO_SavePath) scrMMOSave(); //Create the save file if it doesn't exist
	scrMMOLoad(); //Load the file
}

function scrMMOConnect(ipOPTIONAL,portOPTIONAL){ //Connect to a server
	if is_undefined(ipOPTIONAL) ipOPTIONAL=global.MMO_IP;
	if is_undefined(portOPTIONAL) portOPTIONAL=global.MMO_Port;
	scrMMOCreateSocket(); //Force a socket reset before connecting to a new server
	network_connect_raw_async(global.MMO_Socket,ipOPTIONAL,portOPTIONAL);
}

function scrMMOJoinGame(){ //Script that runs when a you have connected to a game
	if !instance_exists(global.MMO_PlayerObject) { //Create a controllable player object
		global.MMO_Players[$ global.MMO_ID].obj=instance_create_depth(192,192,0,global.MMO_PlayerObject);
	}
	room_goto(rStart); //Load the starting room
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

function scrMMOGetPacket(network_map){ //Process a packet - put this in an 'Async - Networking' event
	var buffer=network_map[? "buffer"];
	var _size=network_map[? "size"];
	if !is_undefined(buffer){ //Failsafe if other async events are picked up
		buffer_seek(buffer,buffer_seek_start,0); //Move to the start of the buffer

		//If buffers are recieved close enough to each other, GMS adds them together
		//To properly read all the packets, this for loop is needed to read all the way to the end of a buffer
		for (var _bufferInd=1;buffer_tell(buffer)< _size;_bufferInd++){
		{
			switch (network_map[? "type"]){
				case network_type_data:
					var _header=buffer_read(buffer,buffer_u8); //Read the first byte, which corresponds to an enum value
					switch (_header){
						case 0: break; //Empty byte between packets

						case serverNet.assign: //Server sends a temporary ID and newly generated UID
							global.MMO_ID=string(buffer_read(buffer,buffer_u16));
							global.MMO_Players[$ global.MMO_ID]={ //Create player struct
								obj: "player", //Temporary - later replaced by an actual object
								ind: global.MMO_ID
							}
							var _uid=buffer_read(buffer,buffer_string);
							if global.MMO_UID=="" { //Only use this UID if you haven't saved one previously
								global.MMO_UID=_uid;
								scrMMOSave();
							}
							buffer_seek(global.MMO_BufLarge,buffer_seek_start,2);
							buffer_write(global.MMO_BufLarge,buffer_u8,clientNet.ID);
							var _data={ //Create a struct for the server
								uid: global.MMO_UID,
								name: global.playerName,
								outfit: global.playerOutfit,
								myRoom: room_get_name(room),
								pos: [0,0,1]
							}
							buffer_write(global.MMO_BufLarge,buffer_string,json_stringify(_data));
							scrMMOSendPacketLen(global.MMO_BufLarge); //Send the struct to the server
							scrMMOJoinGame(); //Script to run when logged into the game
							break;

						case serverNet.playerObj: //Server sends all the data for a player (when either you or they join)
							var _id=buffer_read(buffer,buffer_u8);
							var _data=json_parse(buffer_read(buffer,buffer_string));
							scrMMOCreateOtherPlayer(_id,_data); //Script to set properties
							break;
						case clusterNet.type: //Cluster checking if this is a player or a server node (spoiler: it's a player)
							global.MMO_ClusterMode=buffer_read(buffer,buffer_u8); //Cluster mode (see scrMMOServerBrowser)
							global.MMO_isCluster=true; //Confirm that this is a cluster
							buffer_seek(global.MMO_Buf,buffer_seek_start,0);
							buffer_write(global.MMO_Buf,buffer_u8,clusterNet.type);
							buffer_write(global.MMO_Buf,buffer_u8,0); //0 corresponds to a player on the cluster end
							scrMMOSendPacket(global.MMO_Buf);
							break;

						case clusterNet.serverData: //Cluster sending a struct of all the possible browsers
							var _data=buffer_read(buffer,buffer_string);
							global.MMO_ServerBrowser= json_parse(_data);
							scrMMOServerBrowser(); //Parse the struct based on global.MMO_ClusterMode
							break;

						case clusterNet.queue: //Cluster sending your place in the queue
							global.MMO_QueuePos=buffer_read(buffer,buffer_u16);
							show_debug_message("Place in Queue: "+string(global.MMO_QueuePos));
							break;

						case serverNet.leave: //Player leaves
							var _id=string(buffer_read(buffer,buffer_u16));
							instance_destroy(global.MMO_Players[$ _id].obj); //Destroy the corresponding object
							variable_struct_remove(global.MMO_Players,_id);
							break;

						case serverNet.heartbeat:
							alarm[12]=-1; //Reset the heartbeat alarm
							break;

						case clientNet.message: //Recieve a message
							var _msg=buffer_read(buffer, buffer_string); //This can be changed to recieve a JSON to include info like sender name
							ds_list_add(messages,_msg);
							break;

						case clientNet.pos: //Player sends a new position
							var _id=string(buffer_read(buffer,buffer_u16));
							var _x=buffer_read(buffer,buffer_s16);
							var _y=buffer_read(buffer,buffer_s16);
							var _t=buffer_read(buffer,buffer_u8);
							scrMMOGetData(_id,_header,[_x,_y,_t]); //Script to set the object's position
							break;

						default: //Miscellaneous player data
							var _id=string(buffer_read(buffer,buffer_u16));
							scrMMOGetData(_id,_header,buffer_read(buffer,buffer_string));
							break;
					}
					break;
				}
			}

			//Since there might be another buffer after this one, skip ahead
			//Every server packet is a multiple of 512, so the next data header has to also be on a multiple of 512
			//After seeking ahead, the loop will repeat as long as that position is still within the whole buffer's length
			buffer_seek(buffer,buffer_seek_start,min(_size,_bufferInd*512));
		}
	}
}

function scrMMOHeartbeat(){ //Send a "heartbeat" - confirmation that the game is still connected to the server
	buffer_seek(global.MMO_Buf,buffer_seek_start,0);
	buffer_write(global.MMO_Buf,buffer_u8,clusterNet.type);
	scrMMOSendPacket(global.MMO_Buf);

	alarm[12]=room_speed*5; //Alarm triggers in 5 seconds; it is reset if a "heartbeat" is recieved back
}

function scrMMODisconnect(connectAgain){ //Send a disconnect request (network_destroy doesn't work on every platform)
	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	buffer_write(global.MMO_Buf,buffer_u8,serverNet.leave);
	scrMMOSendPacketLen(global.MMO_Buf);
	
	show_debug_message("Disconnected from Server");
	global.MMO_Players={}; //Reset the player struct
	global.MMO_isCluster=false; //Reset the cluster status
	if connectAgain {
		scrMMOConnect(); //Reconnect to another server (switching from a cluster manager to a node)
	}
}

function scrMMOServerBrowser(){ //Process server browser when connecting to a cluster
	var _serverInd=-2;
	switch (global.MMO_ServerBrowserType){
		case 0: //Connect to the least full server
			var _minPlayers=global.MMO_ServerBrowser.cap; //Max capacity is stored at the key 'cap' in the struct
			var _names=variable_struct_get_names(global.MMO_ServerBrowser);
			for (var i=0;i<array_length(_names);i++){ //Loop through each server
				if _names[i]!="cap"&&global.MMO_ServerBrowser[$ _names[i]].c<_minPlayers { //Check if this server has a smaller player count
					_minPlayers=global.MMO_ServerBrowser[$ _names[i]].c;
					_serverInd=_names[i];
				}
			}
			break;
		case 1: //Connect to the most full server
			var _minPlayers=-1;
			var _names=variable_struct_get_names(global.MMO_ServerBrowser);
			for (var i=0;i<array_length(_names);i++){ //Loop through each server and check if it has a larger player count
				if _names[i]!="cap"&&global.MMO_ServerBrowser[$ _names[i]].c>_minPlayers&&global.MMO_ServerBrowser[$ _names[i]].c<global.MMO_ServerBrowser.cap{
					_minPlayers=global.MMO_ServerBrowser[$ _names[i]].c;
					_serverInd=_names[i];
				}
			}
			break;
		default: break;
	}

	if _serverInd==-2{ //Do nothing
		//Write code here for a server browser!
	}
	if _serverInd==-1{ //All servers are at max capacity
		show_debug_message("Servers are full!");
		buffer_seek(global.MMO_Buf,buffer_seek_start,0); //Join the lobby queue
		buffer_write(global.MMO_Buf,buffer_u8,clusterNet.queue);
		scrMMOSendPacket(global.MMO_Buf);
	}
	else {
		global.MMO_IP=global.MMO_ServerBrowser[$ _serverInd].ip;
		global.MMO_Port=int64(global.MMO_ServerBrowser[$ _serverInd].p)+global.MMO_isWS;
		scrMMODisconnect(true,true); //Disconnect and connect to the new ip and port (since)
	}
}

function scrMMOSendPosition(x,y,teleport){ //Send a position packet (teleport shows that the player snaps to a position regardless of movement type)
	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	buffer_write(global.MMO_Buf,buffer_u8,clientNet.pos);
	buffer_write(global.MMO_Buf,buffer_s16,x);
	buffer_write(global.MMO_Buf,buffer_s16,y);
	buffer_write(global.MMO_Buf,buffer_u8,teleport); //Whether the player has suddenly changed positions (true) or merely moved towards that point (false)
	scrMMOSendPacketLen(global.MMO_Buf);
}

function scrMMOSendRoom(myRoom){ //Send the specified room
	//Rooms are sent as strings since room IDs can change as new rooms are added
	//This allows older versions of the same client to work with new ones, even if the new versions have a different room order
	if !is_string(myRoom) myRoom=room_get_name(myRoom);

	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	buffer_write(global.MMO_Buf,buffer_u8,clientNet.myRoom);
	buffer_write(global.MMO_Buf,buffer_string,myRoom);
	scrMMOSendPacketLen(global.MMO_Buf);
}

function scrMMOSendOutfit(outfit){ //Send an outfit string
	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	buffer_write(global.MMO_Buf,buffer_u8,clientNet.outfit);
	buffer_write(global.MMO_Buf,buffer_string,outfit);
	scrMMOSendPacketLen(global.MMO_Buf);
}

function scrMMOSendName(name){ //Send a name
	buffer_seek(global.MMO_Buf,buffer_seek_start,2);
	buffer_write(global.MMO_Buf,buffer_u8,clientNet.name);
	buffer_write(global.MMO_Buf,buffer_string,name);
	scrMMOSendPacketLen(global.MMO_Buf);
}

function scrMMOSendMessage(message){ //Send a message
	buffer_seek(global.MMO_BufLarge,buffer_seek_start,2);
	buffer_write(global.MMO_BufLarge,buffer_u8,clientNet.message);
	buffer_write(global.MMO_BufLarge,buffer_string,message);  //This can be changed to send a JSON to include info like sender name
	scrMMOSendPacketLen(global.MMO_BufLarge);
}

function scrMMOGetData(serverID,type,data){ //process
	if !is_string(serverID) serverID=string(serverID);
	if !variable_struct_exists(global.MMO_Players,serverID) { //Check that this player exists in the player struct
		global.MMO_Players[$ serverID]={
			obj: instance_create_depth(x,y,0,global.MMO_OtherPlayerObject),
			ind: serverID,
		}
		global.MMO_Players[$ serverID].obj.serverID=serverID;
	}
	var _obj=global.MMO_Players[$ serverID].obj;
	switch (type){
		case clientNet.pos:
			if data[2]{ //Teleport moves the player to that point instead of just setting target_x
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
			break;
		default: break;
	}
}

function scrMMOCreateOtherPlayer(serverID,data){ //Create another player object from a struct
	if !is_string(serverID) serverID=string(serverID);
	if !variable_struct_exists(global.MMO_Players,serverID) { //Add the player to the player struct 
		global.MMO_Players[$ serverID]={
			obj: instance_create_depth(x,y,0,global.MMO_OtherPlayerObject), //Create an object linked to this ID
			ind: serverID,
		}
		global.MMO_Players[$ serverID].obj.serverID=serverID;
	}

	var _obj=global.MMO_Players[$ serverID].obj;
	var _names=variable_struct_get_names(data);
	for (var i=0;i<array_length(_names);i++){ //Loop through each key:value pair in the struct
		switch _names[i] {
			case "pos":
				_obj.x=data.pos[0];
				_obj.y=data.pos[1];
				_obj.target_x=data.pos[0];
				_obj.target_y=data.pos[0];
				break;
			case "myRoom":
				_obj.myRoom=asset_get_index(data.myRoom); //Convert the room name to an ID
				break;
			case "name":
				_obj.name=data.name;
				break;
			default:
				variable_instance_set(_obj,_names[i],data[$ _names[i]]); //Set a variable with the same name as the key
				break;
		}
	}
}


//The following scripts are mostly used as helper functions for the ones above, so you will not probably need to use them

function scrMMOCreateSocket(){ //Create a socket based on platform
	if (os_browser!=browser_not_a_browser){ //Running in a browser requries WebSockets
		global.MMO_isWS=true;
		global.MMO_Socket=network_create_socket(network_socket_ws);
	}
	else{ //Other platforms can use TCP
		global.MMO_isWS=false;
		global.MMO_Socket=network_create_socket(network_socket_tcp);
		network_set_timeout(global.MMO_Socket,4000,4000); //Timeout unavailable on HTML
	}
}

function scrMMOSendPacket(buffer){ //Send the specified buffer to the currently connected server
	network_send_raw(global.MMO_Socket,buffer,buffer_tell(buffer));
}

//GMS bunches outbound packets together if sent at similar times
//This adds the packet length in bytes to the front of the packet as a 16 bit Integer (in front of the packet header)
//That's why some code in the other MMO scripts use:
//	buffer_seek(global.MMO_Buf,buffer_seek_start,2) 
//	instead of 
//	buffer_seek(global.MMO_Buf,buffer_seek_start,0)

//Server.js reads this packet length and, after processing the packet, skips past it to check for more packets, avoiding server-side packet loss
//This is only necessary for nodes, not a cluster, because it only becomes a problem for player data that can be sent multiple times a frame
function scrMMOSendPacketLen(buffer){
	var _len=buffer_tell(buffer); //Save the length of the buffer
	buffer_seek(buffer,buffer_seek_start,0); //Move back to the front
	buffer_write(buffer,buffer_u16,_len); //Write the buffer length
	network_send_raw(global.MMO_Socket,buffer,_len); //Send the packet with the original length
}