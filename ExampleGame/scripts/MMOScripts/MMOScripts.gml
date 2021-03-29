function scrMMOSetup(network_type){
	global.MMOSocket=network_create_socket(network_type);
	global.MMOType=network_type;
}

function scrMMOConnect(addr,port){
	network_connect_raw(global.MMOSocket,addr,port);
}