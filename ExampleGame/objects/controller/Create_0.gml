///@description Connect to server
scrMMOSetup() ; //Run the setup script
scrMMOConnect(global.MMO_IP,global.MMO_Port); //Connect to the default IP and Port

if !global.MMO_isWS{ //Max out the window size with pixel scaling
	var _s=1;
	while display_get_height()>384*(_s+1) _s++;
	window_set_size(384*_s,384*_s);
}