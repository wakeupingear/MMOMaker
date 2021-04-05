if mouse_check_button(mb_left){ //Target the mouse
	target_x=mouse_x;
	target_y=mouse_y;
}
event_inherited();

if (max(abs(x-xprevious),abs(y-yprevious))>5) scrMMOSendPosition(x,y,true); //Check if movment is big enough to be a teleport
else if (target_x!=lastTarget_x||target_y!=lastTarget_y) scrMMOSendPosition(target_x,target_y,false); //Otherwise send it as a normal move