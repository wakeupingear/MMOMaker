///@description Connect to server
scrMMOSetup() ;
scrMMOConnect(global.MMO_IP,global.MMO_Port);

if !global.MMO_isWS{
	var _s=1;
	while display_get_height()>384*(_s+1) _s++;
	window_set_size(384*_s,384*_s);
}