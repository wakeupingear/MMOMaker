event_inherited();

image_index=1;

scrMMOSendRoom(room_get_name(room)); //Send the current room
scrMMOSendPosition(x,y,true); //Send the starting position