function scrMMOSetup(network_type){
	enum serverNet {
		assign,
		message,
		miscData,
		leave,
		pos,
		room,
		outfit,
		name,
		connect
	}
	
	enum clientNet {
		ID,
		pos,
		room,
		outfit,
		name,
		message,
		email,
		upload,
		miscData
	}

	global.MMO_IP="127.0.0.1";
	global.MMO_Port=63457;

	global.MMO_Buf=buffer_create(4096,buffer_fixed,1);
	global.MMO_Socket=network_create_socket(network_type);
	if network_type!=network_socket_ws network_set_timeout(global.MMO_Socket,4000,4000);
	global.MMO_Type=network_type;
	global.MMO_SavePath="saveData.ini";
	global.MMO_UID="-1";

	global.MMO_Players={};

	global.playerName="Joe";
	global.playerOutfit="0242312170110255000000000000255"

	if !file_exists(global.MMO_SavePath) scrMMOSave();
	scrMMOLoad();
}

function scrMMOConnect(ipOPTIONAL,portOPTIONAL){
	if is_undefined(ipOPTIONAL) ipOPTIONAL=global.MMO_IP;
	if is_undefined(portOPTIONAL) portOPTIONAL=global.MMO_Port;
	else network_connect_raw(global.MMO_Socket,ipOPTIONAL,portOPTIONAL);
}

function scrMMOSave(){
	ini_open(global.MMO_SavePath);
	ini_write_string("MMO_Data","UID",global.MMO_UID);

	ini_write_string("MMO_Player","Name",global.playerName);
	ini_write_string("MMO_Player","Outfit",global.playerOutfit);
	ini_close();
}

function scrMMOLoad(){
	ini_open(global.MMO_SavePath);
	global.MMO_UID=ini_read_string("MMO_Data","UID","-1");

	global.playerName=ini_read_string("MMO_Player","Name","Joe");
	global.playerOutfit=ini_read_string("MMO_Player","Outfit","0242312170110255000000000000255");
	ini_close();
}

function scrMMOGetPacket(network_map){
	var buffer=network_map[? "buffer"];
	if !is_undefined(buffer){
		buffer_seek(buffer,buffer_seek_start,0)
		switch (network_map[? "type"]){
			case network_type_connect:
				show_debug_message("Connected to Server");
				break;
			case network_type_disconnect:
				show_debug_message("Disconnected from Server");
				global.MMO_Players={};
				break;
			case network_type_data:
				switch (buffer_read(buffer,buffer_u8)){
					case serverNet.assign:
						global.MMO_Players[$ "player"]={
							obj: instance_nearest(x,y,controller),
							ind: buffer_read(buffer,buffer_u8)
						}
						if global.MMO_UID=="-1" {
							global.MMO_UID=buffer_read(buffer,buffer_string);
							scrMMOSave();
						}
						
						buffer_seek(global.MMO_Buf,buffer_seek_start,0);
						network_send_raw(global.MMO_Socket,global.MMO_Buf,buffer_tell(global.MMO_Buf))
						break;
					case serverNet.connect:
						var _port=buffer_read(buffer,buffer_u16);
						var _ip=buffer_read(buffer,buffer_string);
						show_debug_message("Switching to Server "+_ip);
						scrMMOConnect(_ip,_port);
						break;
					default:
						break;
				}
				break;
		}
	}
}